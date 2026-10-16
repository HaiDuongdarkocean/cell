// baseRepository — IndexedDB connection + migrations (ADR-023 D1-D2, ADR-037 §7.1).
//
// DB name: orca-dict-{hash8}-en.
// v14 merges langFrequencyEntry into langDictionaryEntry (unified entry store —
// freq rows stamped `kind: 'freq'`). Singleton getDB() — 1 connection per lang.

import { getDbHash } from '@/shared/lib/storage/dbHash';

/** IndexedDB schema version (ADR-023 D2 + ADR-037 §7.1 — v10 adds langPhraseIndex, v12 adds langWordTrash, v13 adds sync capture stores, v14 unifies entry store, v15 adds immutable entry-blob stores). */
export const DB_SCHEMA_VERSION = 15;

/** Pre-v14 store names — migration only, never referenced elsewhere. */
const LEGACY_FREQUENCY_STORE = 'langFrequencyEntry';

/** Object store names. */
export const STORES = {
  RESOURCE: 'langResourceInfo',
  /** Unified entry store — dictionary rows + freq rows (`kind: 'freq'`). */
  ENTRY: 'langDictionaryEntry',
  PHRASE_INDEX: 'langPhraseIndex',
  /** Immutable per-resource entry blobs: keyPath [resourceId, seq]. seq=0 is
   *  never used — meta lives in ENTRY_META, terms record at seq -1, entry
   *  chunks at seq 1..N. Chunks are the read target; ENTRY stays the import
   *  staging target so lookup reads never serialize behind bulk row writes. */
  ENTRY_CHUNK: 'langEntryChunk',
  /** Per-resource chunk directory — presence flips that resource's reads to
   *  the blob path atomically (the MANIFEST-pointer equivalent). */
  ENTRY_META: 'langEntryMeta',
  /** Suffix-search rows per compiled resource: {resourceId, bterm, term, seq}. */
  ENTRY_BWD: 'langEntryBwd',
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
  /** [resourceId, term] — lets the blob compiler stream one resource's rows
   *  in term order straight off the index (no in-memory sort of 100k+ rows). */
  by_resource_term: 'by_resource_term',
  /** [resourceId, bterm] on ENTRY_BWD — bounded range scans for suffix lookup. */
  by_resource_bterm: 'by_resource_bterm',
} as const;

/** Cache of open DB connections by langCode. */
const dbCache = new Map<string, IDBDatabase>();
/** Cache of open ingest-DB connections (staged ENTRY rows) by langCode. */
const entryDbCache = new Map<string, IDBDatabase>();

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

/** Open (or return cached) the ingest database — holds only the staged
 *  ENTRY store. Chromium serializes all transactions of one database on a
 *  single backend queue, so bulk staging writes, compile page reads, and
 *  delete sweeps must live outside the database that serves lookups
 *  (ADR-118 — even a ~500ms fat-row getAll there stalls every SW read).
 *  Legacy rows staged before the split remain in the main DB's ENTRY store;
 *  readers scan both. */
export async function getEntryDB(langCode: string): Promise<IDBDatabase> {
  const cached = entryDbCache.get(langCode);
  if (cached) return cached;

  const dbName = `${await getDbName(langCode)}-ingest`;
  // No pinned version: fresh create lands at v1 with upgradeneeded; a DB
  // already at a higher version (early dev builds opened it via the main
  // schema path) opens as-is. Only bump when ENTRY is genuinely missing.
  let db = await openIngestDB(dbName);
  if (!db.objectStoreNames.contains(STORES.ENTRY)) {
    db.close();
    db = await openIngestDB(dbName, db.version + 1);
  }
  db.onversionchange = () => {
    db.close();
    if (entryDbCache.get(langCode) === db) entryDbCache.delete(langCode);
  };
  entryDbCache.set(langCode, db);
  return db;
}

