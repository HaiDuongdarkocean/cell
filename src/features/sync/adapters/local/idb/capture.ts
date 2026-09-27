import { getSessionStorage, getStorage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { HybridClock } from '../../../domain/hlc';
import type { ChangeOp, DataClass, Hlc, RecordKey, Scope } from '../../../domain/types';

export const SYNC_OUTBOX = 'syncOutbox';
export const SYNC_META = 'syncMeta';
export const SYNC_CAPTURE_STORES: readonly string[] = [SYNC_OUTBOX, SYNC_META];

export interface CaptureInput {
  readonly scope: Scope | null;
  readonly dataClass: DataClass;
  readonly key: RecordKey;
  readonly op: ChangeOp;
  readonly valueHash?: string;
}

export interface StoredRecordMeta {
  readonly key: string;
  readonly recKey: RecordKey;
  readonly scope: Scope | null;
  readonly hlc: Hlc;
  readonly firstHlc?: Hlc;
  readonly op: ChangeOp;
  readonly valueHash?: string;
}

interface SyncRuntime {
  enabled: boolean;
  readonly deviceId: string;
  readonly contextId: string;
  readonly clock: HybridClock;
}

const INVALID_DEVICE_IDS = new Set(['uninitialized', 'unavailable']);

function newContextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let runtime: SyncRuntime | null = null;
let initPromise: Promise<SyncRuntime> | null = null;
let watching = false;

export function configureSyncRuntime(opts: {
  enabled: boolean;
  deviceId: string;
  lastWall?: number;
}): void {
  const contextId = newContextId();
  runtime = {
    enabled: opts.enabled,
    deviceId: opts.deviceId,
    contextId,
    clock: new HybridClock(`${opts.deviceId}:${contextId}`, Date.now, opts.lastWall ?? 0),
  };
  initPromise = Promise.resolve(runtime);
}

export function resetSyncRuntime(): void {
  runtime = null;
  initPromise = null;
  watching = false;
}

export function getDeviceId(): string | null {
  const id = runtime?.deviceId;
  return id && !INVALID_DEVICE_IDS.has(id) ? id : null;
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
  const contextId = newContextId();
  try {
    const data = await getStorage<Record<string, unknown>>(['syncState']);
    const session = await getSessionStorage<Record<string, unknown>>(['syncClockWall']);
    const state = data['syncState'] as
      | { deviceId?: string; connections?: unknown[] }
      | undefined;
    const deviceId = typeof state?.deviceId === 'string' ? state.deviceId : 'uninitialized';
    const sessionWall = typeof session['syncClockWall'] === 'number' ? session['syncClockWall'] : 0;
    runtime = {
      enabled: Array.isArray(state?.connections) && state.connections.length > 0,
      deviceId,
      contextId,
      clock: new HybridClock(`${deviceId}:${contextId}`, Date.now, sessionWall),
    };
  } catch {
    runtime = {
      enabled: false,
      deviceId: 'unavailable',
      contextId,
      clock: new HybridClock(`unavailable:${contextId}`),
    };
  }
  watchSyncKeys();
  return runtime;
}

function watchSyncKeys(): void {
  if (watching) return;
  watching = true;
  onStorageChanged((changes, area) => {
    if (!runtime) return;
    if (area === 'session' && changes['syncClockWall']) {
      const wall = changes['syncClockWall'].newValue;
      if (typeof wall === 'number') runtime.clock.seedWall(wall);
    }
    if (area === 'local' && changes['syncState']) {
      const state = changes['syncState'].newValue as { connections?: unknown[] } | undefined;
      runtime.enabled = Array.isArray(state?.connections) && state.connections.length > 0;
    }
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function metaPk(scope: Scope | null, key: RecordKey): string {
  return `${scope ?? ''}|${key}`;
}

export function readRecordMeta(
  store: IDBObjectStore,
  key: RecordKey,
  scope?: Scope | null,
): Promise<StoredRecordMeta | undefined> {
  const tx = store.transaction;
  if (scope !== undefined) {
    return idbReq(tx.objectStore(SYNC_META).get(metaPk(scope, key)) as IDBRequest<StoredRecordMeta | undefined>);
  }
  const index = tx.objectStore(SYNC_META).index('by_recKey');
  return idbReq(index.get(key) as IDBRequest<StoredRecordMeta | undefined>);
}

export async function captureChange(store: IDBObjectStore, rec: CaptureInput): Promise<void> {
  if (!runtime?.enabled) return;
  const tx = store.transaction;
  const metaStore = tx.objectStore(SYNC_META);
  const prev = await readRecordMeta(store, rec.key, rec.scope);
  const hlc = runtime.clock.tick();
  const firstHlc =
    rec.op === 'put' && prev?.op !== 'put' ? hlc : prev?.firstHlc ?? prev?.hlc ?? hlc;
  const meta: StoredRecordMeta = {
    key: metaPk(rec.scope, rec.key),
    recKey: rec.key,
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
  const prev = await readRecordMeta(store, key, meta.scope);
  const next: StoredRecordMeta = {
    key: metaPk(meta.scope, key),
    recKey: key,
    scope: meta.scope,
    hlc: meta.hlc,
    firstHlc: meta.firstHlc ?? prev?.firstHlc ?? meta.hlc,
    op: meta.op,
    valueHash: meta.valueHash ?? prev?.valueHash,
  };
  metaStore.put(next);
  runtime?.clock.observe(meta.hlc);
}

export async function listMetaByKey(
  store: IDBObjectStore,
  key: RecordKey,
): Promise<StoredRecordMeta[]> {
  const index = store.transaction.objectStore(SYNC_META).index('by_recKey');
  return (await idbReq(index.getAll(key) as IDBRequest<StoredRecordMeta[]>)) ?? [];
}

export async function listMetaKeysByPrefix(
  store: IDBObjectStore,
  prefix: string,
): Promise<StoredRecordMeta[]> {
  const index = store.transaction.objectStore(SYNC_META).index('by_recKey');
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
  return (await idbReq(index.getAll(range) as IDBRequest<StoredRecordMeta[]>)) ?? [];
}

export function createSyncMetaStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(SYNC_META)) {
    const store = db.createObjectStore(SYNC_META, { keyPath: 'key' });
    store.createIndex('by_recKey', 'recKey', { unique: false });
  }
}

export function createSyncOutboxStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(SYNC_OUTBOX)) {
    const store = db.createObjectStore(SYNC_OUTBOX, { autoIncrement: true });
    store.createIndex('by_key', 'key', { unique: false });
  }
}
