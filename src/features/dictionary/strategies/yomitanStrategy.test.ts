import 'fake-indexeddb/auto';
import { YomitanStrategy } from '@/features/dictionary/strategies/yomitanStrategy';
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

function makeYomitanZip(entries: unknown[]): Uint8Array {
  return zipSync({
    'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
    'term_meta_bank_1.json': strToU8(JSON.stringify(entries)),
  });
}

describe('yomitanStrategy', () => {
  it('parses Yomitan term_meta_bank with freq type', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'yomitan',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const entries = [
      ['hello', 'freq', { reading: 'hello', frequency: 100 }],
      ['world', 'freq', { reading: 'world', frequency: 50 }],
      ['foo', 'pitch', { reading: 'foo' }], // non-freq, skipped
    ];
    const data = makeYomitanZip(entries);
    const strategy = new YomitanStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const stored = await findFrequencyByResource(LANG, resourceId);
    expect(stored.map((e) => e.term).sort()).toEqual(['hello', 'world']);
    expect(stored.find((e) => e.term === 'hello')?.frequency).toBe(100);
  });

  it('handles frequency as plain number (not object)', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'yomitan',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const entries = [
      ['hello', 'freq', 42],
    ];
    const data = makeYomitanZip(entries);
    const strategy = new YomitanStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await strategy.execute();
    const stored = await findFrequencyByResource(LANG, resourceId);
    expect(stored[0]?.frequency).toBe(42);
  });

  it('throws ParseError if no index.json', async () => {
    const data = zipSync({ 'term_meta_bank_1.json': strToU8('[]') });
    const strategy = new YomitanStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/index\.json not found/);
  });

  it('throws ParseError if no term_meta_bank files', async () => {
    const data = zipSync({ 'index.json': strToU8('{}') });
    const strategy = new YomitanStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/no term_meta_bank/);
  });

  it('sorts multiple term_meta_bank files', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'yomitan',
      signature: 'sig3', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = zipSync({
      'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
      'term_meta_bank_2.json': strToU8(JSON.stringify([['z', 'freq', { frequency: 1 }]])),
      'term_meta_bank_1.json': strToU8(JSON.stringify([['a', 'freq', { frequency: 2 }]])),
    });
    const strategy = new YomitanStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });
});
