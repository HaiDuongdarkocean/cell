import type { ChangeRecord, ConnectionId, RecordKey, Scope } from '../../domain/types';

export const SYNC_DB_NAME = 'cell-sync';
export const SYNC_DB_SCHEMA_VERSION = 1;

export const SYNC_STORES = {
  SEQUENCES: 'sequences',
  PENDING_BATCHES: 'pendingBatches',
  DEFERRED_RECORDS: 'deferredRecords',
  OPAQUE_RECORDS: 'opaqueRecords',
} as const;

export const SYNC_INDEXES = {
  by_connection: 'by_connection',
  by_connection_scope: 'by_connection_scope',
  by_createdAt: 'by_createdAt',
  by_blobHash: 'by_blobHash',
  by_scope: 'by_scope',
} as const;

export interface SequenceCounters {
  key: string;
  nextSeq: number;
  nextSnapshotN: number;
}

export interface PendingBatch {
  key: string;
  connectionId: ConnectionId;
  scope: Scope;
  seq: number;
  records: ChangeRecord[];
  cycleId: string;
  createdAt: number;
}

export interface DeferredRecordRow {
  key: string;
  connectionId: ConnectionId;
  scope: Scope;
  recordKey: RecordKey;
  sourcePath?: string;
  record: ChangeRecord;
  requiredBlobHashes: string[];
  firstDeferredAt: number;
  attempts: number;
}

export interface OpaqueRecordRow {
  key: string;
  scope: Scope;
  recordKey: RecordKey;
  record: ChangeRecord;
}

export interface FreezeBatchInput {
  connectionId: ConnectionId;
  scope: Scope;
  records: ChangeRecord[];
  cycleId: string;
  createdAt: number;
}

export interface DeferredRecordInput {
  connectionId: ConnectionId;
  sourcePath?: string;
  record: ChangeRecord;
  requiredBlobHashes: string[];
  firstDeferredAt: number;
  attempts: number;
}

let cachedDb: IDBDatabase | undefined;

export async function getSyncDB(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb;
  const db = await openSyncDB();
  db.onversionchange = () => {
    db.close();
    if (cachedDb === db) cachedDb = undefined;
  };
  cachedDb = db;
  return db;
}

export function closeSyncDB(): void {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = undefined;
  }
}

export async function deleteSyncDB(): Promise<void> {
  closeSyncDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(SYNC_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}

export function awaitSyncTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function sequenceKey(connectionId: ConnectionId, scope: Scope): string {
  return `${connectionId}|${scope}`;
}

export function pendingBatchKey(connectionId: ConnectionId, scope: Scope, seq: number): string {
  return `${connectionId}|${scope}|${seq}`;
}

export function deferredRecordKey(
  connectionId: ConnectionId,
  scope: Scope,
  recordKey: RecordKey,
): string {
  return `${connectionId}|${scope}|${recordKey}`;
}

export function opaqueRecordKey(scope: Scope, recordKey: RecordKey): string {
  return `${scope}|${recordKey}`;
}

export async function getSequenceCounters(
  connectionId: ConnectionId,
  scope: Scope,
): Promise<SequenceCounters | undefined> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.SEQUENCES, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.SEQUENCES)
    .get(sequenceKey(connectionId, scope)) as IDBRequest<SequenceCounters | undefined>;
  return requestToPromise(request);
}

export async function nextSeqFor(connectionId: ConnectionId, scope: Scope): Promise<number> {
  const row = await getSequenceCounters(connectionId, scope);
  return row?.nextSeq ?? 1;
}

export async function nextSnapshotNFor(connectionId: ConnectionId, scope: Scope): Promise<number> {
  const row = await getSequenceCounters(connectionId, scope);
  return row?.nextSnapshotN ?? 1;
}

export function allocateSeq(
  connectionId: ConnectionId,
  scope: Scope,
  tx: IDBTransaction,
): Promise<number> {
  return allocateCounter(connectionId, scope, tx, 'nextSeq');
}

export function allocateSnapshotN(
  connectionId: ConnectionId,
  scope: Scope,
  tx: IDBTransaction,
): Promise<number> {
  return allocateCounter(connectionId, scope, tx, 'nextSnapshotN');
}

export async function freezeBatch(input: FreezeBatchInput): Promise<PendingBatch> {
  const db = await getSyncDB();
  const tx = db.transaction(
    [SYNC_STORES.SEQUENCES, SYNC_STORES.PENDING_BATCHES],
    'readwrite',
  );
  const batch = await freezeBatchInTx(input, tx);
  await awaitSyncTx(tx);
  return batch;
}

