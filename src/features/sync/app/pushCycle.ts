import { logger } from '@/shared/lib/logger';
import type {
  ChangeRecord,
  Connection,
  DataClass,
  PendingKey,
  RecordKey,
  Scope,
} from '../domain/types';
import { mergeRecord } from '../domain/merge';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import { ProviderError } from '../ports/storageProvider';
import type { StorageProvider } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import { referencedBlobHashes } from './blobRefs';
import { CycleLockLostError } from './cycleLock';
import { ensureChainHealthy } from './chainHealth';
import {
  BLOBS_PREFIX,
  blobPath,
  journalPath,
  parseJournalSeq,
  parseSnapshotN,
  scopeDevicePrefix,
  snapshotPath,
} from './remotePaths';
import type { SyncStore } from './syncStore';
import {
  decodeJournal,
  decodeSnapshot,
  encodeJournal,
  encodeSnapshot,
  WireFormatError,
} from './wireCodec';

export const DEFAULT_PENDING_LIMIT = 5000;
export const DEFAULT_JOURNAL_COMPACTION_THRESHOLD = 50;

export class BlobUnavailableError extends Error {
  readonly hashes: readonly string[];

  constructor(hashes: readonly string[]) {
    super(`referenced blobs not present remotely: ${hashes.join(', ')}`);
    this.name = 'BlobUnavailableError';
    this.hashes = hashes;
  }
}

export interface ConnectionPushDeps {
  readonly provider: StorageProvider;
  readonly connection: Connection;
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly deviceId: string;
  readonly cycleId: string;
  readonly clock: Clock;
  readonly fence: () => Promise<void>;
  readonly pendingLimit?: number;
  readonly journalCompactionThreshold?: number;
  readonly healCheck?: boolean;
}

interface PushState {
  readonly healed: Set<Scope>;
}

export interface ScopePushOutcome {
  scope: Scope;
  journalSeq?: number;
  ackedKeys: number;
  snapshotN?: number;
  coversSeq?: number;
  error?: string;
}

export interface ConnectionPushResult {
  readonly outcomes: ScopePushOutcome[];
}

export async function collectPendingKeys(
  sources: readonly LocalSource[],
  limit: number,
): Promise<PendingKey[]> {
  const groups = await Promise.all(
    sources.map(async (source) => {
      try {
        return await source.pending(limit);
      } catch (error) {
        logger.warn('[sync] pending() failed for', source.dataClass, error);
        return [] as PendingKey[];
      }
    }),
  );
  return groups.flat();
}

export function groupPendingByScope(keys: readonly PendingKey[]): Map<Scope, PendingKey[]> {
  const out = new Map<Scope, PendingKey[]>();
  for (const key of keys) {
    const group = out.get(key.scope);
    if (group) group.push(key);
    else out.set(key.scope, [key]);
  }
  return out;
}

export function pendingKeysOfRecords(records: readonly ChangeRecord[]): PendingKey[] {
  return records.map((record) => ({
    scope: record.scope,
    dataClass: record.dataClass,
    key: record.key,
    op: record.op,
  }));
}

export async function resolvePendingKeys(
  sources: readonly LocalSource[],
  keys: readonly PendingKey[],
): Promise<ChangeRecord[]> {
  const out: ChangeRecord[] = [];
  for (const [dataClass, group] of groupByDataClass(keys)) {
    for (const source of sources) {
      if (source.dataClass !== dataClass) continue;
      out.push(...(await source.resolve(group)));
    }
  }
  return out;
}

export async function ackPendingKeys(
  sources: readonly LocalSource[],
  keys: readonly PendingKey[],
): Promise<void> {
  for (const [dataClass, group] of groupByDataClass(keys)) {
    for (const source of sources) {
      if (source.dataClass !== dataClass) continue;
      await source.ack(group);
    }
  }
}

