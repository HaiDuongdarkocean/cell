import { logger } from '@/shared/lib/logger';
import type { Connection, Scope } from '../domain/types';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { RemoteEntry, StorageProvider } from '../ports/storageProvider';
import { ProviderError } from '../ports/storageProvider';
import { referencedBlobHashes } from './blobRefs';
import { CycleLockLostError } from './cycleLock';
import {
  BLOBS_NEEDED_PREFIX,
  BLOBS_PREFIX,
  blobsNeededHash,
  DISCONNECT_MARKER_PATH,
  deviceIdOfRemotePath,
  parseJournalSeq,
  parseSnapshotN,
  REMOTE_ROOT,
  scopeOfRemotePath,
  scopesPrefix,
} from './remotePaths';
import type { SyncStore } from './syncStore';
import { decodeJournal, decodeSnapshot } from './wireCodec';
import type { ChangeRecord } from '../domain/types';

export const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const STALE_CHAIN_MS = 30 * 24 * 60 * 60 * 1000;
export const ORPHAN_BLOB_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface RemoteSweepDeps {
  readonly provider: StorageProvider;
  readonly connection: Connection;
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly deviceId: string;
  readonly clock: Clock;
  readonly fence: () => Promise<void>;
}

interface ChainFile {
  readonly entry: RemoteEntry;
  readonly seq?: number;
  readonly n?: number;
}

interface DeviceChain {
  readonly scope: Scope;
  readonly deviceId: string;
  readonly files: ChainFile[];
}

function sweepKey(connectionId: string): string {
  return `syncSweepAt:${connectionId}`;
}

export async function runRemoteSweepIfDue(deps: RemoteSweepDeps): Promise<void> {
  const key = sweepKey(deps.connection.connectionId);
  const last = await deps.kv.get<number>('local', key);
  const now = deps.clock.now();
  if (last !== undefined && now - last < SWEEP_INTERVAL_MS) return;
  await deps.kv.set('local', key, now);
  await runRemoteSweep(deps, now);
}

export async function runRemoteSweep(deps: RemoteSweepDeps, now: number): Promise<void> {
  const entries = await deps.provider.list(deps.connection, scopesPrefix());
  const chains = groupChains(entries);
  const referenced = new Set<string>();
  let refsComplete = true;
  for (const chain of chains.values()) {
    const chainOk = await sweepSuperseded(deps, chain, referenced);
    refsComplete = refsComplete && chainOk;
  }
  await sweepStaleChains(deps, chains, now);
  await sweepOrphanBlobs(deps, now, refsComplete ? referenced : null);
}

function groupChains(entries: readonly RemoteEntry[]): Map<string, DeviceChain> {
  const chains = new Map<string, DeviceChain>();
  for (const entry of entries) {
    const scope = scopeOfRemotePath(entry.path);
    if (scope === null) continue;
    const deviceId = deviceIdOfRemotePath(entry.path, scope);
    if (deviceId === null) continue;
    const key = `${scope}|${deviceId}`;
    const chain = chains.get(key) ?? { scope, deviceId, files: [] };
    const seq = parseJournalSeq(entry.path);
    const n = parseSnapshotN(entry.path);
    chain.files.push({ entry, seq: seq ?? undefined, n: n ?? undefined });
    chains.set(key, chain);
  }
  return chains;
}

async function decodeChainFile(
  deps: RemoteSweepDeps,
  path: string,
  kind: 'journal' | 'snapshot',
): Promise<{ coversSeq?: number; records: ChangeRecord[] } | undefined> {
  try {
    const blob = await deps.provider.read(deps.connection, path);
    const file = kind === 'journal' ? await decodeJournal(blob) : await decodeSnapshot(blob);
    return file;
  } catch (e) {
    if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
    return undefined;
  }
}

async function fencedRemove(deps: RemoteSweepDeps, path: string): Promise<void> {
  await deps.fence();
  try {
    await deps.provider.remove(deps.connection, path);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return;
    throw e;
  }
}

