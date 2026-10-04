// baseRepository — IndexedDB connection + migrations (ADR-023 D1-D2, ADR-037 §7.1).
//
// DB name: orca-dict-{hash8}-en.
// v14 merges langFrequencyEntry into langDictionaryEntry (unified entry store —
// freq rows stamped `kind: 'freq'`). Singleton getDB() — 1 connection per lang.

import { getDbHash } from '@/shared/lib/storage/dbHash';

/** IndexedDB schema version (ADR-023 D2 + ADR-037 §7.1 — v10 adds langPhraseIndex, v12 adds langWordTrash, v13 adds sync capture stores, v14 unifies entry store). */
export const DB_SCHEMA_VERSION = 14;

/** Pre-v14 store names — migration only, never referenced elsewhere. */
const LEGACY_FREQUENCY_STORE = 'langFrequencyEntry';

/** Object store names. */
export const STORES = {
  RESOURCE: 'langResourceInfo',
  /** Unified entry store — dictionary rows + freq rows (`kind: 'freq'`). */
  ENTRY: 'langDictionaryEntry',
  PHRASE_INDEX: 'langPhraseIndex',
  WORD_STATUS: 'langWordStatus',
  WORD_TRASH: 'langWordTrash',
  SYNC_OUTBOX: 'syncOutbox',
  SYNC_META: 'syncMeta',
} as const;

/** Index names. */
export const INDEXES = {
  by_signature: 'by_signature',
  by_contentHash: 'by_contentHash',
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
  db.onversionchange = () => {
    db.close();
    if (dbCache.get(langCode) === db) dbCache.delete(langCode);
  };
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

/** Open IndexedDB, running create-all on fresh DBs and incremental
 *  migrations (v13→v14 entry-store merge) on existing ones. */
function openDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_SCHEMA_VERSION);
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const tx = request.transaction ?? undefined;
      createAllStores(db, tx);
      if (tx && event.oldVersion > 0 && event.oldVersion < 14) {
        migrateFrequencyRows(db, tx);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

/** v13→v14: copy langFrequencyEntry rows into the unified entry store stamped
 *  `kind: 'freq'` (ids re-generated — both stores shared an auto-increment
 *  keyspace, so raw ids could collide), backfill `components: ['frequency']`
 *  on frequency resources that predate the field, then drop the legacy store.
 *  All inside the versionchange transaction — abort-safe and idempotent
 *  (a retried upgrade replays the whole copy). */
function migrateFrequencyRows(db: IDBDatabase, tx: IDBTransaction): void {
  const resources = tx.objectStore(STORES.RESOURCE);
  const resourceScan = resources.openCursor();
  resourceScan.onsuccess = () => {
    const cursor = resourceScan.result;
    if (!cursor) return;
    const row = cursor.value as { type?: string; components?: readonly string[] };
    if (row.type === 'FREQUENCY' && !row.components) {
      cursor.update({ ...cursor.value, components: ['frequency'] });
    }
    cursor.continue();
  };

  if (!db.objectStoreNames.contains(LEGACY_FREQUENCY_STORE)) return;
  const from = tx.objectStore(LEGACY_FREQUENCY_STORE);
  const to = tx.objectStore(STORES.ENTRY);
  const copy = from.openCursor();
  copy.onsuccess = () => {
    const cursor = copy.result;
    if (!cursor) {
      db.deleteObjectStore(LEGACY_FREQUENCY_STORE);
      return;
    }
    const { id: _id, ...row } = cursor.value as Record<string, unknown>;
    to.add({ ...row, kind: 'freq' });
    cursor.continue();
  };
}

/** Create all stores + indexes (ADR-023 D2 + ADR-037 §7.1 — create-all only). */
function createAllStores(db: IDBDatabase, tx?: IDBTransaction): void {
  // langResourceInfo — keyPath 'id' auto, indexes: by_signature, by_type, by_order, by_contentHash
  if (!db.objectStoreNames.contains(STORES.RESOURCE)) {
    const resource = db.createObjectStore(STORES.RESOURCE, { keyPath: 'id', autoIncrement: true });
    resource.createIndex(INDEXES.by_signature, 'signature', { unique: false });
    resource.createIndex(INDEXES.by_contentHash, 'contentHash', { unique: false });
    resource.createIndex(INDEXES.by_type, 'type', { unique: false });
    resource.createIndex(INDEXES.by_order, 'importedAt', { unique: false });
  } else if (tx) {
    const resource = tx.objectStore(STORES.RESOURCE);
    if (!resource.indexNames.contains(INDEXES.by_contentHash)) {
      resource.createIndex(INDEXES.by_contentHash, 'contentHash', { unique: false });
    }
  }
  // langDictionaryEntry — unified entry store (dict + `kind:'freq'` rows),
  // keyPath 'id' auto, indexes: by_resource, by_term, by_backwardTerm
  if (!db.objectStoreNames.contains(STORES.ENTRY)) {
    const dict = db.createObjectStore(STORES.ENTRY, { keyPath: 'id', autoIncrement: true });
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
  // langWordTrash — keyPath 'term' (unique); 24h soft-delete window, lazy purge
  if (!db.objectStoreNames.contains(STORES.WORD_TRASH)) {
    db.createObjectStore(STORES.WORD_TRASH, { keyPath: 'term' });
  }
  // syncOutbox — autoIncrement; pending change-record keys drained by the sync engine
  if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
    const outbox = db.createObjectStore(STORES.SYNC_OUTBOX, { autoIncrement: true });
    outbox.createIndex('by_key', 'key', { unique: false });
  }
  // syncMeta — keyPath 'key' (`<scope>|<recordKey>`); index by_recKey for prefix scans
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

/** Open a transaction for 1+ stores (readwrite default); returns the first store. */
export function getStore(
  db: IDBDatabase,
  storeName: string | readonly string[],
  mode: IDBTransactionMode = 'readwrite',
): IDBObjectStore {
  const names = Array.isArray(storeName) ? [...storeName] : [storeName];
  const tx = db.transaction(names, mode);
  return tx.objectStore(names[0]!);
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

/** Clear all stores for a lang (test isolation — call in beforeEach). */
export async function clearAllStores(langCode: string): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RESOURCE, STORES.ENTRY, STORES.PHRASE_INDEX, STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
    tx.objectStore(STORES.RESOURCE).clear();
    tx.objectStore(STORES.ENTRY).clear();
    tx.objectStore(STORES.PHRASE_INDEX).clear();
    tx.objectStore(STORES.WORD_STATUS).clear();
    tx.objectStore(STORES.WORD_TRASH).clear();
    tx.objectStore(STORES.SYNC_OUTBOX).clear();
    tx.objectStore(STORES.SYNC_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
