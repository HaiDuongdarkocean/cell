/**
 * Reader repository — IndexedDB persistence for books + progress.
 *
 * DB name: cell-reader, version 2. Object stores: books (keyPath id),
 * progress (keyPath bookId), syncOutbox, syncMeta.
 */

import {
  captureChange,
  ensureSyncRuntime,
  getDeviceId,
  isCaptureEnabled,
  listMetaKeysByPrefix,
  readRecordMeta,
  scopeForTarget,
  targetOf,
  type CaptureInput,
  type Scope,
} from '@/features/sync';

// ─── Schema constants ────────────────────────────────────────────────────────

export const DB_NAME = 'cell-reader';
export const DB_VERSION = 2;

export const STORES = {
  BOOKS: 'books',
  PROGRESS: 'progress',
  SYNC_OUTBOX: 'syncOutbox',
  SYNC_META: 'syncMeta',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookRecord {
  id: string;
  filename: string;
  title: string;
  languageCode: string | null;
  paragraphs: readonly string[];
  addedAt: string;
  lastReadAt: string;
}

export interface ReaderProgressRecord {
  bookId: string;
  paragraphIndex: number;
  tokenIndex: number;
  updatedAt: string;
  /** Total time spent reading this book on this device, in milliseconds. */
  readTimeMs?: number;
  /** Per-device read-time buckets (grow-only merge unit for sync). */
  readTimeByDevice?: Record<string, number>;
}

// ─── DB connection (singleton) ───────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;

function createStores(db: IDBDatabase, tx?: IDBTransaction): void {
  if (!db.objectStoreNames.contains(STORES.BOOKS)) {
    db.createObjectStore(STORES.BOOKS, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
    db.createObjectStore(STORES.PROGRESS, { keyPath: 'bookId' });
  }
  if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
    const outbox = db.createObjectStore(STORES.SYNC_OUTBOX, { autoIncrement: true });
    outbox.createIndex('by_key', 'key', { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
    const store = db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
    store.createIndex('by_recKey', 'recKey', { unique: false });
  } else if (tx) {
    const store = tx.objectStore(STORES.SYNC_META);
    if (!store.indexNames.contains('by_recKey')) {
      store.createIndex('by_recKey', 'recKey', { unique: false });
    }
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => createStores(request.result, request.transaction ?? undefined);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB();
  dbInstance.onversionchange = () => {
    dbInstance?.close();
    dbInstance = null;
  };
  return dbInstance;
}

export async function getReaderDB(): Promise<IDBDatabase> {
  return getDB();
}

// ─── IDB request helpers ─────────────────────────────────────────────────────

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ─── Book CRUD ───────────────────────────────────────────────────────────────

function bookScope(record: BookRecord): Scope {
  return record.languageCode ? scopeForTarget(targetOf(record.languageCode)) : 'global';
}

type BookFieldKey = 'title' | 'filename' | 'languageCode';
const BOOK_FIELD_KEYS: readonly BookFieldKey[] = ['title', 'filename', 'languageCode'];

function bookFieldCapture(scope: Scope | null, bookId: string, field: BookFieldKey, value: unknown): CaptureInput {
  const absent = value === null || value === undefined;
  return {
    scope,
    dataClass: 'readerBook',
    key: `book:${bookId}/${field}`,
    op: absent ? 'delete' : 'put',
  };
}

export async function saveBook(record: BookRecord): Promise<void> {
  const db = await getDB();
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.BOOKS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const store = tx.objectStore(STORES.BOOKS);
  const prev = isCaptureEnabled()
    ? ((await reqToPromise(store.get(record.id))) as BookRecord | undefined)
    : undefined;
  store.put(record);
  if (isCaptureEnabled()) {
    const scope = bookScope(record);
    const prevScope = prev ? bookScope(prev) : null;
    await captureChange(store, { scope, dataClass: 'readerBook', key: `book:${record.id}`, op: 'put' });
    for (const field of BOOK_FIELD_KEYS) {
      if (prev && prev[field] === record[field]) continue;
      if (!prev && (record[field] === null || record[field] === undefined)) continue;
      await captureChange(store, bookFieldCapture(scope, record.id, field, record[field]));
    }
    if (prevScope && prevScope !== scope) {
      await captureChange(store, { scope: prevScope, dataClass: 'readerBook', key: `book:${record.id}`, op: 'delete' });
      for (const meta of await listMetaKeysByPrefix(store, `book:${record.id}/`)) {
        if (meta.scope === prevScope) {
          await captureChange(store, { scope: prevScope, dataClass: 'readerBook', key: meta.recKey, op: 'delete' });
        }
      }
    }
  }
  await txDone(tx);
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.BOOKS, 'readonly');
  return reqToPromise(tx.objectStore(STORES.BOOKS).get(id)) as Promise<BookRecord | undefined>;
}

export async function getAllBooks(): Promise<BookRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.BOOKS, 'readonly');
  return (await reqToPromise(tx.objectStore(STORES.BOOKS).getAll())) as BookRecord[];
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.BOOKS, STORES.PROGRESS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const store = tx.objectStore(STORES.BOOKS);
  const tombstones = new Map<string, Set<string>>();
  const addTombstone = (s: string, key: string): void => {
    const keys = tombstones.get(s) ?? new Set<string>();
    keys.add(key);
    tombstones.set(s, keys);
  };
  if (isCaptureEnabled()) {
    const book = (await reqToPromise(store.get(id))) as BookRecord | undefined;
    const metaScope = book
      ? bookScope(book)
      : (await readRecordMeta(store, `book:${id}`))?.scope ?? null;
    const scope = metaScope ?? 'global';
    addTombstone(scope, `book:${id}`);
    for (const field of BOOK_FIELD_KEYS) addTombstone(scope, `book:${id}/${field}`);
    addTombstone(scope, `progress:${id}/position`);
    const deviceId = getDeviceId();
    if (deviceId) addTombstone(scope, `progress:${id}/readTime/${deviceId}`);
    for (const meta of await listMetaKeysByPrefix(store, `book:${id}/`)) {
      addTombstone(meta.scope ?? scope, meta.recKey);
    }
    for (const meta of await listMetaKeysByPrefix(store, `progress:${id}/`)) {
      addTombstone(meta.scope ?? scope, meta.recKey);
    }
  }
  store.delete(id);
  tx.objectStore(STORES.PROGRESS).delete(id);
  for (const [s, keys] of tombstones) {
    for (const recKey of keys) {
      await captureChange(store, {
        scope: s as Scope,
        dataClass: recKey.startsWith('book:') ? 'readerBook' : 'readerProgress',
        key: recKey,
        op: 'delete',
      });
    }
  }
  await txDone(tx);
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function saveProgress(record: ReaderProgressRecord): Promise<void> {
  const db = await getDB();
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.PROGRESS, STORES.BOOKS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const store = tx.objectStore(STORES.PROGRESS);
  const deviceId = getDeviceId();
  let next = record;
  let scope: Scope | null = null;
  if (isCaptureEnabled()) {
    const prev = (await reqToPromise(store.get(record.bookId))) as ReaderProgressRecord | undefined;
    if (deviceId && record.readTimeMs !== undefined) {
      const prevBuckets = prev?.readTimeByDevice;
      const ownPrev = prevBuckets?.[deviceId] ?? (prevBuckets ? 0 : prev?.readTimeMs ?? 0);
      const delta = Math.max(0, record.readTimeMs - (prev?.readTimeMs ?? 0));
      next = {
        ...record,
        readTimeByDevice: { ...prev?.readTimeByDevice, [deviceId]: ownPrev + delta },
      };
    }
    const book = (await reqToPromise(tx.objectStore(STORES.BOOKS).get(record.bookId))) as BookRecord | undefined;
    scope = book
      ? bookScope(book)
      : (await readRecordMeta(store, `progress:${record.bookId}/position`))?.scope ?? null;
  }
  store.put(next);
  if (isCaptureEnabled()) {
    await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${record.bookId}/position`, op: 'put' });
    if (deviceId && next.readTimeByDevice?.[deviceId] !== undefined) {
      await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${record.bookId}/readTime/${deviceId}`, op: 'put' });
    }
  }
  await txDone(tx);
}

export async function getProgress(bookId: string): Promise<ReaderProgressRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.PROGRESS, 'readonly');
  return reqToPromise(tx.objectStore(STORES.PROGRESS).get(bookId)) as Promise<ReaderProgressRecord | undefined>;
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
