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
  readRecordMeta,
  scopeForTarget,
  targetOf,
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

function createStores(db: IDBDatabase): void {
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
    db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => createStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB();
  return dbInstance;
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

export async function saveBook(record: BookRecord): Promise<void> {
  const db = await getDB();
  await ensureSyncRuntime();
  const tx = db.transaction([STORES.BOOKS, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
  const store = tx.objectStore(STORES.BOOKS);
  store.put(record);
  if (isCaptureEnabled()) {
    await captureChange(store, { scope: bookScope(record), dataClass: 'readerBook', key: `book:${record.id}`, op: 'put' });
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
  let scope: Scope | null = null;
  if (isCaptureEnabled()) {
    const book = (await reqToPromise(store.get(id))) as BookRecord | undefined;
    if (book) scope = bookScope(book);
    if (!scope) {
      scope = (await readRecordMeta(store, `book:${id}`))?.scope ?? null;
    }
  }
  store.delete(id);
  tx.objectStore(STORES.PROGRESS).delete(id);
  if (scope) {
    await captureChange(store, { scope, dataClass: 'readerBook', key: `book:${id}`, op: 'delete' });
    await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${id}/position`, op: 'delete' });
    const deviceId = getDeviceId();
    if (deviceId) {
      await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${id}/readTime/${deviceId}`, op: 'delete' });
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
  let next = record;
  const deviceId = getDeviceId();
  if (isCaptureEnabled() && deviceId && record.readTimeMs !== undefined) {
    const prev = (await reqToPromise(store.get(record.bookId))) as ReaderProgressRecord | undefined;
    next = { ...record, readTimeByDevice: { ...prev?.readTimeByDevice, [deviceId]: record.readTimeMs } };
  }
  store.put(next);
  if (isCaptureEnabled()) {
    const book = (await reqToPromise(tx.objectStore(STORES.BOOKS).get(record.bookId))) as BookRecord | undefined;
    const scope = book ? bookScope(book) : (await readRecordMeta(store, `progress:${record.bookId}/position`))?.scope ?? null;
    if (scope) {
      await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${record.bookId}/position`, op: 'put' });
      if (deviceId && next.readTimeByDevice?.[deviceId] !== undefined) {
        await captureChange(store, { scope, dataClass: 'readerProgress', key: `progress:${record.bookId}/readTime/${deviceId}`, op: 'put' });
      }
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
