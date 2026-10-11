import 'fake-indexeddb/auto';
import { TermBankStrategy } from '@/features/dictionary/strategies/termBankStrategy';
import { unzipAll } from '@/features/dictionary/logic/fileDetector';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { findFrequencyByResource } from '@/features/dictionary/repositories/resourceEntryRepository';
import { findDictionaryByResource } from '@/features/dictionary/repositories/resourceEntryRepository';
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

function makeTermBankFreqZip(entries: unknown[]): Uint8Array {
  return zipSync({
    'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
    'term_meta_bank_1.json': strToU8(JSON.stringify(entries)),
  });
}

function makeTermBankDictZip(termBanks: unknown[][]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
  };
  termBanks.forEach((bank, i) => {
    files[`term_bank_${i + 1}.json`] = strToU8(JSON.stringify(bank));
  });
  return zipSync(files);
}

describe('termBankStrategy — frequency (term_meta_bank)', () => {
  it('parses term-bank term_meta_bank with freq type', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'term-bank',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const entries = [
      ['hello', 'freq', { reading: 'hello', frequency: 100 }],
      ['world', 'freq', { reading: 'world', frequency: 50 }],
      ['foo', 'pitch', { reading: 'foo' }],
    ];
    const data = makeTermBankFreqZip(entries);
    const strategy = new TermBankStrategy(
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
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'term-bank',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = makeTermBankFreqZip([['hello', 'freq', 42]]);
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await strategy.execute();
    const stored = await findFrequencyByResource(LANG, resourceId);
    expect(stored[0]?.frequency).toBe(42);
  });

  it('throws ParseError if no index.json', async () => {
    const data = zipSync({ 'term_meta_bank_1.json': strToU8('[]') });
    const strategy = new TermBankStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/index\.json not found/);
  });

  it('throws ParseError if no term_meta_bank files (frequency mode)', async () => {
    const data = zipSync({ 'index.json': strToU8('{}') });
    const strategy = new TermBankStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/no term_bank_\*.json or term_meta_bank_\*.json/);
  });

  it('sorts multiple term_meta_bank files', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'FREQUENCY', format: 'term-bank',
      signature: 'sig3', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = zipSync({
      'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
      'term_meta_bank_2.json': strToU8(JSON.stringify([['z', 'freq', { frequency: 1 }]])),
      'term_meta_bank_1.json': strToU8(JSON.stringify([['a', 'freq', { frequency: 2 }]])),
    });
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });
});

describe('termBankStrategy — dictionary (term_bank)', () => {
  it('parses term-bank term_bank into dictionary entries', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict-oald.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    // term-bank term_bank format: [expression, reading, defTags, rules, score, definitions[]]
    const termBank = [
      ['hello', 'hello', 'noun', 'n', 0, ['a greeting']],
      ['world', 'world', 'noun', 'n', 0, ['the earth']],
    ];
    const data = makeTermBankDictZip([termBank]);
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict-oald.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const stored = await findDictionaryByResource(LANG, resourceId);
    expect(stored).toHaveLength(2);
    const hello = stored.find((e) => e.term === 'hello');
    expect(hello?.definition).toBe('a greeting');
  });

  it('serializes multiple definitions to canonical senses', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const termBank = [
      ['hello', '', 'noun', 'n', 0, ['greeting', 'salutation']],
    ];
    const data = makeTermBankDictZip([termBank]);
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await strategy.execute();
    const stored = await findDictionaryByResource(LANG, resourceId);
    // List-shaped defs normalize to canonical `<br><br>N.` sense boundaries.
    expect(stored[0]?.definition).toBe('1.greeting<br><br>2.salutation');
    expect(stored[0]?.pos).toBe('noun');
  });

  it('uses expression as reading when reading is empty', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d3', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const termBank = [['hello', '', 'noun', 'n', 0, ['greeting']]];
    const data = makeTermBankDictZip([termBank]);
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await strategy.execute();
    const stored = await findDictionaryByResource(LANG, resourceId);
    // term normalized to lowercase, reading falls back to expression
    expect(stored[0]?.term).toBe('hello');
  });

  it('throws ParseError if no term_bank files (dictionary mode)', async () => {
    const data = zipSync({ 'index.json': strToU8('{}') });
    const strategy = new TermBankStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/no term_bank/);
  });

  it('sorts multiple term_bank files', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d4', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = zipSync({
      'index.json': strToU8(JSON.stringify({ title: 'test', revision: '1', format: 3 })),
      'term_bank_2.json': strToU8(JSON.stringify([['z', 'z', 'n', 'n', 0, ['z-def']]])),
      'term_bank_1.json': strToU8(JSON.stringify([['a', 'a', 'n', 'n', 0, ['a-def']]])),
    });
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'dict.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });

  it('parses each bank file exactly once (no separate count pass)', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d5', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = makeTermBankDictZip([
      [['__bank_one__', 'x', 'n', 'n', 0, ['one']]],
      [['__bank_two__', 'y', 'n', 'n', 0, ['two']]],
    ]);
    const parseSpy = jest.spyOn(JSON, 'parse');
    try {
      const strategy = new TermBankStrategy(
        { resourceId, langCode: LANG },
        { data, fileName: 'dict.zip' },
      );
      const result = await strategy.execute();
      expect(result.wordCount).toBe(2);
    } finally {
      const bankParses = (marker: string) =>
        parseSpy.mock.calls.filter(([src]) => typeof src === 'string' && src.includes(marker)).length;
      expect(bankParses('__bank_one__')).toBe(1);
      expect(bankParses('__bank_two__')).toBe(1);
      parseSpy.mockRestore();
    }
  });

  it('reuses a caller-provided unzip map instead of re-inflating data', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d6', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const zipFiles = unzipAll(makeTermBankDictZip([
      [['solo', 'solo', 'n', 'n', 0, ['only-def']]],
    ]));
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG },
      { data: new Uint8Array(0), fileName: 'dict.zip', zipFiles },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
    const stored = await findDictionaryByResource(LANG, resourceId);
    expect(stored[0]?.term).toBe('solo');
  });

  it('grows the progress total cumulatively as banks parse', async () => {
    const resourceId = await addResource(LANG, {
      name: 'dict.zip', langCode: LANG, type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-d7', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const bank1 = Array.from({ length: 5000 }, (_, i) => [`t${i}`, `t${i}`, 'n', 'n', 0, [`d${i}`]]);
    const bank2 = Array.from({ length: 100 }, (_, i) => [`u${i}`, `u${i}`, 'n', 'n', 0, [`e${i}`]]);
    const data = makeTermBankDictZip([bank1, bank2]);
    const progress: Array<[number, number]> = [];
    const strategy = new TermBankStrategy(
      { resourceId, langCode: LANG, onProgress: (p, t) => progress.push([p, t]) },
      { data, fileName: 'dict.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(5100);
    expect(progress[0]).toEqual([2000, 5000]);
    expect(progress[progress.length - 1]).toEqual([5100, 5100]);
    expect(progress.some(([, total]) => total < 5100)).toBe(true);
  });
});