async function sweepSuperseded(
  deps: RemoteSweepDeps,
  chain: DeviceChain,
  referenced: Set<string>,
): Promise<boolean> {
  const snapshots = chain.files
    .filter((f): f is ChainFile & { n: number } => f.n !== undefined)
    .sort((a, b) => a.n - b.n);
  const newest = snapshots[snapshots.length - 1];
  let coversSeq = 0;
  let ok = true;
  if (newest !== undefined) {
    const decoded = await decodeChainFile(deps, newest.entry.path, 'snapshot');
    if (decoded === undefined || decoded.coversSeq === undefined) {
      ok = false;
    } else {
      coversSeq = decoded.coversSeq;
      for (const record of decoded.records) {
        for (const hash of referencedBlobHashes(record)) referenced.add(hash);
      }
    }
  }
  for (const file of chain.files) {
    if (file === newest) continue;
    if (file.seq !== undefined) {
      const decoded = await decodeChainFile(deps, file.entry.path, 'journal');
      if (decoded === undefined) {
        ok = false;
      } else {
        for (const record of decoded.records) {
          for (const hash of referencedBlobHashes(record)) referenced.add(hash);
        }
      }
      if (ok && file.seq <= coversSeq) {
        await fencedRemove(deps, file.entry.path);
      }
      continue;
    }
    if (file.n !== undefined && file.n < newest!.n && ok) {
      await fencedRemove(deps, file.entry.path);
    }
  }
  return ok;
}

async function sweepStaleChains(
  deps: RemoteSweepDeps,
  chains: ReadonlyMap<string, DeviceChain>,
  now: number,
): Promise<void> {
  for (const chain of chains.values()) {
    if (chain.deviceId === deps.deviceId) continue;
    if (chain.files.length === 0) continue;
    const stale = chain.files.every(
      (file) => file.entry.modifiedAt <= now - STALE_CHAIN_MS,
    );
    if (!stale) continue;
    try {
      for (const file of chain.files) {
        await fencedRemove(deps, file.entry.path);
      }
    } catch (e) {
      if (e instanceof CycleLockLostError) throw e;
      logger.warn('sync: stale chain sweep aborted', {
        scope: chain.scope,
        deviceId: chain.deviceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

async function sweepOrphanBlobs(
  deps: RemoteSweepDeps,
  now: number,
  referenced: Set<string> | null,
): Promise<void> {
  if (referenced === null) return;
  try {
    for (const row of await deps.store.listAllDeferred()) {
      for (const hash of row.requiredBlobHashes) referenced.add(hash);
    }
    for (const entry of await deps.provider.list(deps.connection, BLOBS_NEEDED_PREFIX)) {
      const hash = blobsNeededHash(entry.path);
      if (hash !== null) referenced.add(hash);
    }
    const blobs = await deps.provider.list(deps.connection, BLOBS_PREFIX);
    for (const entry of blobs) {
      const hash = entry.path.slice(BLOBS_PREFIX.length);
      if (referenced.has(hash)) continue;
      if (entry.modifiedAt > now - ORPHAN_BLOB_GRACE_MS) continue;
      await fencedRemove(deps, entry.path);
    }
  } catch (e) {
    if (e instanceof CycleLockLostError) throw e;
    if (e instanceof ProviderError) {
      logger.warn('sync: orphan blob sweep aborted', {
        error: e.message,
      });
      return;
    }
    throw e;
  }
}

export async function sweepDisconnectedFootprint(
  deps: Pick<RemoteSweepDeps, 'provider' | 'connection' | 'fence'>,
): Promise<void> {
  const entries = await deps.provider.list(deps.connection, `${REMOTE_ROOT}/`);
  for (const entry of entries) {
    if (entry.path === DISCONNECT_MARKER_PATH) continue;
    await deps.fence();
    try {
      await deps.provider.remove(deps.connection, entry.path);
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') continue;
      throw e;
    }
  }
}
