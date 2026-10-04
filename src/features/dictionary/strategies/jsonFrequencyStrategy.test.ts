import 'fake-indexeddb/auto';
import { JsonFrequencyStrategy } from '@/features/dictionary/strategies/jsonFrequencyStrategy';
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

const ROWS = JSON.stringify([
  { term: 'alpha', rank: 1 },
  { term: 'beta', frequency: 2, pos: 'n' },
]);

async function makeResource(name: string, signature: string): Promise<number> {
  return addResource(LANG, {
    name, langCode: LANG, type: 'FREQUENCY', format: 'json-frequency',
    signature, wordCount: 0, installationFinished: false, importedAt: Date.now(),
  });
}

describe('jsonFrequencyStrategy', () => {
  it('parses a raw json-frequency file', async () => {
    const resourceId = await makeResource('freq.json', 'sig1');
    const strategy = new JsonFrequencyStrategy(
      { resourceId, langCode: LANG },
      { data: strToU8(ROWS), fileName: 'freq.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['alpha', 'beta']);
  });

  it('auto-unzips a .zip holding the json-frequency file', async () => {
    const resourceId = await makeResource('freq.zip', 'sig2');
    const zipped = zipSync({ 'freq.json': strToU8(ROWS) });
    const strategy = new JsonFrequencyStrategy(
      { resourceId, langCode: LANG },
      { data: zipped, fileName: 'freq.zip' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const entries = await findFrequencyByResource(LANG, resourceId);
    expect(entries.map((e) => e.term).sort()).toEqual(['alpha', 'beta']);
  });

  it('auto-gunzips .json.gz', async () => {
    const resourceId = await makeResource('freq.json.gz', 'sig3');
    const strategy = new JsonFrequencyStrategy(
      { resourceId, langCode: LANG },
      { data: gzipSync(strToU8(ROWS)), fileName: 'freq.json.gz' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
  });

  it('rejects a zip holding two data-shaped .json files', async () => {
    const resourceId = await makeResource('mixed.zip', 'sig4');
    const zipped = zipSync({
      'freq.json': strToU8(ROWS),
      'more.json': strToU8(JSON.stringify(['x', 'y'])),
    });
    const strategy = new JsonFrequencyStrategy(
      { resourceId, langCode: LANG },
      { data: zipped, fileName: 'mixed.zip' },
    );
    await expect(strategy.execute()).rejects.toThrow(/import them one at a time/);
  });

  it('throws ParseError for non-array JSON', async () => {
    const strategy = new JsonFrequencyStrategy(
      { resourceId: 1, langCode: LANG },
      { data: strToU8('{"a":1}'), fileName: 'freq.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/JSON array of frequency objects/);
  });
});
