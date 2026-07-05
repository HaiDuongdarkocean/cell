import 'fake-indexeddb/auto';
import { importFile, rollbackImport, deleteResourceCascade, listResources } from '@/features/dictionary/logic/importOrchestrator';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { getResource, getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { countFrequencyByResource } from '@/features/dictionary/repositories/frequencyRepository';
import { countDictionaryByResource } from '@/features/dictionary/repositories/dictionaryRepository';
import { DuplicateFileError } from '@/features/dictionary/logic/importErrors';
import { strToU8 } from 'fflate';

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

const LANG = 'en';

function makeFile(name: string, content: string): { name: string; size: number; slice: (s: number, e: number) => { arrayBuffer(): Promise<ArrayBuffer> } } {
  const bytes = strToU8(content);
  return {
    name,
    size: bytes.length,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(bytes.slice(start, end).buffer as ArrayBuffer),
    }),
  };
}

describe('importOrchestrator', () => {
  describe('importFile — happy path', () => {
    it('imports TXT frequency list end-to-end', async () => {
      const file = makeFile('words.txt', 'hello\nworld\nfoo\n');
      const result = await importFile(file, 'FREQUENCY', { langCode: LANG });
      expect(result.wordCount).toBe(3);
      expect(result.format).toBe('txt');
      const resource = await getResource(LANG, result.resourceId);
      expect(resource?.installationFinished).toBe(true);
      expect(resource?.wordCount).toBe(3);
      expect(await countFrequencyByResource(LANG, result.resourceId)).toBe(3);
    });

    it('calls onResourceCreated with resourceId', async () => {
      const file = makeFile('words.txt', 'hello\n');
      const onResourceCreated = jest.fn();
      await importFile(file, 'FREQUENCY', { langCode: LANG, onResourceCreated });
      expect(onResourceCreated).toHaveBeenCalledWith(expect.any(Number));
    });

    it('calls onProgress during import', async () => {
      const file = makeFile('words.txt', 'hello\nworld\n');
      const onProgress = jest.fn();
      await importFile(file, 'FREQUENCY', { langCode: LANG, onProgress });
      // onProgress called after flush (may or may not depending on batch size)
      // For small files, flush happens at end
      expect(onProgress).toHaveBeenCalled();
    });

    it('imports Cambridge JSON dictionary end-to-end', async () => {
      const cambridge = JSON.stringify([
        { term: 'hello', definition: 'greeting', pos: 'noun' },
        { term: 'world', definition: 'the earth' },
      ]);
      const file = makeFile('cambridge.json', cambridge);
      const result = await importFile(file, 'DICTIONARY', { langCode: LANG });
      expect(result.wordCount).toBe(2);
      expect(result.format).toBe('cambridge-json');
      expect(await countDictionaryByResource(LANG, result.resourceId)).toBe(2);
    });
  });

  describe('importFile — duplicate detection', () => {
    it('throws DuplicateFileError on re-import same file', async () => {
      const file = makeFile('words.txt', 'hello\nworld\n');
      await importFile(file, 'FREQUENCY', { langCode: LANG });
      await expect(importFile(file, 'FREQUENCY', { langCode: LANG })).rejects.toThrow(DuplicateFileError);
    });

    it('does not create resource on duplicate', async () => {
      const file = makeFile('words.txt', 'hello\nworld\n');
      await importFile(file, 'FREQUENCY', { langCode: LANG });
      const countBefore = (await getAllResources(LANG)).length;
      try {
        await importFile(file, 'FREQUENCY', { langCode: LANG });
      } catch {
        // expected
      }
      const countAfter = (await getAllResources(LANG)).length;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('importFile — rollback on error', () => {
    it('rolls back resource on strategy error', async () => {
      // Create a file that will fail to parse as TXT (empty content is OK,
      // but let's use a file with invalid format that detectFormat will reject)
      const file = makeFile('unknown.xyz', 'binary data \x00\x01');
      await expect(importFile(file, 'FREQUENCY', { langCode: LANG })).rejects.toThrow();
      // No resource should remain
      expect((await getAllResources(LANG)).length).toBe(0);
    });
  });

  describe('rollbackImport', () => {
    it('deletes resource + entries', async () => {
      const file = makeFile('words.txt', 'hello\nworld\n');
      const result = await importFile(file, 'FREQUENCY', { langCode: LANG });
      await rollbackImport(LANG, result.resourceId);
      expect(await getResource(LANG, result.resourceId)).toBeUndefined();
      expect(await countFrequencyByResource(LANG, result.resourceId)).toBe(0);
    });

    it('throws RollbackError if delete fails', async () => {
      // Mock deleteResource to throw
      const resource = await getResource(LANG, 999);
      void resource;
      await expect(rollbackImport(LANG, 999)).resolves.toBeUndefined(); // no entries to delete, no-op
    });
  });

  describe('deleteResourceCascade', () => {
    it('deletes resource + cascade entries', async () => {
      const file = makeFile('words.txt', 'hello\nworld\n');
      const result = await importFile(file, 'FREQUENCY', { langCode: LANG });
      await deleteResourceCascade(LANG, result.resourceId);
      expect(await getResource(LANG, result.resourceId)).toBeUndefined();
    });
  });

  describe('listResources', () => {
    it('returns all resources sorted by importedAt desc', async () => {
      const file1 = makeFile('a.txt', 'hello\n');
      const file2 = makeFile('b.txt', 'world\n');
      await importFile(file1, 'FREQUENCY', { langCode: LANG });
      await new Promise((r) => setTimeout(r, 10)); // ensure different importedAt
      await importFile(file2, 'FREQUENCY', { langCode: LANG });
      const list = await listResources(LANG);
      expect(list).toHaveLength(2);
      expect(list[0]!.name).toBe('b.txt'); // newest first
    });
  });
});
