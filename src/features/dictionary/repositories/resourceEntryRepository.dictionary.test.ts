import 'fake-indexeddb/auto';
import {
  bulkInsertDictionaryEntries,
  bulkInsertFrequencyEntries,
  findDictionaryByTerms,
} from '@/features/dictionary/repositories/resourceEntryRepository';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import type { DictionaryEntry } from '@/entities/dictionary';

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

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllDBs();
  await clearAllStores(LANG);
});

afterEach(() => {
  closeAllDBs();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const LANG = 'zh';

function makeEntry(term: string, resourceId = 1, reading = ''): Omit<DictionaryEntry, 'id'> {
  return {
    resourceId,
    term,
    reading,
    altterm: '',
    pronunciation: '',
    definition: '',
    pos: '',
    examples: '',
    audio: '',
  };
}

describe('findDictionaryByTerms', () => {
  it('returns an empty map for empty terms', async () => {
    const result = await findDictionaryByTerms(LANG, []);
    expect(result.size).toBe(0);
  });

  it('returns dict rows for requested terms and empty arrays for missing terms', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeEntry('你好', 1, 'nǐ hǎo'),
      makeEntry('再见', 1, 'zài jiàn'),
    ]);

    const result = await findDictionaryByTerms(LANG, ['再见', '没有', '你好']);

    expect(result.get('你好')?.[0]?.reading).toBe('nǐ hǎo');
    expect(result.get('再见')?.[0]?.reading).toBe('zài jiàn');
    expect(result.get('没有')).toEqual([]);
  });

  it('skips frequency rows sharing the same term index', async () => {
    await bulkInsertDictionaryEntries(LANG, [makeEntry('走', 1, 'zǒu')]);
    await bulkInsertFrequencyEntries(LANG, [
      { resourceId: 9, term: '走', reading: 'freq-reading', frequency: 100 },
    ]);

    const result = await findDictionaryByTerms(LANG, ['走']);

    expect(result.get('走')).toHaveLength(1);
    expect(result.get('走')?.[0]?.reading).toBe('zǒu');
  });

  it('restricts results to the provided resourceIds', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeEntry('你好', 1, 'nǐ hǎo'),
      makeEntry('你好', 2, 'néih hóu'),
    ]);

    const result = await findDictionaryByTerms(LANG, ['你好'], new Set([2]));

    expect(result.get('你好')).toHaveLength(1);
    expect(result.get('你好')?.[0]?.reading).toBe('néih hóu');
  });

  it('handles duplicates and unsorted input', async () => {
    await bulkInsertDictionaryEntries(LANG, [
      makeEntry('苹果', 1, 'píng guǒ'),
      makeEntry('苹果', 2, 'bìng gwó'),
    ]);

    const result = await findDictionaryByTerms(LANG, ['苹果', '苹果']);

    expect(result.get('苹果')).toHaveLength(2);
  });
});
