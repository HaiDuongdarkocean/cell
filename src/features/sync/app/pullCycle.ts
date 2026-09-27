import { logger } from '@/shared/lib/logger';
import type {
  ChangeRecord,
  Connection,
  ConnectionId,
  DataClass,
  Hlc,
  RecordKey,
  Scope,
} from '../domain/types';
import type { Cursor } from '../domain/types';
import { compareHlc } from '../domain/hlc';
import { isPlainJsonObject } from '../domain/flatten';
import { sortRecordsForApply } from '../domain/merge/applyOrder';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { ApplyContext, LocalSource } from '../ports/localSource';
import { ProviderError } from '../ports/storageProvider';
import type { StorageProvider } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import { referencedBlobHashes } from './blobRefs';
import { CycleLockLostError } from './cycleLock';
import { cursorKey, readCursors, writeCursor, type CursorMap } from './cursors';
import {
  BLOBS_NEEDED_PREFIX,
  BLOBS_PREFIX,
  DISCONNECT_MARKER_PATH,
  blobPath,
  blobsNeededHash,
  blobsNeededPath,
  deviceIdOfRemotePath,
  parseJournalSeq,
  parseSnapshotN,
  scopeDevicesPrefix,
} from './remotePaths';
import { blobToBytes } from '../adapters/contract/blobBytes';
import { appendConflictLog } from '../adapters/local/kv/conflictLog';
import { kvMetaKey, readSyncMetaKV } from '../adapters/local/kv/kvMeta';
import { readRouteMarker, type RouteMarker } from './routeMarkers';
import type { ConflictLogEntry } from '../ports/localSource';
import type { SyncStore } from './syncStore';
import { decodeJournal, decodeSnapshot, WireFormatError } from './wireCodec';

export const SYNC_APPLIED_AT_KEY = 'syncAppliedAt';
export const DEFERRED_WARNING_CYCLES = 3;

export interface ConnectionPullDeps {
  readonly provider: StorageProvider;
  readonly connection: Connection;
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly deviceId: string;
  readonly clock: Clock;
  readonly fence: () => Promise<void>;
  readonly observeHlc?: (hlc: Hlc) => void;
  readonly onRemoteRecord?: (record: ChangeRecord) => void;
  readonly onRoutingChange?: (record: ChangeRecord) => Promise<void>;
  readonly onRouteMarker?: (scope: Scope, marker: RouteMarker) => Promise<void>;
  readonly onDisconnect?: (connectionId: ConnectionId) => Promise<void>;
  readonly onAppliedBatch?: (
    scope: Scope,
    dataClasses: readonly DataClass[],
    applied: number,
  ) => void;
}

export interface DevicePullOutcome {
  readonly deviceId: string;
  readonly filesRead: number;
  readonly recordsApplied: number;
  readonly recordsDeferred: number;
  readonly appliedDataClasses: DataClass[];
  readonly warnings: string[];
  readonly cursor: Cursor;
}

export interface ScopePullOutcome {
  readonly scope: Scope;
  readonly devices: DevicePullOutcome[];
  readonly warnings: string[];
  readonly releasedApplied: number;
  readonly releasedDataClasses: DataClass[];
  readonly error?: string;
}

export interface ConnectionPullResult {
  readonly outcomes: ScopePullOutcome[];
  readonly appliedDataClasses: DataClass[];
  readonly appliedScopes: Scope[];
  readonly warnings: string[];
  readonly disconnected: boolean;
}

interface DeviceFiles {
  readonly deviceId: string;
  readonly snapshots: { n: number; path: string }[];
  readonly journals: { seq: number; path: string }[];
}

const ROUTING_RECORD_KEYS = new Set(['systemConnection']);

