import 'fake-indexeddb/auto';
import {
  getDB,
  closeAllDBs,
  getDbName,
  getStore,
  awaitTx,
  STORES,
  INDEXES,
  DB_SCHEMA_VERSION,
  reverseString,
  deleteDB,
  clearAllStores,
} from '@/features/dictionary/repositories/baseRepository';

// Mock chrome.storage cho dbHash (fallback DEFAULT_DB_HASH).
const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({}); // → DEFAULT_DB_HASH 'devmode0'
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores('en');
  await clearAllStores('ja');
});

afterEach(() => {
  closeAllDBs();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('baseRepository', () => {
  describe('getDbName', () => {
    it('returns orca-dict-{hash}-{langCode}', async () => {
      await expect(getDbName('en')).resolves.toBe('orca-dict-devmode0-en');
      await expect(getDbName('ja')).resolves.toBe('orca-dict-devmode0-ja');
    });
  });

  describe('getDB', () => {
    it('opens a connection with schema version 10', async () => {
      const db = await getDB('en');
      expect(db).toBeInstanceOf(IDBDatabase);
      expect(db.version).toBe(DB_SCHEMA_VERSION);
    });

    it('caches connection (same instance on 2nd call)', async () => {
      const db1 = await getDB('en');
      const db2 = await getDB('en');
      expect(db1).toBe(db2);
    });

    it('separate connections per langCode', async () => {
      const dbEn = await getDB('en');
      const dbJa = await getDB('ja');
      expect(dbEn).not.toBe(dbJa);
      expect(dbEn.name).toBe('orca-dict-devmode0-en');
      expect(dbJa.name).toBe('orca-dict-devmode0-ja');
    });
  });

  describe('migration v9 create-all', () => {
    it('creates 4 object stores', async () => {
      const db = await getDB('en');
      expect(db.objectStoreNames.contains(STORES.RESOURCE)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.ENTRY)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.ENTRY)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.PHRASE_INDEX)).toBe(true);
    });

    it('creates 3 indexes on langResourceInfo', async () => {
      const db = await getDB('en');
      const tx = db.transaction(STORES.RESOURCE, 'readonly');
      const store = tx.objectStore(STORES.RESOURCE);
      expect(store.indexNames.contains(INDEXES.by_signature)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_type)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_order)).toBe(true);
      await awaitTx(tx);
    });

    it('creates 3 indexes on langFrequencyEntry', async () => {
      const db = await getDB('en');
      const tx = db.transaction(STORES.ENTRY, 'readonly');
      const store = tx.objectStore(STORES.ENTRY);
      expect(store.indexNames.contains(INDEXES.by_resource)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_term)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_backwardTerm)).toBe(true);
      await awaitTx(tx);
    });

    it('creates 3 indexes on langDictionaryEntry', async () => {
      const db = await getDB('en');
      const tx = db.transaction(STORES.ENTRY, 'readonly');
      const store = tx.objectStore(STORES.ENTRY);
      expect(store.indexNames.contains(INDEXES.by_resource)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_term)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_backwardTerm)).toBe(true);
      await awaitTx(tx);
    });

    it('idempotent — re-open does not duplicate stores', async () => {
      const db1 = await getDB('en');
      const storeCount = db1.objectStoreNames.length;
      closeAllDBs();
      const db2 = await getDB('en');
      expect(db2.objectStoreNames.length).toBe(storeCount);
    });
  });

  describe('getStore', () => {
    it('returns an IDBObjectStore', async () => {
      const db = await getDB('en');
      const store = getStore(db, STORES.RESOURCE, 'readwrite');
      expect(store).toBeInstanceOf(IDBObjectStore);
    });
  });

  describe('reverseString', () => {
    it('reverses a string', () => {
      expect(reverseString('hello')).toBe('olleh');
      expect(reverseString('a')).toBe('a');
      expect(reverseString('')).toBe('');
      expect(reverseString('abc123')).toBe('321cba');
    });
  });

  describe('deleteDB', () => {
    it('deletes the database', async () => {
      await getDB('en');
      await deleteDB('orca-dict-devmode0-en');
      // Re-open creates fresh DB.
      const db = await getDB('en');
      expect(db.version).toBe(DB_SCHEMA_VERSION);
    });
  });

  describe('migration v13 → v14 (unified entry store)', () => {
    const DB_NAME = 'orca-dict-devmode0-en';
    const LEGACY = 'langFrequencyEntry';

    /** Build a minimal v13 DB (only the stores the migration touches) and
     *  seed one FREQUENCY resource + 2 freq rows, one DICTIONARY resource
     *  + 1 dict row. Other stores are created by the v14 upgrade itself. */
    const seedV13 = async (): Promise<void> => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 13);
        req.onupgradeneeded = () => {
          const d = req.result;
          const res = d.createObjectStore(STORES.RESOURCE, { keyPath: 'id', autoIncrement: true });
          res.createIndex(INDEXES.by_signature, 'signature');
          res.createIndex(INDEXES.by_type, 'type');
          res.createIndex(INDEXES.by_order, 'importedAt');
          const dict = d.createObjectStore(STORES.ENTRY, { keyPath: 'id', autoIncrement: true });
          dict.createIndex(INDEXES.by_resource, 'resourceId');
          dict.createIndex(INDEXES.by_term, 'term');
          dict.createIndex(INDEXES.by_backwardTerm, 'backwardTerm');
          const freq = d.createObjectStore(LEGACY, { keyPath: 'id', autoIncrement: true });
          freq.createIndex(INDEXES.by_resource, 'resourceId');
          freq.createIndex(INDEXES.by_term, 'term');
          freq.createIndex(INDEXES.by_backwardTerm, 'backwardTerm');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction([STORES.RESOURCE, STORES.ENTRY, LEGACY], 'readwrite');
      tx.objectStore(STORES.RESOURCE).add({ name: 'top50k.txt', langCode: 'en', type: 'FREQUENCY', format: 'txt', signature: 'sig-f', contentHash: 'hash-f', wordCount: 2, installationFinished: true, importedAt: 1, enabled: true, priority: 0 });
      tx.objectStore(STORES.RESOURCE).add({ name: 'dict.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries', signature: 'sig-d', contentHash: 'hash-d', wordCount: 1, installationFinished: true, importedAt: 2, enabled: true, priority: 1 });
      tx.objectStore(LEGACY).add({ resourceId: 1, term: 'hello', backwardTerm: 'olleh', reading: 'hello', frequency: 5 });
      tx.objectStore(LEGACY).add({ resourceId: 1, term: 'world', backwardTerm: 'dlrow', reading: 'world', frequency: 9 });
      tx.objectStore(STORES.ENTRY).add({ resourceId: 2, term: 'hello', backwardTerm: 'olleh', definition: 'a greeting', senses: [] });
      await awaitTx(tx);
      db.close();
    };

    const allRows = async (db: IDBDatabase, store: string): Promise<Record<string, unknown>[]> => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      await awaitTx(tx);
      return req.result as Record<string, unknown>[];
    };

    const rawOpen = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    beforeEach(async () => {
      await deleteDB(DB_NAME);
    });

    it('moves freq rows into the entry store stamped kind:freq, drops the legacy store', async () => {
      await seedV13();
      const db = await getDB('en');
      expect(db.objectStoreNames.contains(LEGACY)).toBe(false);

      const rows = await allRows(db, STORES.ENTRY);
      const freq = rows.filter((r) => r.kind === 'freq');
      const dict = rows.filter((r) => r.kind !== 'freq');
      expect(freq).toHaveLength(2);
      expect(dict).toHaveLength(1);
      expect(freq.map((r) => r.term).sort()).toEqual(['hello', 'world']);
      expect(freq.every((r) => r.resourceId === 1 && typeof r.frequency === 'number')).toBe(true);
      expect(dict[0]).toMatchObject({ term: 'hello', definition: 'a greeting', resourceId: 2 });
    });

    it('backfills components on FREQUENCY resources and preserves resource fields', async () => {
      await seedV13();
      const db = await getDB('en');
      const resources = await allRows(db, STORES.RESOURCE);
      const freq = resources.find((r) => r.signature === 'sig-f')!;
      const dict = resources.find((r) => r.signature === 'sig-d')!;
      expect(freq.components).toEqual(['frequency']);
      expect(freq).toMatchObject({ enabled: true, priority: 0, contentHash: 'hash-f', type: 'FREQUENCY' });
      expect(dict.components).toBeUndefined();
    });

    it('abort mid-upgrade keeps the DB at v13 and a retry replays without duplicates', async () => {
      await seedV13();
      const real = IDBObjectStore.prototype.openCursor;
      let calls = 0;
      const spy = jest
        .spyOn(IDBObjectStore.prototype, 'openCursor')
        .mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['openCursor']>) {
          calls += 1;
          if (calls === 2) throw new Error('crash mid-copy');
          return real.apply(this, args);
        });
      await expect(getDB('en')).rejects.toThrow();
      spy.mockRestore();

      const stillV13 = await rawOpen();
      expect(stillV13.version).toBe(13);
      expect(stillV13.objectStoreNames.contains(LEGACY)).toBe(true);
      stillV13.close();

      const db = await getDB('en');
      const rows = await allRows(db, STORES.ENTRY);
      expect(rows.filter((r) => r.kind === 'freq')).toHaveLength(2);
      expect(rows.filter((r) => r.kind !== 'freq')).toHaveLength(1);
      expect(db.objectStoreNames.contains(LEGACY)).toBe(false);
      const resources = await allRows(db, STORES.RESOURCE);
      expect(resources.find((r) => r.signature === 'sig-f')?.components).toEqual(['frequency']);
    });
  });
});
