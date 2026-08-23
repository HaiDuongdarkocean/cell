/**
 * Reader repository — IndexedDB persistence for books + progress.
 *
 * DB name: cell-reader, version 1. Two object stores: books (keyPath id),
 * progress (keyPath bookId).
 */

// ─── Schema constants ────────────────────────────────────────────────────────

export const DB_NAME = 'cell-reader';
export const DB_VERSION = 1;

export const STORES = {
  BOOKS: 'books',
  PROGRESS: 'progress',
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
  /** Total time spent reading this book, in milliseconds. */
  readTimeMs?: number;
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

export async function saveBook(record: BookRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.BOOKS, 'readwrite');
  tx.objectStore(STORES.BOOKS).put(record);
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
  const tx = db.transaction([STORES.BOOKS, STORES.PROGRESS], 'readwrite');
  tx.objectStore(STORES.BOOKS).delete(id);
  tx.objectStore(STORES.PROGRESS).delete(id);
  await txDone(tx);
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function saveProgress(record: ReaderProgressRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.PROGRESS, 'readwrite');
  tx.objectStore(STORES.PROGRESS).put(record);
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
