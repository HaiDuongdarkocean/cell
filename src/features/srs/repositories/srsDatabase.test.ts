import 'fake-indexeddb/auto';
import {
  getSrsDB,
  getSrsDbName,
  closeAllSrsDBs,
  closeSrsDB,
  SRS_STORES,
  SRS_INDEXES,
  SRS_DB_SCHEMA_VERSION,
  awaitSrsTx,
  clearAllSrsStores,
  deleteSrsDB,
} from '@/features/srs/repositories/srsDatabase';

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
  storageLocalGetMock.mockResolvedValue({}); // fallback DEFAULT_DB_HASH 'devmode0'
  closeAllSrsDBs();
});

beforeEach(async () => {
  await clearAllSrsStores();
});

afterEach(() => {
  closeSrsDB();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('srsDatabase', () => {
  describe('getSrsDbName', () => {
    it('returns cell-srs-{hash}', async () => {
      await expect(getSrsDbName()).resolves.toBe('cell-srs-devmode0');
    });
  });

  describe('getSrsDB', () => {
    it('opens a connection with schema version 1', async () => {
      const db = await getSrsDB();
      expect(db).toBeInstanceOf(IDBDatabase);
      expect(db.version).toBe(SRS_DB_SCHEMA_VERSION);
    });

    it('caches connection', async () => {
      const db1 = await getSrsDB();
      const db2 = await getSrsDB();
      expect(db1).toBe(db2);
    });
  });

  describe('schema v1 create-all', () => {
    it('creates 9 object stores', async () => {
      const db = await getSrsDB();
      const stores = Array.from(db.objectStoreNames);
      expect(stores).toHaveLength(9);
      expect(stores).toEqual(
        expect.arrayContaining([
          SRS_STORES.COLLECTIONS,
          SRS_STORES.DECKS,
          SRS_STORES.STUDY_CONFIGS,
          SRS_STORES.NOTETYPES,
          SRS_STORES.NOTES,
          SRS_STORES.CARDS,
          SRS_STORES.AUDIO_ASSETS,
          SRS_STORES.IMAGE_ASSETS,
          SRS_STORES.REVIEW_EVENTS,
        ]),
      );
    });

    it('creates the expected indexes', async () => {
      const db = await getSrsDB();
      const tx = db.transaction(SRS_STORES.CARDS, 'readonly');
      const cardStore = tx.objectStore(SRS_STORES.CARDS);
      const indexNames = Array.from(cardStore.indexNames);
      expect(indexNames).toEqual(
        expect.arrayContaining([
          SRS_INDEXES.by_note,
          SRS_INDEXES.by_deck,
          SRS_INDEXES.by_deck_due,
        ]),
      );

      const deckStore = db.transaction(SRS_STORES.DECKS, 'readonly').objectStore(SRS_STORES.DECKS);
      expect(Array.from(deckStore.indexNames)).toEqual(
        expect.arrayContaining([SRS_INDEXES.by_collection, SRS_INDEXES.by_parent]),
      );
    });

    it('supports by_deck_due compound index', async () => {
      const db = await getSrsDB();
      const tx = db.transaction(SRS_STORES.CARDS, 'readwrite');
      const store = tx.objectStore(SRS_STORES.CARDS);

      store.put({
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        nextDue: '2025-01-15T00:00:00.000Z',
        components: {},
      });

      const index = store.index(SRS_INDEXES.by_deck_due);
      const request = index.get(['deck-1', '2025-01-15T00:00:00.000Z']);
      const result = await new Promise<unknown>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await awaitSrsTx(tx);
      expect(result).toMatchObject({ id: 'card-1' });
    });
  });

  describe('cleanup', () => {
    it('clears all stores', async () => {
      const db = await getSrsDB();
      const tx = db.transaction([SRS_STORES.COLLECTIONS, SRS_STORES.DECKS], 'readwrite');
      tx.objectStore(SRS_STORES.COLLECTIONS).add({ id: 'c1', name: 'test' });
      tx.objectStore(SRS_STORES.DECKS).add({ id: 'd1', name: 'test' });
      await awaitSrsTx(tx);

      await clearAllSrsStores();

      const countCollections = await new Promise<number>((resolve, reject) => {
        const req = db.transaction(SRS_STORES.COLLECTIONS, 'readonly').objectStore(SRS_STORES.COLLECTIONS).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      expect(countCollections).toBe(0);
    });

    it('deletes the database', async () => {
      const dbName = await getSrsDbName();
      await expect(deleteSrsDB(dbName)).resolves.toBeUndefined();
      // Re-open creates a fresh DB.
      const db = await getSrsDB();
      expect(db.version).toBe(SRS_DB_SCHEMA_VERSION);
    });
  });
});
