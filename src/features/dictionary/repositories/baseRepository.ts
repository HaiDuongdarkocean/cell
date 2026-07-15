// baseRepository — IndexedDB connection + migration v10 create-all (ADR-023 D1-D2, ADR-037 §7.1).
//
// DB name: orca-dict-{hash8}-en. 4 object stores + 7 indexes.
// Singleton getDB() — 1 connection per lang. Migration create-all only (cell
// fresh DB, no v1-v8 users — ponytail: skip full chain, dead code).

import { getDbHash } from '@/shared/lib/storage/dbHash';

/** IndexedDB schema version (ADR-023 D2 + ADR-037 §7.1 — v10 adds langPhraseIndex). */
export const DB_SCHEMA_VERSION = 11;

/** Object store names. */
export const STORES = {
  RESOURCE: 'langResourceInfo',
  FREQUENCY: 'langFrequencyEntry',
  DICTIONARY: 'langDictionaryEntry',
  PHRASE_INDEX: 'langPhraseIndex',
  WORD_STATUS: 'langWordStatus',
} as const;

/** Index names. */
export const INDEXES = {
  by_signature: 'by_signature',
  by_type: 'by_type',
  by_order: 'by_order',
  by_resource: 'by_resource',
  by_term: 'by_term',
  by_backwardTerm: 'by_backwardTerm',
} as const;

/** Cache of open DB connections by langCode. */
const dbCache = new Map<string, IDBDatabase>();

/** Get DB name for a lang code: orca-dict-{hash}-en. */
export async function getDbName(langCode: string): Promise<string> {
  const hash = await getDbHash();
  return `orca-dict-${hash}-${langCode}`;
}

/** Open (or return cached) IndexedDB connection for a lang code. */
export async function getDB(langCode: string): Promise<IDBDatabase> {
  const cached = dbCache.get(langCode);
  if (cached) return cached;

  const dbName = await getDbName(langCode);
  const db = await openDB(dbName);
  dbCache.set(langCode, db);
  return db;
}

/** Close + clear cached DB connection for a lang code (test cleanup). */
export function closeDB(langCode: string): void {
  const db = dbCache.get(langCode);
  if (db) {
    db.close();
    dbCache.delete(langCode);
  }
}

/** Close all cached DB connections (test cleanup). */
export function closeAllDBs(): void {
  for (const db of dbCache.values()) db.close();
  dbCache.clear();
}

/** Open IndexedDB with migration v9 create-all. */
function openDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_SCHEMA_VERSION);
    request.onupgradeneeded = (_event: IDBVersionChangeEvent) => {
      const db = request.result;
      createAllStores(db);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

/** Create all 4 stores + 7 indexes (ADR-023 D2 + ADR-037 §7.1 — create-all only). */
function createAllStores(db: IDBDatabase): void {
  // langResourceInfo — keyPath 'id' auto, indexes: by_signature, by_type, by_order
  if (!db.objectStoreNames.contains(STORES.RESOURCE)) {
    const resource = db.createObjectStore(STORES.RESOURCE, { keyPath: 'id', autoIncrement: true });
    resource.createIndex(INDEXES.by_signature, 'signature', { unique: false });
    resource.createIndex(INDEXES.by_type, 'type', { unique: false });
    resource.createIndex(INDEXES.by_order, 'importedAt', { unique: false });
  }
  // langFrequencyEntry — keyPath 'id' auto, indexes: by_resource, by_term, by_backwardTerm
  if (!db.objectStoreNames.contains(STORES.FREQUENCY)) {
    const freq = db.createObjectStore(STORES.FREQUENCY, { keyPath: 'id', autoIncrement: true });
    freq.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
    freq.createIndex(INDEXES.by_term, 'term', { unique: false });
    freq.createIndex(INDEXES.by_backwardTerm, 'backwardTerm', { unique: false });
  }
  // langDictionaryEntry — keyPath 'id' auto, indexes: by_resource, by_term, by_backwardTerm
  if (!db.objectStoreNames.contains(STORES.DICTIONARY)) {
    const dict = db.createObjectStore(STORES.DICTIONARY, { keyPath: 'id', autoIncrement: true });
    dict.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
    dict.createIndex(INDEXES.by_term, 'term', { unique: false });
    dict.createIndex(INDEXES.by_backwardTerm, 'backwardTerm', { unique: false });
  }
  // langPhraseIndex — keyPath 'resourceId', index: by_resource (ADR-037 §7.1)
  if (!db.objectStoreNames.contains(STORES.PHRASE_INDEX)) {
    const phrase = db.createObjectStore(STORES.PHRASE_INDEX, { keyPath: 'resourceId' });
    phrase.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
  }
  // langWordStatus — keyPath 'term' (unique), index: by_status (spec §D1)
  if (!db.objectStoreNames.contains(STORES.WORD_STATUS)) {
    const ws = db.createObjectStore(STORES.WORD_STATUS, { keyPath: 'term' });
    ws.createIndex('by_status', 'status', { unique: false });
  }
}

/** Open a transaction for 1 store (readwrite default). */
export function getStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode = 'readwrite',
): IDBObjectStore {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/** Wait for a transaction to complete (raw IDBTransaction has no .done promise). */
export function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Reverse a string for backwardTerm index (suffix search via prefix). */
export function reverseString(s: string): string {
  return s.split('').reverse().join('');
}

/** Delete an entire database (test cleanup). */
export async function deleteDB(dbName: string): Promise<void> {
  closeAllDBs();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}

/** Clear all 4 stores for a lang (test isolation — call in beforeEach). */
export async function clearAllStores(langCode: string): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RESOURCE, STORES.FREQUENCY, STORES.DICTIONARY, STORES.PHRASE_INDEX, STORES.WORD_STATUS], 'readwrite');
    tx.objectStore(STORES.RESOURCE).clear();
    tx.objectStore(STORES.FREQUENCY).clear();
    tx.objectStore(STORES.DICTIONARY).clear();
    tx.objectStore(STORES.PHRASE_INDEX).clear();
    tx.objectStore(STORES.WORD_STATUS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