export async function runConnectionPull(
  deps: ConnectionPullDeps,
  scopes: readonly Scope[],
): Promise<ConnectionPullResult> {
  const connId = deps.connection.connectionId;
  const warnings: string[] = [];

  if (await isConnectionDisconnected(deps)) {
    await deps.onDisconnect?.(connId);
    return {
      outcomes: [],
      appliedDataClasses: [],
      appliedScopes: [],
      warnings,
      disconnected: true,
    };
  }

  const remoteBlobs = await listRemoteBlobPaths(deps);
  const cursors = await readCursors(deps.kv);
  const outcomes: ScopePullOutcome[] = [];
  const appliedDataClasses = new Set<DataClass>();
  const appliedScopes = new Set<Scope>();

  for (const scope of scopes) {
    try {
      const outcome = await pullScope(deps, scope, cursors, remoteBlobs);
      outcomes.push(outcome);
      if (outcome.releasedApplied > 0) appliedScopes.add(scope);
      for (const dc of outcome.releasedDataClasses) appliedDataClasses.add(dc);
      for (const device of outcome.devices) {
        if (device.recordsApplied > 0) appliedScopes.add(scope);
        for (const dc of device.appliedDataClasses) appliedDataClasses.add(dc);
      }
    } catch (e) {
      if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
      outcomes.push({
        scope,
        devices: [],
        warnings: [],
        releasedApplied: 0,
        releasedDataClasses: [],
        error: describePullError(e),
      });
    }
  }

  try {
    await answerBlobsNeeded(deps, remoteBlobs);
  } catch (e) {
    if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
    warnings.push(`blobs-needed answers failed: ${describePullError(e)}`);
  }
  try {
    warnings.push(
      ...(await drainDeferred(deps, remoteBlobs, appliedScopes, appliedDataClasses)),
    );
  } catch (e) {
    if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
    warnings.push(`deferred drain failed: ${describePullError(e)}`);
  }
  for (const scope of scopes) {
    try {
      const released = await releaseOpaque(deps, scope, remoteBlobs);
      if (released.applied > 0) appliedScopes.add(scope);
      for (const dc of released.dataClasses) appliedDataClasses.add(dc);
      warnings.push(...released.warnings);
    } catch (e) {
      if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
      warnings.push(`opaque release failed for ${scope}: ${describePullError(e)}`);
    }
  }

  return {
    outcomes,
    appliedDataClasses: [...appliedDataClasses],
    appliedScopes: [...appliedScopes],
    warnings,
    disconnected: false,
  };
}

async function pullScope(
  deps: ConnectionPullDeps,
  scope: Scope,
  cursors: CursorMap,
  remoteBlobs: Set<string>,
): Promise<ScopePullOutcome> {
  const entries = await deps.provider.list(
    deps.connection,
    scopeDevicesPrefix(scope),
  );
  const devices = new Map<string, DeviceFiles>();
  for (const entry of entries) {
    const deviceId = deviceIdOfRemotePath(entry.path, scope);
    if (deviceId === null || deviceId === deps.deviceId) continue;
    let files = devices.get(deviceId);
    if (!files) {
      files = { deviceId, snapshots: [], journals: [] };
      devices.set(deviceId, files);
    }
    const n = parseSnapshotN(entry.path);
    if (n !== null) {
      files.snapshots.push({ n, path: entry.path });
      continue;
    }
    const seq = parseJournalSeq(entry.path);
    if (seq !== null) files.journals.push({ seq, path: entry.path });
  }

  const warnings: string[] = [];
  if (deps.onRouteMarker !== undefined) {
    const marker = await readRouteMarker(deps.provider, deps.connection, scope);
    if (marker !== null) {
      try {
        await deps.onRouteMarker(scope, marker);
      } catch (e) {
        if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
        warnings.push(`route marker handling failed for ${scope}: ${describePullError(e)}`);
      }
    }
  }
  const deviceOutcomes: DevicePullOutcome[] = [];
  for (const files of devices.values()) {
    files.snapshots.sort((a, b) => a.n - b.n);
    files.journals.sort((a, b) => a.seq - b.seq);
    deviceOutcomes.push(await pullDevice(deps, scope, files, cursors, remoteBlobs));
  }
  for (const outcome of deviceOutcomes) warnings.push(...outcome.warnings);
  const released = await releaseOpaque(deps, scope, remoteBlobs);
  warnings.push(...released.warnings);
  return {
    scope,
    devices: deviceOutcomes,
    warnings,
    releasedApplied: released.applied,
    releasedDataClasses: [...released.dataClasses],
  };
}

