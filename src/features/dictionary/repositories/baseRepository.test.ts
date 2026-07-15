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
      expect(db.objectStoreNames.contains(STORES.FREQUENCY)).toBe(true);
      expect(db.objectStoreNames.contains(STORES.DICTIONARY)).toBe(true);
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
      const tx = db.transaction(STORES.FREQUENCY, 'readonly');
      const store = tx.objectStore(STORES.FREQUENCY);
      expect(store.indexNames.contains(INDEXES.by_resource)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_term)).toBe(true);
      expect(store.indexNames.contains(INDEXES.by_backwardTerm)).toBe(true);
      await awaitTx(tx);
    });

    it('creates 3 indexes on langDictionaryEntry', async () => {
      const db = await getDB('en');
      const tx = db.transaction(STORES.DICTIONARY, 'readonly');
      const store = tx.objectStore(STORES.DICTIONARY);
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
});