export async function freezeBatchInTx(
  input: FreezeBatchInput,
  tx: IDBTransaction,
): Promise<PendingBatch> {
  const seq = await allocateSeq(input.connectionId, input.scope, tx);
  const batch: PendingBatch = {
    key: pendingBatchKey(input.connectionId, input.scope, seq),
    connectionId: input.connectionId,
    scope: input.scope,
    seq,
    records: input.records,
    cycleId: input.cycleId,
    createdAt: input.createdAt,
  };
  await requestToPromise(tx.objectStore(SYNC_STORES.PENDING_BATCHES).put(batch));
  return batch;
}

export async function getPendingBatch(key: string): Promise<PendingBatch | undefined> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.PENDING_BATCHES)
    .get(key) as IDBRequest<PendingBatch | undefined>;
  return requestToPromise(request);
}

export async function getPendingBatchForScope(
  connectionId: ConnectionId,
  scope: Scope,
): Promise<PendingBatch | undefined> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.PENDING_BATCHES)
    .index(SYNC_INDEXES.by_connection_scope)
    .getAll([connectionId, scope]) as IDBRequest<PendingBatch[]>;
  const rows = await requestToPromise(request);
  return rows[0];
}

export async function takePendingBatches(connectionId: ConnectionId): Promise<PendingBatch[]> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.PENDING_BATCHES)
    .index(SYNC_INDEXES.by_connection)
    .getAll(connectionId) as IDBRequest<PendingBatch[]>;
  const rows = await requestToPromise(request);
  return rows.sort(comparePendingBatches);
}

export async function listPendingBatchesByCreatedAt(
  connectionId?: ConnectionId,
): Promise<PendingBatch[]> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.PENDING_BATCHES)
    .index(SYNC_INDEXES.by_createdAt)
    .getAll() as IDBRequest<PendingBatch[]>;
  const rows = await requestToPromise(request);
  if (connectionId === undefined) return rows;
  return rows.filter((row) => row.connectionId === connectionId);
}

export async function putPendingBatch(batch: PendingBatch): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.PENDING_BATCHES).put(batch));
  await awaitSyncTx(tx);
}

export async function removePendingBatch(key: string): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.PENDING_BATCHES, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.PENDING_BATCHES).delete(key));
  await awaitSyncTx(tx);
}

export async function putDeferredRecord(input: DeferredRecordInput): Promise<DeferredRecordRow> {
  const row: DeferredRecordRow = {
    key: deferredRecordKey(input.connectionId, input.record.scope, input.record.key),
    connectionId: input.connectionId,
    scope: input.record.scope,
    recordKey: input.record.key,
    sourcePath: input.sourcePath,
    record: input.record,
    requiredBlobHashes: input.requiredBlobHashes,
    firstDeferredAt: input.firstDeferredAt,
    attempts: input.attempts,
  };
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.DEFERRED_RECORDS).put(row));
  await awaitSyncTx(tx);
  return row;
}

export async function getDeferredRecord(key: string): Promise<DeferredRecordRow | undefined> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.DEFERRED_RECORDS)
    .get(key) as IDBRequest<DeferredRecordRow | undefined>;
  return requestToPromise(request);
}

export async function getAllDeferredRecords(
  connectionId?: ConnectionId,
): Promise<DeferredRecordRow[]> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readonly');
  const store = tx.objectStore(SYNC_STORES.DEFERRED_RECORDS);
  const request = (connectionId === undefined
    ? store.getAll()
    : store.index(SYNC_INDEXES.by_connection).getAll(connectionId)) as IDBRequest<
    DeferredRecordRow[]
  >;
  return requestToPromise(request);
}

export async function findDeferredRecordsByBlobHash(
  contentHash: string,
): Promise<DeferredRecordRow[]> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.DEFERRED_RECORDS)
    .index(SYNC_INDEXES.by_blobHash)
    .getAll(contentHash) as IDBRequest<DeferredRecordRow[]>;
  return requestToPromise(request);
}

export async function deleteDeferredRecord(key: string): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.DEFERRED_RECORDS).delete(key));
  await awaitSyncTx(tx);
}

export async function clearDeferredRecords(): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.DEFERRED_RECORDS, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.DEFERRED_RECORDS).clear());
  await awaitSyncTx(tx);
}