async function pullDevice(
  deps: ConnectionPullDeps,
  scope: Scope,
  files: DeviceFiles,
  cursors: CursorMap,
  remoteBlobs: Set<string>,
): Promise<DevicePullOutcome> {
  const connId = deps.connection.connectionId;
  const key = cursorKey(connId, scope, files.deviceId);
  let cursor: Cursor = cursors[key] ?? { snapshotN: 0, seq: 0 };
  const warnings: string[] = [];
  const appliedDataClasses = new Set<DataClass>();
  let filesRead = 0;
  let applied = 0;
  let deferred = 0;

  const newest = files.snapshots[files.snapshots.length - 1];
  if (newest && newest.n > cursor.snapshotN) {
    try {
      const file = await deps.provider.read(deps.connection, newest.path);
      const snapshot = await decodeSnapshot(file);
      if (snapshot.scope !== scope || snapshot.deviceId !== files.deviceId) {
        throw new WireFormatError('snapshot scope/device mismatch');
      }
      filesRead++;
      const stats = await applyRemoteRecords(
        deps,
        scope,
        newest.path,
        snapshot.records,
        remoteBlobs,
      );
      applied += stats.applied;
      deferred += stats.deferred;
      for (const dc of stats.dataClasses) appliedDataClasses.add(dc);
      cursor = { snapshotN: newest.n, seq: Math.max(snapshot.coversSeq, cursor.seq) };
      await writeCursor(deps.kv, connId, scope, files.deviceId, cursor);
    } catch (e) {
      if (e instanceof WireFormatError) {
        warnings.push(`skipped corrupt snapshot ${newest.path}: ${e.message}`);
        cursor = { snapshotN: newest.n, seq: cursor.seq };
        await writeCursor(deps.kv, connId, scope, files.deviceId, cursor);
      } else if (e instanceof CycleLockLostError || e instanceof ProviderError) {
        throw e;
      } else {
        warnings.push(`snapshot ${newest.path} failed: ${describePullError(e)}`);
      }
    }
  }

  const pendingJournals = files.journals.filter((j) => j.seq > cursor.seq);
  const firstPending = pendingJournals[0];
  if (firstPending && cursor.seq > 0 && firstPending.seq > cursor.seq + 1) {
    warnings.push(
      `journal gap for ${scope}/${files.deviceId}: cursor seq ${cursor.seq}, earliest journal ${firstPending.seq}; awaiting snapshot`,
    );
  }

  for (const journal of pendingJournals) {
    try {
      const file = await deps.provider.read(deps.connection, journal.path);
      const decoded = await decodeJournal(file);
      if (decoded.scope !== scope || decoded.deviceId !== files.deviceId) {
        throw new WireFormatError('journal scope/device mismatch');
      }
      filesRead++;
      const stats = await applyRemoteRecords(
        deps,
        scope,
        journal.path,
        decoded.records,
        remoteBlobs,
      );
      applied += stats.applied;
      deferred += stats.deferred;
      for (const dc of stats.dataClasses) appliedDataClasses.add(dc);
      cursor = { snapshotN: cursor.snapshotN, seq: journal.seq };
      await writeCursor(deps.kv, connId, scope, files.deviceId, cursor);
    } catch (e) {
      if (e instanceof WireFormatError) {
        warnings.push(`skipped corrupt journal ${journal.path}: ${e.message}`);
        cursor = { snapshotN: cursor.snapshotN, seq: journal.seq };
        await writeCursor(deps.kv, connId, scope, files.deviceId, cursor);
      } else if (e instanceof CycleLockLostError || e instanceof ProviderError) {
        throw e;
      } else {
        warnings.push(`journal ${journal.path} failed: ${describePullError(e)}`);
        break;
      }
    }
  }

  return {
    deviceId: files.deviceId,
    filesRead,
    recordsApplied: applied,
    recordsDeferred: deferred,
    appliedDataClasses: [...appliedDataClasses],
    warnings,
    cursor,
  };
}

interface ApplyStats {
  applied: number;
  deferred: number;
  dataClasses: Set<DataClass>;
  warnings: string[];
}

function applyContextFor(deps: ConnectionPullDeps): ApplyContext {
  return {
    fetchBlob: async (contentHash) => {
      try {
        return await deps.provider.read(deps.connection, blobPath(contentHash));
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'not-found') return null;
        throw e;
      }
    },
  };
}

