// srsDatabase — IndexedDB bootstrap cho Ocean SRS (cell-srs-{hash}).
//
// DB name: cell-srs-{hash}. Singleton getSrsDB() với cache per runtime.
// V1 schema version = 1. onupgradeneeded create-all.

import { getDbHash } from '@/shared/lib/storage/dbHash';

/** IndexedDB schema version cho SRS V1. */
export const SRS_DB_SCHEMA_VERSION = 1;

/** Object store names. */
export const SRS_STORES = {
  COLLECTIONS: 'collections',
  DECKS: 'decks',
  STUDY_CONFIGS: 'studyConfigs',
  NOTETYPES: 'notetypes',
  NOTES: 'notes',
  CARDS: 'cards',
  AUDIO_ASSETS: 'audioAssets',
  IMAGE_ASSETS: 'imageAssets',
  REVIEW_EVENTS: 'reviewEvents',
} as const;

/** Index names. */
export const SRS_INDEXES = {
  by_languageProfileId: 'by_languageProfileId',
  by_collection: 'by_collection',
  by_parent: 'by_parent',
  by_notetype: 'by_notetype',
  by_deck: 'by_deck',
  by_note: 'by_note',
  by_deck_due: 'by_deck_due',
  by_card: 'by_card',
  by_component: 'by_component',
  by_timestamp: 'by_timestamp',
} as const;

/** Cache of open DB connections. */
const dbCache = new Map<string, IDBDatabase>();

/** Get DB name for the current runtime hash. */
export async function getSrsDbName(): Promise<string> {
  const hash = await getDbHash();
  return `cell-srs-${hash}`;
}

/** Open (or return cached) SRS IndexedDB connection. */
export async function getSrsDB(): Promise<IDBDatabase> {
  const cached = dbCache.get('srs');
  if (cached) return cached;

  const dbName = await getSrsDbName();
  const db = await openSrsDB(dbName);
  dbCache.set('srs', db);
  return db;
}

/** Close + clear cached SRS DB connection (test cleanup). */
export function closeSrsDB(): void {
  const db = dbCache.get('srs');
  if (db) {
    db.close();
    dbCache.delete('srs');
  }
}

/** Close all cached SRS DB connections (test cleanup). */
export function closeAllSrsDBs(): void {
  for (const db of dbCache.values()) db.close();
  dbCache.clear();
}

/** Open IndexedDB với migration create-all. */
function openSrsDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, SRS_DB_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      createAllSrsStores(db);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

/** Create all SRS object stores and indexes. */
function createAllSrsStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(SRS_STORES.COLLECTIONS)) {
    const store = db.createObjectStore(SRS_STORES.COLLECTIONS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_languageProfileId, 'languageProfileId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.DECKS)) {
    const store = db.createObjectStore(SRS_STORES.DECKS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_collection, 'collectionId', { unique: false });
    store.createIndex(SRS_INDEXES.by_parent, 'parentId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.STUDY_CONFIGS)) {
    db.createObjectStore(SRS_STORES.STUDY_CONFIGS, { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.NOTETYPES)) {
    const store = db.createObjectStore(SRS_STORES.NOTETYPES, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_collection, 'collectionId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.NOTES)) {
    const store = db.createObjectStore(SRS_STORES.NOTES, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_notetype, 'notetypeId', { unique: false });
    store.createIndex(SRS_INDEXES.by_deck, 'deckId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.CARDS)) {
    const store = db.createObjectStore(SRS_STORES.CARDS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_note, 'noteId', { unique: false });
    store.createIndex(SRS_INDEXES.by_deck, 'deckId', { unique: false });
    store.createIndex(SRS_INDEXES.by_deck_due, ['deckId', 'nextDue'], { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.AUDIO_ASSETS)) {
    const store = db.createObjectStore(SRS_STORES.AUDIO_ASSETS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_note, 'noteId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.IMAGE_ASSETS)) {
    const store = db.createObjectStore(SRS_STORES.IMAGE_ASSETS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_note, 'noteId', { unique: false });
  }

  if (!db.objectStoreNames.contains(SRS_STORES.REVIEW_EVENTS)) {
    const store = db.createObjectStore(SRS_STORES.REVIEW_EVENTS, { keyPath: 'id' });
    store.createIndex(SRS_INDEXES.by_card, 'cardId', { unique: false });
    store.createIndex(SRS_INDEXES.by_component, 'componentType', { unique: false });
    store.createIndex(SRS_INDEXES.by_timestamp, 'timestamp', { unique: false });
  }
}

/** Open a transaction for 1 store (readwrite default). */
export function getSrsStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode = 'readwrite',
): IDBObjectStore {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/** Wait for a transaction to complete. */
export function awaitSrsTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Delete entire SRS database (test cleanup). */
export async function deleteSrsDB(dbName: string): Promise<void> {
  closeAllSrsDBs();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}

/** Clear all SRS stores (test isolation). */
export async function clearAllSrsStores(): Promise<void> {
  const db = await getSrsDB();
  const storeNames = Object.values(SRS_STORES);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
