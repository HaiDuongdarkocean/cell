import 'fake-indexeddb/auto';
import {
  addDictionaryEntry,
  bulkInsertDictionaryEntries,
  findDictionaryByResource,
  findDictionaryByTerm,
  findDictionaryByPrefix,
  findDictionaryBySuffix,
  sampleDictionaryEntries,
  findDictionaryEntry,
  countDictionaryByResource,
  deleteDictionaryByResource,
} from '@/features/dictionary/repositories/dictionaryRepository';
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

describe('dictionaryRepository', () => {
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

  it('deleteDictionaryByResource removes all entries for resource', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeDictEntry('a'), makeDictEntry('b')]);
    await deleteDictionaryByResource(LANG, RESOURCE_ID);
    await expect(countDictionaryByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
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