export async function runConnectionPush(
  deps: ConnectionPushDeps,
  pendingByScope: ReadonlyMap<Scope, PendingKey[]>,
): Promise<ConnectionPushResult> {
  const outcomes: ScopePushOutcome[] = [];
  const committedScopes: Scope[] = [];
  const state: PushState = { healed: new Set() };

  const batches = await deps.store.pendingBatches(deps.connection.connectionId);
  for (const batch of batches) {
    try {
      const acked = await commitBatch(
        deps,
        state,
        batch.scope,
        batch.seq,
        batch.records,
        pendingKeysOfRecords(batch.records),
        batch.key,
      );
      outcomes.push({ scope: batch.scope, journalSeq: batch.seq, ackedKeys: acked });
      committedScopes.push(batch.scope);
    } catch (error) {
      if (error instanceof CycleLockLostError || error instanceof ProviderError) throw error;
      outcomes.push({ scope: batch.scope, ackedKeys: 0, error: describePushError(error) });
    }
  }

  let effective = pendingByScope;
  if (batches.length > 0) {
    const fresh = groupPendingByScope(
      await collectPendingKeys(deps.sources, deps.pendingLimit ?? DEFAULT_PENDING_LIMIT),
    );
    const refreshed = new Map<Scope, PendingKey[]>();
    for (const scope of pendingByScope.keys()) {
      refreshed.set(scope, fresh.get(scope) ?? []);
    }
    effective = refreshed;
  }

  const scopes = [...effective.keys()].sort();
  for (const scope of scopes) {
    const keys = effective.get(scope) ?? [];
    if (keys.length === 0) continue;
    try {
      const records = await resolvePendingKeys(deps.sources, keys);
      if (records.length === 0) {
        await deps.fence();
        await ackPendingKeys(deps.sources, keys);
        outcomes.push({ scope, ackedKeys: keys.length });
        continue;
      }
      const batch = await deps.store.freezeBatch({
        connectionId: deps.connection.connectionId,
        scope,
        records,
        cycleId: deps.cycleId,
        createdAt: deps.clock.now(),
      });
      const acked = await commitBatch(
        deps,
        state,
        scope,
        batch.seq,
        batch.records,
        keys,
        batch.key,
      );
      outcomes.push({ scope, journalSeq: batch.seq, ackedKeys: acked });
      committedScopes.push(scope);
    } catch (error) {
      if (error instanceof CycleLockLostError || error instanceof ProviderError) throw error;
      outcomes.push({ scope, ackedKeys: 0, error: describePushError(error) });
    }
  }

  for (const scope of committedScopes) {
    const compaction = await compactScopeIfNeeded(deps, scope);
    if (compaction) {
      const outcome = outcomes.find((o) => o.scope === scope);
      if (outcome) {
        outcome.snapshotN = compaction.n;
        outcome.coversSeq = compaction.coversSeq;
      }
    }
  }
  return { outcomes };
}

async function commitBatch(
  deps: ConnectionPushDeps,
  state: PushState,
  scope: Scope,
  seq: number,
  records: readonly ChangeRecord[],
  ackKeys: readonly PendingKey[],
  batchKey: string,
): Promise<number> {
  if (deps.healCheck !== false && !state.healed.has(scope)) {
    state.healed.add(scope);
    await ensureChainHealthy(deps, scope, seq);
  }
  await uploadAndVerifyBlobs(deps, collectBlobHashes(records));
  await deps.fence();
  await deps.provider.write(
    deps.connection,
    journalPath(scope, deps.deviceId, seq),
    encodeJournal({ scope, deviceId: deps.deviceId, seq, records }),
  );
  await deps.fence();
  for (const source of deps.sources) {
    await source.stampCommitted(records);
  }
  await ackPendingKeys(deps.sources, ackKeys);
  await deps.store.deletePendingBatch(batchKey);
  return ackKeys.length;
}

export async function uploadAndVerifyBlobs(
  deps: Pick<ConnectionPushDeps, 'provider' | 'connection' | 'blobs' | 'fence'>,
  hashes: readonly string[],
): Promise<readonly string[]> {
  if (hashes.length === 0) return [];
  const connection = deps.connection;
  const present = new Map(
    (await deps.provider.list(connection, BLOBS_PREFIX)).map((entry) => [entry.path, entry]),
  );
  const uploadedSizes = new Map<string, number>();
  for (const hash of hashes) {
    const path = blobPath(hash);
    if (present.has(path)) continue;
    const blob = await deps.blobs.read(hash);
    if (blob === null) continue;
    await deps.fence();
    const entry = await deps.provider.write(connection, path, blob);
    uploadedSizes.set(path, entry.size);
  }
  const listing = new Map(
    (await deps.provider.list(connection, BLOBS_PREFIX)).map((entry) => [entry.path, entry]),
  );
  const missing: string[] = [];
  for (const hash of hashes) {
    const path = blobPath(hash);
    const entry = listing.get(path);
    const expectedSize = uploadedSizes.get(path);
    if (entry === undefined || (expectedSize !== undefined && entry.size !== expectedSize)) {
      missing.push(hash);
    }
  }
  if (missing.length > 0) throw new BlobUnavailableError(missing);
  return [...uploadedSizes.keys()];
}

