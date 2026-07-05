import 'fake-indexeddb/auto';
import {
  addFrequencyEntry,
  bulkInsertFrequencyEntries,
  findFrequencyByResource,
  findFrequencyByTerm,
  findFrequencyByPrefix,
  findFrequencyBySuffix,
  countFrequencyByResource,
  deleteFrequencyByResource,
} from '@/features/dictionary/repositories/frequencyRepository';
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

function makeEntry(term: string, frequency: number, resourceId = RESOURCE_ID) {
  return { resourceId, term, reading: term, frequency };
}

describe('frequencyRepository', () => {
  it('addFrequencyEntry returns auto-generated id', async () => {
    const id = await addFrequencyEntry(LANG, makeEntry('hello', 1));
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('bulkInsertFrequencyEntries inserts all in 1 transaction', async () => {
    const entries = [
      makeEntry('apple', 10),
      makeEntry('application', 5),
      makeEntry('banana', 8),
    ];
    await bulkInsertFrequencyEntries(LANG, entries);
    await expect(countFrequencyByResource(LANG, RESOURCE_ID)).resolves.toBe(3);
  });

  it('findFrequencyByResource returns all entries for resource', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('apple', 10),
      makeEntry('banana', 8),
    ]);
    const results = await findFrequencyByResource(LANG, RESOURCE_ID);
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.term).sort()).toEqual(['apple', 'banana']);
  });

  it('findFrequencyByTerm returns exact match', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('apple', 10),
      makeEntry('banana', 8),
    ]);
    const results = await findFrequencyByTerm(LANG, 'apple');
    expect(results).toHaveLength(1);
    expect(results[0].term).toBe('apple');
    expect(results[0].frequency).toBe(10);
  });

  it('findFrequencyByPrefix returns entries starting with prefix', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('apple', 10),
      makeEntry('application', 5),
      makeEntry('apply', 3),
      makeEntry('banana', 8),
    ]);
    const results = await findFrequencyByPrefix(LANG, 'app');
    expect(results).toHaveLength(3);
    expect(results.map((e) => e.term).sort()).toEqual(['apple', 'application', 'apply']);
  });

  it('findFrequencyBySuffix returns entries ending with suffix (via backwardTerm)', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('running', 10),
      makeEntry('walking', 5),
      makeEntry('apple', 3),
    ]);
    const results = await findFrequencyBySuffix(LANG, 'ing');
    expect(results).toHaveLength(2);
    expect(results.map((e) => e.term).sort()).toEqual(['running', 'walking']);
  });

  it('countFrequencyByResource returns count', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('a', 1),
      makeEntry('b', 2),
      makeEntry('c', 3),
    ]);
    await expect(countFrequencyByResource(LANG, RESOURCE_ID)).resolves.toBe(3);
  });

  it('countFrequencyByResource returns 0 for empty resource', async () => {
    await expect(countFrequencyByResource(LANG, 9999)).resolves.toBe(0);
  });

  it('deleteFrequencyByResource removes all entries for resource', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('a', 1),
      makeEntry('b', 2),
    ]);
    await deleteFrequencyByResource(LANG, RESOURCE_ID);
    await expect(countFrequencyByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
  });

  it('deleteFrequencyByResource does not affect other resources', async () => {
    await bulkInsertFrequencyEntries(LANG, [
      makeEntry('a', 1, RESOURCE_ID),
      makeEntry('b', 2, RESOURCE_ID),
      makeEntry('c', 3, 2),
    ]);
    await deleteFrequencyByResource(LANG, RESOURCE_ID);
    await expect(countFrequencyByResource(LANG, RESOURCE_ID)).resolves.toBe(0);
    await expect(countFrequencyByResource(LANG, 2)).resolves.toBe(1);
  });
});


