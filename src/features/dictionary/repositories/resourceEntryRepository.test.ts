import 'fake-indexeddb/auto';
import {
  addDictionaryEntry,
  bulkInsertDictionaryEntries,
  bulkInsertFrequencyEntries,
  findDictionaryByResource,
  findDictionaryByTerm,
  findDictionaryByPrefix,
  findDictionaryBySuffix,
  sampleDictionaryEntries,
  findDictionaryEntry,
  countDictionaryByResource,
  countEntriesByResource,
  deleteEntriesByResource,
  isContiguousKeys,
} from '@/features/dictionary/repositories/resourceEntryRepository';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';

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
  await clearAllStores(LANG);
});

afterEach(() => {
  closeAllDBs();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const LANG = 'en';
const RESOURCE_ID = 1;

function makeDictEntry(term: string, resourceId = RESOURCE_ID) {
  return {
    resourceId,
    term,
    reading: term,
    altterm: '',
    pronunciation: '',
    definition: `meaning of ${term}`,
    pos: 'noun',
    examples: '',
    audio: '',
  };
}

describe('resourceEntryRepository — dictionary', () => {
  it('addDictionaryEntry returns auto-generated id', async () => {
    const id = await addDictionaryEntry(LANG, makeDictEntry('hello'));
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('bulkInsertDictionaryEntries inserts all', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeDictEntry('apple'),
      makeDictEntry('banana'),
      makeDictEntry('cherry'),
    ]);
    await expect(countDictionaryByResource(LANG, RESOURCE_ID)).resolves.toBe(3);
  });

  it('findDictionaryByResource returns all entries with rich fields', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('apple')]);
    const results = await findDictionaryByResource(LANG, RESOURCE_ID);
    expect(results).toHaveLength(1);
    expect(results[0].term).toBe('apple');
    expect(results[0].definition).toBe('meaning of apple');
    expect(results[0].pos).toBe('noun');
  });

  it('findDictionaryByTerm returns exact match', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('apple'), makeDictEntry('banana')]);
    const results = await findDictionaryByTerm(LANG, 'apple');
    expect(results).toHaveLength(1);
    expect(results[0].term).toBe('apple');
  });

  it('findDictionaryByPrefix returns entries starting with prefix', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeDictEntry('apple'),
      makeDictEntry('application'),
      makeDictEntry('banana'),
    ]);
    const results = await findDictionaryByPrefix(LANG, 'app');
    expect(results).toHaveLength(2);
  });

  it('findDictionaryBySuffix returns entries ending with suffix', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeDictEntry('running'),
      makeDictEntry('walking'),
      makeDictEntry('apple'),
    ]);
    const results = await findDictionaryBySuffix(LANG, 'ing');
    expect(results).toHaveLength(2);
  });

  it('countDictionaryByResource returns count', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('a'), makeDictEntry('b')]);
    await expect(countDictionaryByResource(LANG, RESOURCE_ID)).resolves.toBe(2);
  });

  it('deleteEntriesByResource removes all entries for resource', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('a'), makeDictEntry('b')]);
    await deleteEntriesByResource(LANG, RESOURCE_ID);
    await expect(countDictionaryByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
  });

  it('deleteEntriesByResource resolves for an empty resource', async () => {
    const calls: Array<[number, number]> = [];
    await expect(deleteEntriesByResource(LANG, 999, (d, t) => calls.push([d, t]))).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('deleteEntriesByResource removes dict + freq rows of one resource, keeps others', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('a'), makeDictEntry('b')]);
    await bulkInsertFrequencyEntries(LANG, [
      { resourceId: RESOURCE_ID, term: 'c', reading: 'c', frequency: 1 },
      { resourceId: RESOURCE_ID, term: 'd', reading: 'd', frequency: 2 },
      { resourceId: 2, term: 'e', reading: 'e', frequency: 3 },
    ]);
    const calls: Array<[number, number]> = [];
    await deleteEntriesByResource(LANG, RESOURCE_ID, (d, t) => calls.push([d, t]));
    await expect(countEntriesByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    await expect(countEntriesByResource(LANG, 2)).resolves.toBe(1);
    expect(calls).toEqual([[0, 4], [4, 4]]);
  });

  it('deleteEntriesByResource reports progress once on the contiguous fast path', async () => {
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 600 }, (_, i) => makeDictEntry(`t${i}`)));
    const calls: Array<[number, number]> = [];
    await deleteEntriesByResource(LANG, RESOURCE_ID, (d, t) => calls.push([d, t]));
    await expect(countEntriesByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    expect(calls).toEqual([[0, 600], [600, 600]]);
  });

  it('deleteEntriesByResource reports per-chunk progress when contiguous keys exceed one chunk', async () => {
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 9000 }, (_, i) => makeDictEntry(`t${i}`)));
    const calls: Array<[number, number]> = [];
    await deleteEntriesByResource(LANG, RESOURCE_ID, (d, t) => calls.push([d, t]));
    await expect(countEntriesByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    expect(calls).toEqual([[0, 9000], [8192, 9000], [9000, 9000]]);
  });

  it('deleteEntriesByResource deletes only own rows when keys interleave', async () => {
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 5 }, (_, i) => makeDictEntry(`a${i}`)));
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 5 }, (_, i) => makeDictEntry(`b${i}`, 2)));
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 5 }, (_, i) => makeDictEntry(`c${i}`)));
    await deleteEntriesByResource(LANG, RESOURCE_ID);
    await expect(countEntriesByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    await expect(countEntriesByResource(LANG, 2)).resolves.toBe(5);
  });

  it('deleteEntriesByResource reports per-chunk progress on non-contiguous keys', async () => {
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 300 }, (_, i) => makeDictEntry(`a${i}`)));
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('mid', 2)]);
    await bulkInsertDictionaryEntries(LANG, Array.from({ length: 300 }, (_, i) => makeDictEntry(`c${i}`)));
    const calls: Array<[number, number]> = [];
    await deleteEntriesByResource(LANG, RESOURCE_ID, (d, t) => calls.push([d, t]));
    await expect(countEntriesByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    await expect(countEntriesByResource(LANG, 2)).resolves.toBe(1);
    expect(calls).toEqual([[0, 600], [300, 600], [600, 600]]);
  });

  it('sampleDictionaryEntries returns the first N entries for a resource', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeDictEntry('apple'),
      makeDictEntry('banana'),
      makeDictEntry('cherry'),
    ]);
    const results = await sampleDictionaryEntries(LANG, RESOURCE_ID, 2);
    expect(results).toHaveLength(2);
    expect(results[0]!.term).toBe('apple');
    expect(results[1]!.term).toBe('banana');
    expect(results[0]).not.toHaveProperty('backwardTerm');
  });

  it('sampleDictionaryEntries respects resource isolation', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('apple'), makeDictEntry('banana')]);
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('other', 2)]);
    const results = await sampleDictionaryEntries(LANG, 2, 5);
    expect(results).toHaveLength(1);
    expect(results[0]!.term).toBe('other');
  });

  it('findDictionaryEntry returns exact term match within a resource', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeDictEntry('apple'),
      makeDictEntry('banana'),
      makeDictEntry('banana', 2),
    ]);
    const found = await findDictionaryEntry(LANG, RESOURCE_ID, 'banana');
    expect(found).toBeDefined();
    expect(found!.term).toBe('banana');
    expect(found!.resourceId).toBe(RESOURCE_ID);
    expect(found).not.toHaveProperty('backwardTerm');
  });

  it('findDictionaryEntry returns undefined when term is in another resource', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('apple')]);
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('banana', 2)]);
    await expect(findDictionaryEntry(LANG, RESOURCE_ID, 'banana')).resolves.toBeUndefined();
  });
});

describe('isContiguousKeys', () => {
  it('accepts an unbroken numeric run from any start', () => {
    expect(isContiguousKeys([1, 2, 3])).toBe(true);
    expect(isContiguousKeys([5, 6, 7])).toBe(true);
    expect(isContiguousKeys([42])).toBe(true);
  });

  it('rejects empty, gapped, unsorted, and non-numeric keys', () => {
    expect(isContiguousKeys([])).toBe(false);
    expect(isContiguousKeys([1, 3])).toBe(false);
    expect(isContiguousKeys([1, 2, 4])).toBe(false);
    expect(isContiguousKeys([3, 2, 1])).toBe(false);
    expect(isContiguousKeys(['a', 'b'])).toBe(false);
  });
});