export async function putOpaqueRecord(record: ChangeRecord): Promise<OpaqueRecordRow> {
  const row: OpaqueRecordRow = {
    key: opaqueRecordKey(record.scope, record.key),
    scope: record.scope,
    recordKey: record.key,
    record,
  };
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.OPAQUE_RECORDS, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.OPAQUE_RECORDS).put(row));
  await awaitSyncTx(tx);
  return row;
}

export async function getOpaqueRecord(key: string): Promise<OpaqueRecordRow | undefined> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.OPAQUE_RECORDS, 'readonly');
  const request = tx
    .objectStore(SYNC_STORES.OPAQUE_RECORDS)
    .get(key) as IDBRequest<OpaqueRecordRow | undefined>;
  return requestToPromise(request);
}

export async function getAllOpaqueRecords(scope?: Scope): Promise<OpaqueRecordRow[]> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.OPAQUE_RECORDS, 'readonly');
  const store = tx.objectStore(SYNC_STORES.OPAQUE_RECORDS);
  const request = (scope === undefined
    ? store.getAll()
    : store.index(SYNC_INDEXES.by_scope).getAll(scope)) as IDBRequest<OpaqueRecordRow[]>;
  return requestToPromise(request);
}

export async function deleteOpaqueRecord(key: string): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.OPAQUE_RECORDS, 'readwrite');
  await requestToPromise(tx.objectStore(SYNC_STORES.OPAQUE_RECORDS).delete(key));
  await awaitSyncTx(tx);
}

export async function clearOpaqueRecords(scope?: Scope): Promise<void> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.OPAQUE_RECORDS, 'readwrite');
  const store = tx.objectStore(SYNC_STORES.OPAQUE_RECORDS);
  if (scope === undefined) {
    await requestToPromise(store.clear());
    await awaitSyncTx(tx);
    return;
  }
  const keysRequest = store
    .index(SYNC_INDEXES.by_scope)
    .getAllKeys(scope) as IDBRequest<IDBValidKey[]>;
  const keys = await requestToPromise(keysRequest);
  for (const key of keys) {
    await requestToPromise(store.delete(key));
  }
  await awaitSyncTx(tx);
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      createAllSyncStores(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function createAllSyncStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(SYNC_STORES.SEQUENCES)) {
    db.createObjectStore(SYNC_STORES.SEQUENCES, { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains(SYNC_STORES.PENDING_BATCHES)) {
    const store = db.createObjectStore(SYNC_STORES.PENDING_BATCHES, { keyPath: 'key' });
    store.createIndex(SYNC_INDEXES.by_connection, 'connectionId', { unique: false });
    store.createIndex(SYNC_INDEXES.by_connection_scope, ['connectionId', 'scope'], {
      unique: false,
    });
    store.createIndex(SYNC_INDEXES.by_createdAt, 'createdAt', { unique: false });
  }
  if (!db.objectStoreNames.contains(SYNC_STORES.DEFERRED_RECORDS)) {
    const store = db.createObjectStore(SYNC_STORES.DEFERRED_RECORDS, { keyPath: 'key' });
    store.createIndex(SYNC_INDEXES.by_connection, 'connectionId', { unique: false });
    store.createIndex(SYNC_INDEXES.by_blobHash, 'requiredBlobHashes', {
      unique: false,
      multiEntry: true,
    });
  }
  if (!db.objectStoreNames.contains(SYNC_STORES.OPAQUE_RECORDS)) {
    const store = db.createObjectStore(SYNC_STORES.OPAQUE_RECORDS, { keyPath: 'key' });
    store.createIndex(SYNC_INDEXES.by_scope, 'scope', { unique: false });
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allocateCounter(
  connectionId: ConnectionId,
  scope: Scope,
  tx: IDBTransaction,
  field: 'nextSeq' | 'nextSnapshotN',
): Promise<number> {
  const store = tx.objectStore(SYNC_STORES.SEQUENCES);
  const key = sequenceKey(connectionId, scope);
  const request = store.get(key) as IDBRequest<SequenceCounters | undefined>;
  const existing = await requestToPromise(request);
  const value = existing ? existing[field] : 1;
  const row: SequenceCounters = {
    key,
    nextSeq: field === 'nextSeq' ? value + 1 : existing?.nextSeq ?? 1,
    nextSnapshotN: field === 'nextSnapshotN' ? value + 1 : existing?.nextSnapshotN ?? 1,
  };
  await requestToPromise(store.put(row));
  return value;
}

function comparePendingBatches(a: PendingBatch, b: PendingBatch): number {
  if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
  return a.seq - b.seq;
}
