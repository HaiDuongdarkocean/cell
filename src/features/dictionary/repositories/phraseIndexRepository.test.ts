import 'fake-indexeddb/auto';
import {
  closeAllDBs,
  clearAllStores,
  getDB,
  STORES,
  DB_SCHEMA_VERSION,
} from '@/features/dictionary/repositories/baseRepository';
import {
  putPhraseIndex,
  getPhraseIndex,
  deletePhraseIndex,
  hasPhraseIndex,
} from '@/features/dictionary/repositories/phraseIndexRepository';

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
  storageLocalGetMock.mockResolvedValue({});
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores('en');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

function makeBlob(): ArrayBuffer {
  // Use a simple ArrayBuffer instead of compiling a full phrase index.
  // The compiler is tested separately; here we only test IDB round-trip.
  const buf = new ArrayBuffer(16);
  new Uint8Array(buf).set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  return buf;
}

describe('phraseIndexRepository', () => {
  describe('schema v11 migration', () => {
    it('opens DB with schema version 11', async () => {
      const db = await getDB('en');
      expect(db.version).toBe(DB_SCHEMA_VERSION);
      expect(DB_SCHEMA_VERSION).toBe(11);
    });

    it('creates langPhraseIndex store with by_resource index', async () => {
      const db = await getDB('en');
      expect(db.objectStoreNames.contains(STORES.PHRASE_INDEX)).toBe(true);
      const tx = db.transaction(STORES.PHRASE_INDEX, 'readonly');
      const store = tx.objectStore(STORES.PHRASE_INDEX);
      expect(store.indexNames.contains('by_resource')).toBe(true);
    });
  });

  describe('putPhraseIndex + getPhraseIndex', () => {
    it('stores and retrieves a phrase index blob by resourceId', async () => {
      const blob = makeBlob();
      await putPhraseIndex('en', 42, blob, { compilerVersion: 1, termCount: 1 });
      const retrieved = await getPhraseIndex('en', 42);
      expect(retrieved).toBeDefined();
      expect(retrieved!.resourceId).toBe(42);
      expect(retrieved!.blob.byteLength).toBe(blob.byteLength);
      expect(retrieved!.compilerVersion).toBe(1);
      expect(retrieved!.termCount).toBe(1);
    });

    it('returns undefined for a missing resourceId', async () => {
      expect(await getPhraseIndex('en', 999)).toBeUndefined();
    });

    it('overwrites an existing blob on re-put', async () => {
      const blob1 = makeBlob();
      await putPhraseIndex('en', 1, blob1, { compilerVersion: 1, termCount: 1 });
      const blob2 = new ArrayBuffer(8);
      await putPhraseIndex('en', 1, blob2, { compilerVersion: 2, termCount: 0 });
      const retrieved = await getPhraseIndex('en', 1);
      expect(retrieved!.blob.byteLength).toBe(8);
      expect(retrieved!.compilerVersion).toBe(2);
    });
  });

  describe('hasPhraseIndex', () => {
    it('returns true when a blob exists', async () => {
      await putPhraseIndex('en', 5, makeBlob(), { compilerVersion: 1, termCount: 1 });
      expect(await hasPhraseIndex('en', 5)).toBe(true);
    });

    it('returns false when no blob exists', async () => {
      expect(await hasPhraseIndex('en', 6)).toBe(false);
    });
  });

  describe('deletePhraseIndex', () => {
    it('deletes a blob by resourceId', async () => {
      await putPhraseIndex('en', 7, makeBlob(), { compilerVersion: 1, termCount: 1 });
      await deletePhraseIndex('en', 7);
      expect(await getPhraseIndex('en', 7)).toBeUndefined();
      expect(await hasPhraseIndex('en', 7)).toBe(false);
    });

    it('is a no-op for a missing resourceId', async () => {
      await expect(deletePhraseIndex('en', 999)).resolves.toBeUndefined();
    });
  });
});