async function applyRemoteRecords(
  deps: ConnectionPullDeps,
  scope: Scope,
  sourcePath: string,
  records: readonly ChangeRecord[],
  remoteBlobs: Set<string>,
  resolvedSink?: Set<RecordKey>,
): Promise<ApplyStats> {
  const connId = deps.connection.connectionId;
  const stats: ApplyStats = {
    applied: 0,
    deferred: 0,
    dataClasses: new Set(),
    warnings: [],
  };
  const sorted = sortRecordsForApply(records);
  const now = deps.clock.now();

  const ready = new Map<DataClass, ChangeRecord[]>();
  for (const record of sorted) {
    deps.observeHlc?.(record.hlc);
    deps.onRemoteRecord?.(record);
    if (record.scope !== scope) {
      stats.warnings.push(
        `skipped foreign-scope record ${record.key} (${record.scope} in ${scope} file)`,
      );
      continue;
    }
    if (isRoutingRecord(record)) {
      await deps.onRoutingChange?.(record);
    }
    const needed = referencedBlobHashes(record);
    const missing = needed.filter((hash) => !remoteBlobs.has(blobPath(hash)));
    if (missing.length > 0) {
      await deps.store.deferRecord({
        connectionId: connId,
        sourcePath,
        record,
        requiredBlobHashes: needed,
        firstDeferredAt: now,
        attempts: 0,
      });
      for (const hash of missing) {
        await writeBlobsNeededMarker(deps, hash);
      }
      stats.deferred++;
      resolvedSink?.add(record.key);
      continue;
    }
    if (!deps.sources.some((source) => source.dataClass === record.dataClass)) {
      await deps.store.putOpaque(record);
      continue;
    }
    const batch = ready.get(record.dataClass) ?? [];
    batch.push(record);
    ready.set(record.dataClass, batch);
  }

  const ctx = applyContextFor(deps);
  const conflicts: ConflictLogEntry[] = [];
  for (const [dataClass, batch] of ready) {
    for (const source of deps.sources) {
      if (source.dataClass !== dataClass) continue;
      const result = await source.applyRemote(batch, ctx);
      stats.applied += result.applied.length;
      if (result.applied.length > 0) {
        stats.dataClasses.add(dataClass);
        deps.onAppliedBatch?.(scope, [dataClass], result.applied.length);
      }
      for (const record of result.applied) resolvedSink?.add(record.key);
      for (const record of result.localWon) resolvedSink?.add(record.key);
      for (const record of result.opaque) {
        await deps.store.putOpaque(record);
      }
      if (result.conflicts) conflicts.push(...result.conflicts);
    }
  }
  await appendConflictLog(deps.kv, conflicts);
  return stats;
}

const OPAQUE_RELEASE_MAX_PASSES = 4;

async function releaseOpaque(
  deps: ConnectionPullDeps,
  scope: Scope,
  remoteBlobs: Set<string>,
): Promise<ApplyStats> {
  const total: ApplyStats = {
    applied: 0,
    deferred: 0,
    dataClasses: new Set(),
    warnings: [],
  };
  for (let pass = 0; pass < OPAQUE_RELEASE_MAX_PASSES; pass++) {
    const rows = await deps.store.listOpaque(scope);
    if (rows.length === 0) break;
    const resolved = new Set<RecordKey>();
    const stats = await applyRemoteRecords(
      deps,
      scope,
      `opaque:${scope}`,
      rows.map((row) => row.record),
      remoteBlobs,
      resolved,
    );
    total.applied += stats.applied;
    total.deferred += stats.deferred;
    total.warnings.push(...stats.warnings);
    for (const dc of stats.dataClasses) total.dataClasses.add(dc);
    for (const row of rows) {
      if (resolved.has(row.recordKey)) await deps.store.deleteOpaque(row.key);
    }
    const remaining = await deps.store.listOpaque(scope);
    if (remaining.length >= rows.length) break;
  }
  return total;
}

function isRoutingRecord(record: ChangeRecord): boolean {
  if (record.scope !== 'global') return false;
  if (record.dataClass !== 'syncDirectory') return false;
  return ROUTING_RECORD_KEYS.has(record.key) || record.key.startsWith('binding:');
}

async function answerBlobsNeeded(
  deps: ConnectionPullDeps,
  remoteBlobs: Set<string>,
): Promise<void> {
  const entries = await deps.provider.list(deps.connection, BLOBS_NEEDED_PREFIX);
  for (const entry of entries) {
    const hash = blobsNeededHash(entry.path);
    if (hash === null) continue;
    if (remoteBlobs.has(blobPath(hash))) {
      await removeRemoteQuiet(deps, entry.path);
      continue;
    }
    const blob = await deps.blobs.read(hash);
    if (blob === null) continue;
    try {
      await deps.fence();
      await deps.provider.write(deps.connection, blobPath(hash), blob);
      remoteBlobs.add(blobPath(hash));
      await removeRemoteQuiet(deps, entry.path);
    } catch (e) {
      if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
      logger.warn('[sync] failed to answer blobs-needed', hash, e);
    }
  }
}

