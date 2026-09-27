import { getStorage } from '@/shared/lib/chrome-apis';
import { HybridClock } from '../../../domain/hlc';
import type { ChangeOp, DataClass, Hlc, RecordKey, Scope } from '../../../domain/types';

export const SYNC_OUTBOX = 'syncOutbox';
export const SYNC_META = 'syncMeta';
export const SYNC_CAPTURE_STORES: readonly string[] = [SYNC_OUTBOX, SYNC_META];

export interface CaptureInput {
  readonly scope: Scope;
  readonly dataClass: DataClass;
  readonly key: RecordKey;
  readonly op: ChangeOp;
  readonly valueHash?: string;
}

export interface StoredRecordMeta {
  readonly key: RecordKey;
  readonly scope: Scope;
  readonly hlc: Hlc;
  readonly firstHlc?: Hlc;
  readonly op: ChangeOp;
  readonly valueHash?: string;
}

interface SyncRuntime {
  readonly enabled: boolean;
  readonly deviceId: string;
  readonly clock: HybridClock;
}

let runtime: SyncRuntime | null = null;
let initPromise: Promise<SyncRuntime> | null = null;

export function configureSyncRuntime(opts: {
  enabled: boolean;
  deviceId: string;
  lastWall?: number;
}): void {
  runtime = {
    enabled: opts.enabled,
    deviceId: opts.deviceId,
    clock: new HybridClock(opts.deviceId, Date.now, opts.lastWall ?? 0),
  };
  initPromise = Promise.resolve(runtime);
}

export function resetSyncRuntime(): void {
  runtime = null;
  initPromise = null;
}

export function getDeviceId(): string | null {
  return runtime?.deviceId ?? null;
}

export function isCaptureEnabled(): boolean {
  return runtime?.enabled === true;
}

export async function ensureSyncRuntime(): Promise<SyncRuntime> {
  if (runtime) return runtime;
  if (!initPromise) initPromise = loadRuntime();
  return initPromise;
}

export async function mintRecordHlc(): Promise<Hlc> {
  const rt = await ensureSyncRuntime();
  return rt.clock.tick();
}

async function loadRuntime(): Promise<SyncRuntime> {
  try {
    const data = await getStorage<Record<string, unknown>>(['syncState']);
    const state = data['syncState'] as
      | { deviceId?: string; connections?: unknown[]; lastWall?: number }
      | undefined;
    const deviceId = typeof state?.deviceId === 'string' ? state.deviceId : 'uninitialized';
    runtime = {
      enabled: Array.isArray(state?.connections) && state.connections.length > 0,
      deviceId,
      clock: new HybridClock(deviceId, Date.now, state?.lastWall ?? 0),
    };
  } catch {
    runtime = { enabled: false, deviceId: 'unavailable', clock: new HybridClock('unavailable') };
  }
  return runtime;
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function readRecordMeta(
  store: IDBObjectStore,
  key: RecordKey,
): Promise<StoredRecordMeta | undefined> {
  return idbReq(store.transaction.objectStore(SYNC_META).get(key) as IDBRequest<StoredRecordMeta | undefined>);
}

export async function captureChange(store: IDBObjectStore, rec: CaptureInput): Promise<void> {
  if (!runtime?.enabled) return;
  const tx = store.transaction;
  const metaStore = tx.objectStore(SYNC_META);
  const prev = await readRecordMeta(store, rec.key);
  const hlc = runtime.clock.tick();
  const firstHlc =
    rec.op === 'put' && prev?.op !== 'put' ? hlc : prev?.firstHlc ?? prev?.hlc ?? hlc;
  const meta: StoredRecordMeta = {
    key: rec.key,
    scope: rec.scope,
    hlc,
    firstHlc,
    op: rec.op,
    valueHash: rec.valueHash ?? prev?.valueHash,
  };
  metaStore.put(meta);
  tx.objectStore(SYNC_OUTBOX).add({
    scope: rec.scope,
    dataClass: rec.dataClass,
    key: rec.key,
    op: rec.op,
  });
}

export async function captureAll(store: IDBObjectStore, recs: readonly CaptureInput[]): Promise<void> {
  for (const rec of recs) await captureChange(store, rec);
}

export async function stampRemoteMeta(
  store: IDBObjectStore,
  key: RecordKey,
  meta: { scope: Scope; hlc: Hlc; firstHlc?: Hlc; op: ChangeOp; valueHash?: string },
): Promise<void> {
  const metaStore = store.transaction.objectStore(SYNC_META);
  const prev = await readRecordMeta(store, key);
  const next: StoredRecordMeta = {
    key,
    scope: meta.scope,
    hlc: meta.hlc,
    firstHlc: meta.firstHlc ?? meta.hlc,
    op: meta.op,
    valueHash: meta.valueHash ?? prev?.valueHash,
  };
  metaStore.put(next);
  runtime?.clock.observe(meta.hlc);
}

export async function listMetaKeysByPrefix(
  store: IDBObjectStore,
  prefix: string,
): Promise<StoredRecordMeta[]> {
  const metaStore = store.transaction.objectStore(SYNC_META);
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
  return (await idbReq(metaStore.getAll(range) as IDBRequest<StoredRecordMeta[]>)) ?? [];
}