export function collectBlobHashes(records: readonly ChangeRecord[]): string[] {
  const out = new Set<string>();
  for (const record of records) {
    for (const hash of referencedBlobHashes(record)) out.add(hash);
  }
  return [...out];
}

interface RemoteJournalFile {
  readonly seq: number;
  readonly path: string;
}

interface RemoteSnapshotFile {
  readonly n: number;
  readonly path: string;
}

async function compactScopeIfNeeded(
  deps: ConnectionPushDeps,
  scope: Scope,
): Promise<{ n: number; coversSeq: number } | undefined> {
  const connection = deps.connection;
  const pending = await deps.store.pendingBatches(connection.connectionId);
  if (pending.some((batch) => batch.scope === scope)) return undefined;

  const entries = await deps.provider.list(
    connection,
    scopeDevicePrefix(scope, deps.deviceId),
  );
  const journals: RemoteJournalFile[] = [];
  const snapshots: RemoteSnapshotFile[] = [];
  for (const entry of entries) {
    const seq = parseJournalSeq(entry.path);
    if (seq !== null) {
      journals.push({ seq, path: entry.path });
      continue;
    }
    const n = parseSnapshotN(entry.path);
    if (n !== null) snapshots.push({ n, path: entry.path });
  }
  const threshold = deps.journalCompactionThreshold ?? DEFAULT_JOURNAL_COMPACTION_THRESHOLD;
  if (journals.length <= threshold) return undefined;
  journals.sort((a, b) => a.seq - b.seq);
  snapshots.sort((a, b) => a.n - b.n);
  const coversSeq = journals[journals.length - 1]!.seq;

  const byKey = new Map<RecordKey, ChangeRecord>();
  const newestSnapshot = snapshots[snapshots.length - 1];
  if (newestSnapshot) {
    const file = await decodeCompactionFile(deps, scope, newestSnapshot.path, 'snapshot');
    if (!file) return undefined;
    for (const record of file.records) foldRecord(byKey, record);
  }
  for (const journal of journals) {
    const file = await decodeCompactionFile(deps, scope, journal.path, 'journal');
    if (!file) return undefined;
    for (const record of file.records) foldRecord(byKey, record);
  }
  const records = [...byKey.values()];

  await uploadAndVerifyBlobs(deps, collectBlobHashes(records));
  const n = await deps.store.allocateSnapshotN(connection.connectionId, scope);
  await deps.fence();
  await deps.provider.write(
    connection,
    snapshotPath(scope, deps.deviceId, n),
    encodeSnapshot({ scope, deviceId: deps.deviceId, n, coversSeq, records }),
  );
  for (const journal of journals) {
    if (journal.seq > coversSeq) continue;
    await deps.fence();
    await removeRemote(deps, journal.path);
  }
  for (const snapshot of snapshots) {
    if (snapshot.n >= n) continue;
    await deps.fence();
    await removeRemote(deps, snapshot.path);
  }
  return { n, coversSeq };
}

function foldRecord(byKey: Map<RecordKey, ChangeRecord>, record: ChangeRecord): void {
  const previous = byKey.get(record.key) ?? null;
  const next = mergeRecord(previous, record);
  if (next === null) {
    byKey.delete(record.key);
  } else {
    byKey.set(record.key, next);
  }
}

async function decodeCompactionFile(
  deps: ConnectionPushDeps,
  scope: Scope,
  path: string,
  kind: 'journal' | 'snapshot',
): Promise<{ records: ChangeRecord[] } | undefined> {
  try {
    const blob = await deps.provider.read(deps.connection, path);
    const file = kind === 'journal' ? await decodeJournal(blob) : await decodeSnapshot(blob);
    if (file.scope !== scope || file.deviceId !== deps.deviceId) return undefined;
    return file;
  } catch (e) {
    if (e instanceof WireFormatError) return undefined;
    throw e;
  }
}

async function removeRemote(deps: ConnectionPushDeps, path: string): Promise<void> {
  try {
    await deps.provider.remove(deps.connection, path);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return;
    throw e;
  }
}

function describePushError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function groupByDataClass(keys: readonly PendingKey[]): Map<DataClass, PendingKey[]> {
  const out = new Map<DataClass, PendingKey[]>();
  for (const key of keys) {
    const group = out.get(key.dataClass);
    if (group) group.push(key);
    else out.set(key.dataClass, [key]);
  }
  return out;
}