function openIngestDB(dbName: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
      const result = request.result;
      if (!result.objectStoreNames.contains(STORES.ENTRY)) {
        const dict = result.createObjectStore(STORES.ENTRY, { keyPath: 'id', autoIncrement: true });
        dict.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
        dict.createIndex(INDEXES.by_term, 'term', { unique: false });
        dict.createIndex(INDEXES.by_backwardTerm, 'backwardTerm', { unique: false });
        dict.createIndex(INDEXES.by_resource_term, ['resourceId', 'term'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB ingest open blocked'));
  });
}

/** Databases that can hold staged ENTRY rows: ingest first, then the main
 *  DB (rows staged before the ingest split stay readable until the
 *  migration job compiles them). A resource's rows live in exactly one —
 *  bulk inserts are sequential per import. */
export async function entryDBs(langCode: string): Promise<readonly IDBDatabase[]> {
  return [await getEntryDB(langCode), await getDB(langCode)];
}

/** All staged ENTRY rows for a resource across the ingest + main DBs —
 *  used by sync serializers which must see rows wherever they were staged.
 *  Paged by the by_resource_term index: a single getAll on ~50k fat rows
 *  occupies the shared IDB backing store for hundreds of ms and stalls
 *  concurrent lookup reads — 256-row pages keep each backend op small. */
export async function stagedRowsForResource(
  langCode: string,
  resourceId: number,
): Promise<Record<string, unknown>[]> {
  const PAGE = 128;
  const out: Record<string, unknown>[] = [];
  for (const db of await entryDBs(langCode)) {
    let lowerBound: IDBValidKey = [resourceId];
    let boundaryTerm: string | null = null;
    let boundaryMaxPk = -1;
    let boundaryEmitted = 0;
    for (;;) {
      const limit = PAGE + boundaryEmitted;
      const rows = await requestValue(
        getStore(db, STORES.ENTRY, 'readonly')
          .index(INDEXES.by_resource_term)
          .getAll(IDBKeyRange.bound(lowerBound, [resourceId, []]), limit),
      );
      if (rows.length === 0) break;
      let start = 0;
      if (boundaryTerm !== null) {
        while (
          start < rows.length
          && rows[start]!.term === boundaryTerm
          && (rows[start]!.id as number) <= boundaryMaxPk
        ) start++;
      }
      for (let i = start; i < rows.length; i++) out.push(rows[i]!);
      const last = rows[rows.length - 1]!;
      let trailing = 0;
      for (let i = rows.length - 1; i >= 0 && rows[i]!.term === last.term; i--) trailing++;
      boundaryTerm = last.term as string;
      boundaryMaxPk = last.id as number;
      boundaryEmitted = trailing;
      lowerBound = [resourceId, boundaryTerm];
      if (rows.length < limit) break;
    }
  }
  return out;
}

/** Close + clear cached DB connection for a lang code (test cleanup). */
export function closeDB(langCode: string): void {
  const db = dbCache.get(langCode);
  if (db) {
    db.close();
    dbCache.delete(langCode);
  }
  const entryDb = entryDbCache.get(langCode);
  if (entryDb) {
    entryDb.close();
    entryDbCache.delete(langCode);
  }
}

/** Close all cached DB connections (test cleanup). */
export function closeAllDBs(): void {
  for (const db of dbCache.values()) db.close();
  dbCache.clear();
  for (const db of entryDbCache.values()) db.close();
  entryDbCache.clear();
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
    dict.createIndex(INDEXES.by_resource_term, ['resourceId', 'term'], { unique: false });
  } else if (tx) {
    const dict = tx.objectStore(STORES.ENTRY);
    if (!dict.indexNames.contains(INDEXES.by_resource_term)) {
      dict.createIndex(INDEXES.by_resource_term, ['resourceId', 'term'], { unique: false });
    }
  }
  // langPhraseIndex — keyPath 'resourceId', index: by_resource (ADR-037 §7.1)
  if (!db.objectStoreNames.contains(STORES.PHRASE_INDEX)) {
    const phrase = db.createObjectStore(STORES.PHRASE_INDEX, { keyPath: 'resourceId' });
    phrase.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
  }
  // langEntryChunk — immutable term-sorted entry chunks, keyPath [resourceId, seq]
  if (!db.objectStoreNames.contains(STORES.ENTRY_CHUNK)) {
    const chunk = db.createObjectStore(STORES.ENTRY_CHUNK, { keyPath: ['resourceId', 'seq'] });
    chunk.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
  }
  // langEntryMeta — keyPath 'resourceId'; record exists = resource is blob-backed
  if (!db.objectStoreNames.contains(STORES.ENTRY_META)) {
    db.createObjectStore(STORES.ENTRY_META, { keyPath: 'resourceId' });
  }
  // langEntryBwd — reversed-term rows for suffix search on blob-backed resources
  if (!db.objectStoreNames.contains(STORES.ENTRY_BWD)) {
    const bwd = db.createObjectStore(STORES.ENTRY_BWD, { autoIncrement: true });
    bwd.createIndex(INDEXES.by_resource, 'resourceId', { unique: false });
    bwd.createIndex(INDEXES.by_resource_bterm, ['resourceId', 'bterm'], { unique: false });
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
  options?: IDBTransactionOptions,
): IDBObjectStore {
  const names = Array.isArray(storeName) ? [...storeName] : [storeName];
  const tx = db.transaction(names, mode, options);
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

const SWEEP_CHUNK = 256;
const SWEEP_GAP_MS = 32;

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Bounded delete of every row whose compound `indexName` key starts with
 *  `key` (e.g. by_resource_term [resourceId, term]). Each round-trip is a
 *  single readwrite txn of one `getAllKeys(range, 256)` + keyed deletes —
 *  the largest backend op is a 256-key page, so no request ever stalls
 *  lookups sharing the origin's backing store (a 48k-key getAllKeys or
 *  count() occupies it 200-450ms). Deleted keys vanish, so the same range
 *  re-read returns the next page — correct under interleaved keyspaces.
 *  Rows invisible to the compound index (missing sort field) are caught
 *  by a final `by_resource` probe. Progress total is the pk-span
 *  estimate — exact when the resource's rows are contiguous. */
export async function deleteRowsByIndex(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  key: IDBValidKey,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const range = IDBKeyRange.bound([key], [key, []]);
  const resourceIndex = INDEXES.by_resource;
  const probe = await new Promise<{ first?: number; last?: number }>((resolve, reject) => {
    const index = getStore(db, storeName, 'readonly').index(resourceIndex);
    let first: number | undefined;
    let last: number | undefined;
    let done = 0;
    const finish = () => {
      if (++done === 2) resolve({ first, last });
    };
    const fwd = index.openKeyCursor(IDBKeyRange.only(key));
    fwd.onsuccess = () => {
      const pk = fwd.result?.primaryKey;
      first = typeof pk === 'number' ? pk : undefined;
      fwd.onerror = () => reject(fwd.error);
      finish();
    };
    fwd.onerror = () => reject(fwd.error);
    const rev = index.openKeyCursor(IDBKeyRange.only(key), 'prev');
    rev.onsuccess = () => {
      const pk = rev.result?.primaryKey;
      last = typeof pk === 'number' ? pk : undefined;
      rev.onerror = () => reject(rev.error);
      finish();
    };
    rev.onerror = () => reject(rev.error);
  });
  if (probe.first === undefined || probe.last === undefined) return;
  const estimate = Math.max(1, probe.last - probe.first + 1);
  try {
    onProgress?.(0, estimate);
  } catch {}
  let done = 0;
  for (;;) {
    const page = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite', { durability: 'relaxed' });
      const request = tx.objectStore(storeName).index(indexName).getAllKeys(range, SWEEP_CHUNK);
      request.onsuccess = () => {
        const keys = request.result;
        const store = tx.objectStore(storeName);
        for (const k of keys) store.delete(k);
      };
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    done += page.length;
    try {
      onProgress?.(done, Math.max(done, estimate));
    } catch {}
    if (page.length < SWEEP_CHUNK) break;
    await new Promise((r) => setTimeout(r, SWEEP_GAP_MS));
  }
  // Stragglers: rows with the resourceId but no compound-index entry
  // (missing sort field) — rare; one probed pass removes them.
  const orphan = await requestValue(
    getStore(db, storeName, 'readonly').index(resourceIndex).openKeyCursor(IDBKeyRange.only(key)),
  );
  if (!orphan) return;
  const keys = await requestValue(
    getStore(db, storeName, 'readonly').index(resourceIndex).getAllKeys(IDBKeyRange.only(key)),
  );
  for (let i = 0; i < keys.length; i += SWEEP_CHUNK) {
    const slice = keys.slice(i, i + SWEEP_CHUNK);
    const store = getStore(db, storeName, 'readwrite', { durability: 'relaxed' });
    for (const k of slice) store.delete(k);
    await awaitTx(store.transaction);
    done += slice.length;
    try {
      onProgress?.(done, Math.max(done, estimate));
    } catch {}
    if (i + SWEEP_CHUNK < keys.length) await new Promise((r) => setTimeout(r, SWEEP_GAP_MS));
  }
}

/** Delete an entire database (test cleanup). */
export async function deleteDB(dbName: string): Promise<void> {
  closeAllDBs();
  for (const name of [dbName, `${dbName}-ingest`]) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
    });
  }
}

/** Clear all stores for a lang (test isolation — call in beforeEach). */
export async function clearAllStores(langCode: string): Promise<void> {
  const entryDb = await getEntryDB(langCode);
  await new Promise<void>((resolve, reject) => {
    const tx = entryDb.transaction([STORES.ENTRY], 'readwrite');
    tx.objectStore(STORES.ENTRY).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.RESOURCE, STORES.ENTRY, STORES.PHRASE_INDEX, STORES.ENTRY_CHUNK, STORES.ENTRY_META, STORES.ENTRY_BWD, STORES.WORD_STATUS, STORES.WORD_TRASH, STORES.SYNC_OUTBOX, STORES.SYNC_META], 'readwrite');
    tx.objectStore(STORES.RESOURCE).clear();
    tx.objectStore(STORES.ENTRY).clear();
    tx.objectStore(STORES.ENTRY_CHUNK).clear();
    tx.objectStore(STORES.ENTRY_META).clear();
    tx.objectStore(STORES.ENTRY_BWD).clear();
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
