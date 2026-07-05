import {
  getDbHash,
  saveDbHash,
  generateDbHash,
  initDbHashOnInstalled,
  DEFAULT_DB_HASH,
} from '@/shared/lib/storage/dbHash';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('dbHash', () => {
  describe('generateDbHash', () => {
    it('returns 8-char string', () => {
      const hash = generateDbHash();
      expect(hash).toHaveLength(8);
    });
    it('uses only [a-z0-9]', () => {
      for (let i = 0; i < 20; i++) {
        const hash = generateDbHash();
        expect(hash).toMatch(/^[a-z0-9]{8}$/);
      }
    });
    it('is random (2 calls differ)', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 50; i++) hashes.add(generateDbHash());
      expect(hashes.size).toBeGreaterThan(1);
    });
  });

  describe('getDbHash', () => {
    it('returns stored hash when valid', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: { dbHash: 'abcd1234' } });
      await expect(getDbHash()).resolves.toBe('abcd1234');
    });
    it('returns DEFAULT_DB_HASH when absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      await expect(getDbHash()).resolves.toBe(DEFAULT_DB_HASH);
      expect(DEFAULT_DB_HASH).toBe('devmode0');
    });
    it('returns default when orca object absent', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: {} });
      await expect(getDbHash()).resolves.toBe(DEFAULT_DB_HASH);
    });
    it('returns default when hash wrong length', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: { dbHash: 'short' } });
      await expect(getDbHash()).resolves.toBe(DEFAULT_DB_HASH);
    });
    it('returns default when hash wrong type', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: { dbHash: 123 } });
      await expect(getDbHash()).resolves.toBe(DEFAULT_DB_HASH);
    });
    it('returns default when storage throws', async () => {
      storageLocalGetMock.mockRejectedValue(new Error('storage error'));
      await expect(getDbHash()).resolves.toBe(DEFAULT_DB_HASH);
    });
  });

  describe('saveDbHash', () => {
    it('saves hash to orca.dbHash (merge with existing orca)', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: { otherField: 'x' } });
      await saveDbHash('newhash1');
      expect(storageLocalSetMock).toHaveBeenCalledWith({ orca: { otherField: 'x', dbHash: 'newhash1' } });
    });
    it('creates orca object when absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      await saveDbHash('newhash2');
      expect(storageLocalSetMock).toHaveBeenCalledWith({ orca: { dbHash: 'newhash2' } });
    });
  });

  describe('initDbHashOnInstalled', () => {
    it('returns existing hash when present (no overwrite)', async () => {
      storageLocalGetMock.mockResolvedValue({ orca: { dbHash: 'exist123' } });
      const result = await initDbHashOnInstalled();
      expect(result).toBe('exist123');
      expect(storageLocalSetMock).not.toHaveBeenCalled();
    });
    it('generates + saves new hash when absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      const result = await initDbHashOnInstalled();
      expect(result).toHaveLength(8);
      expect(result).toMatch(/^[a-z0-9]{8}$/);
      expect(storageLocalSetMock).toHaveBeenCalled();
    });
  });
});
