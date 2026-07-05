import 'fake-indexeddb/auto';
import { TxtLineStrategy } from '@/features/dictionary/strategies/txtLineStrategy';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { findFrequencyByResource } from '@/features/dictionary/repositories/frequencyRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';
import { zipSync, strToU8 } from 'fflate';

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

describe('txtLineStrategy', () => {
  it('parses TXT line-by-line with order-based frequency', async () => {
    const resourceId = await addResource(LANG, {
      name: 'test.txt', langCode: LANG, type: 'FREQUENCY', format: 'txt',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8('hello\nworld\nfoo\n\nbar\n');
    const strategy = new TxtLineStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'test.txt' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(4);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.term).sort()).toEqual(['bar', 'foo', 'hello', 'world']);
  });

  it('auto-unzips .zip containing .txt', async () => {
    const resourceId = await addResource(LANG, {
      name: 'test.zip', langCode: LANG, type: 'FREQUENCY', format: 'txt',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const zipped = zipSync({ 'words.txt': strToU8('apple\nbanana\n') });
    const strategy = new TxtLineStrategy(
      { resourceId, langCode: LANG },
      { data: zipped, fileName: 'test.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['apple', 'banana']);
  });

  it('throws CorruptedFileError if zip has no .txt', async () => {
    const zipped = zipSync({ 'data.json': strToU8('[]') });
    const strategy = new TxtLineStrategy(
      { resourceId: 1, langCode: LANG },
      { data: zipped, fileName: 'test.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/No \.txt file/);
  });

  it('skips empty lines', async () => {
    const resourceId = await addResource(LANG, {
      name: 'test.txt', langCode: LANG, type: 'FREQUENCY', format: 'txt',
      signature: 'sig3', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8('\n\nhello\n\n\nworld\n\n');
    const strategy = new TxtLineStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'test.txt' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });

  it('normalizes terms (trim + lowercase)', async () => {
    const resourceId = await addResource(LANG, {
      name: 'test.txt', langCode: LANG, type: 'FREQUENCY', format: 'txt',
      signature: 'sig4', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8('  HELLO  \n  World  \n');
    const strategy = new TxtLineStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'test.txt' },
    );
    await strategy.execute();
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['hello', 'world']);
  });
});
