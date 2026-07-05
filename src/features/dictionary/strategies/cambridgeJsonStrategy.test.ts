import 'fake-indexeddb/auto';
import { CambridgeJsonStrategy } from '@/features/dictionary/strategies/cambridgeJsonStrategy';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { findDictionaryByResource } from '@/features/dictionary/repositories/dictionaryRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';
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

describe('cambridgeJsonStrategy', () => {
  it('parses Cambridge JSON array with rich fields', async () => {
    const resourceId = await addResource(LANG, {
      name: 'cambridge.json', langCode: LANG, type: 'DICTIONARY', format: 'cambridge-json',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify([
      { term: 'hello', altterm: 'hi', pronunciation: 'həˈloʊ', definition: 'greeting', pos: 'noun', examples: 'Hello world', audio: 'hello.mp3' },
      { term: 'world', definition: 'the earth' },
    ]));
    const strategy = new CambridgeJsonStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    const entries = await findDictionaryByResource(LANG, resourceId);
    expect(entries).toHaveLength(2);
    const hello = entries.find((e) => e.term === 'hello');
    expect(hello?.definition).toBe('greeting');
    expect(hello?.pos).toBe('noun');
    expect(hello?.pronunciation).toBe('həˈloʊ');
  });

  it('skips entries without term', async () => {
    const resourceId = await addResource(LANG, {
      name: 'cambridge.json', langCode: LANG, type: 'DICTIONARY', format: 'cambridge-json',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify([
      { term: 'hello', definition: 'greeting' },
      { definition: 'no term' },
      { term: '', definition: 'empty term' },
    ]));
    const strategy = new CambridgeJsonStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
  });

  it('throws ParseError if not array', async () => {
    const data = strToU8('{"term": "hello"}');
    const strategy = new CambridgeJsonStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/expected array/);
  });

  it('throws ParseError on invalid JSON', async () => {
    const data = strToU8('{invalid json}');
    const strategy = new CambridgeJsonStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/invalid JSON/);
  });
});
