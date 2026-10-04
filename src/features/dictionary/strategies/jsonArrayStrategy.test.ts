import 'fake-indexeddb/auto';
import { JsonArrayStrategy } from '@/features/dictionary/strategies/jsonArrayStrategy';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { findFrequencyByResource } from '@/features/dictionary/repositories/resourceEntryRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';
import { strToU8, zipSync, gzipSync } from 'fflate';

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

describe('jsonArrayStrategy', () => {
  it('parses JSON array of strings', async () => {
    const resourceId = await addResource(LANG, {
      name: 'freq.json', langCode: LANG, type: 'FREQUENCY', format: 'json-array',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify(['hello', 'world', 'foo']));
    const strategy = new JsonArrayStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'freq.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(3);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['foo', 'hello', 'world']);
  });

  it('handles escaped strings', async () => {
    const resourceId = await addResource(LANG, {
      name: 'freq.json', langCode: LANG, type: 'FREQUENCY', format: 'json-array',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify(['hello "world"', 'line\nbreak']));
    const strategy = new JsonArrayStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'freq.json' },
    );
    await strategy.execute();
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['hello "world"', 'line\nbreak']);
  });

  it('throws ParseError if not JSON array', async () => {
    const data = strToU8('{"key": "value"}');
    const strategy = new JsonArrayStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'freq.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/Expected JSON array/);
  });

  it('auto-unzips .zip containing a .json array', async () => {
    const resourceId = await addResource(LANG, {
      name: 'freq.zip', langCode: LANG, type: 'FREQUENCY', format: 'json-array',
      signature: 'sig4', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const zipped = zipSync({ 'freq.json': strToU8(JSON.stringify(['alpha', 'beta'])) });
    const strategy = new JsonArrayStrategy(
      { resourceId, langCode: LANG },
      { data: zipped, fileName: 'freq.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['alpha', 'beta']);
  });

  it('auto-gunzips .json.gz', async () => {
    const resourceId = await addResource(LANG, {
      name: 'freq.json.gz', langCode: LANG, type: 'FREQUENCY', format: 'json-array',
      signature: 'sig5', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const gzipped = gzipSync(strToU8(JSON.stringify(['alpha', 'beta'])));
    const strategy = new JsonArrayStrategy(
      { resourceId, langCode: LANG },
      { data: gzipped, fileName: 'freq.json.gz' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });

  it('handles empty array', async () => {
    const resourceId = await addResource(LANG, {
      name: 'freq.json', langCode: LANG, type: 'FREQUENCY', format: 'json-array',
      signature: 'sig3', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8('[]');
    const strategy = new JsonArrayStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'freq.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(0);
  });
});