async function drainDeferred(
  deps: ConnectionPullDeps,
  remoteBlobs: Set<string>,
  appliedScopes: Set<Scope>,
  appliedDataClasses: Set<DataClass>,
): Promise<string[]> {
  const warnings: string[] = [];
  const rows = await deps.store.listDeferred(deps.connection.connectionId);
  for (const row of rows) {
    const missing = row.requiredBlobHashes.filter((hash) => !remoteBlobs.has(blobPath(hash)));
    if (missing.length > 0) {
      const attempts = row.attempts + 1;
      await deps.store.updateDeferred({ ...row, attempts });
      for (const hash of missing) {
        await writeBlobsNeededMarker(deps, hash);
      }
      if (attempts >= DEFERRED_WARNING_CYCLES) {
        warnings.push(
          `record ${row.scope}/${row.recordKey} blocked ${attempts} cycles on ${missing.join(', ')}`,
        );
      }
      continue;
    }
    const stats = await applyRemoteRecords(
      deps,
      row.scope,
      row.sourcePath ?? 'deferred',
      [row.record],
      remoteBlobs,
    );
    if (stats.deferred === 0) {
      await deps.store.deleteDeferred(row.key);
      if (stats.applied > 0) {
        appliedScopes.add(row.scope);
        for (const dc of stats.dataClasses) appliedDataClasses.add(dc);
      }
    } else {
      await deps.store.updateDeferred({ ...row, attempts: row.attempts + 1 });
    }
  }
  return warnings;
}

async function writeBlobsNeededMarker(deps: ConnectionPullDeps, hash: string): Promise<void> {
  try {
    await deps.fence();
    const payload = {
      formatVersion: 1,
      kind: 'blobs-needed',
      hash,
      deviceId: deps.deviceId,
      at: deps.clock.now(),
    };
    await deps.provider.write(
      deps.connection,
      blobsNeededPath(hash),
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    );
  } catch (e) {
    if (e instanceof CycleLockLostError || e instanceof ProviderError) throw e;
    logger.warn('[sync] failed to write blobs-needed marker', hash, e);
  }
}

async function removeRemoteQuiet(deps: ConnectionPullDeps, path: string): Promise<void> {
  try {
    await deps.fence();
    await deps.provider.remove(deps.connection, path);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return;
    throw e;
  }
}

async function listRemoteBlobPaths(deps: ConnectionPullDeps): Promise<Set<string>> {
  const entries = await deps.provider.list(deps.connection, BLOBS_PREFIX);
  return new Set(entries.map((entry) => entry.path));
}

async function readDisconnectMarkerHlc(
  deps: Pick<ConnectionPullDeps, 'provider' | 'connection'>,
): Promise<Hlc | null> {
  let file: Blob;
  try {
    file = await deps.provider.read(deps.connection, DISCONNECT_MARKER_PATH);
  } catch (e) {
    if (e instanceof CycleLockLostError) throw e;
    if (e instanceof ProviderError && e.kind !== 'not-found') throw e;
    return null;
  }
  try {
    const bytes = await blobToBytes(file);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isPlainJsonObject(parsed)) return null;
    const hlc = parsed.hlc;
    if (!isPlainJsonObject(hlc)) return null;
    const { wall, counter, node } = hlc;
    if (typeof wall !== 'number' || typeof counter !== 'number' || typeof node !== 'string') {
      return null;
    }
    return { wall, counter, node };
  } catch {
    return null;
  }
}

export async function isConnectionDisconnected(
  deps: Pick<ConnectionPullDeps, 'provider' | 'connection' | 'kv'>,
): Promise<boolean> {
  const markerHlc = await readDisconnectMarkerHlc(deps);
  if (markerHlc === null) return false;
  const directoryHlc = await connectionDirectoryHlc(deps, deps.connection.connectionId);
  return directoryHlc === null || compareHlc(markerHlc, directoryHlc) > 0;
}

async function connectionDirectoryHlc(
  deps: Pick<ConnectionPullDeps, 'kv'>,
  connectionId: ConnectionId,
): Promise<Hlc | null> {
  const meta = await readSyncMetaKV(deps.kv);
  const row = meta[kvMetaKey('global', `connection:${connectionId}`)];
  return row !== undefined && row.op === 'put' ? row.hlc : null;
}

function describePullError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
