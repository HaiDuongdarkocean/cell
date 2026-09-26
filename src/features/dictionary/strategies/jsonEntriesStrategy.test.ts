import 'fake-indexeddb/auto';
import { JsonEntriesStrategy } from '@/features/dictionary/strategies/jsonEntriesStrategy';
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

describe('jsonEntriesStrategy', () => {
  it('parses Cambridge JSON array with rich fields', async () => {
    const resourceId = await addResource(LANG, {
      name: 'cambridge.json', langCode: LANG, type: 'DICTIONARY', format: 'json-entries',
      signature: 'sig1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify([
      { term: 'hello', altterm: 'hi', pronunciation: 'həˈloʊ', definition: 'greeting', pos: 'noun', examples: 'Hello world', audio: 'hello.mp3' },
      { term: 'world', definition: 'the earth' },
    ]));
    const strategy = new JsonEntriesStrategy(
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

  it('passes canonical rich fields through verbatim', async () => {
    const resourceId = await addResource(LANG, {
      name: 'rich.json', langCode: LANG, type: 'DICTIONARY', format: 'json-entries',
      signature: 'sig-rich', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const senses = [{
      pos: 'verb', labels: ['transitive'], level: 'B1',
      lines: [{ role: 'gloss', text: 'to carry', translation: 'mang' }],
      synonyms: ['bring'], antonyms: ['leave'],
    }];
    const data = strToU8(JSON.stringify([{
      term: 'take', definition: '', senses, level: 'B1',
      related: [{ term: 'take off', kind: 'phrasal', preview: 'cất cánh' }],
      etymology: { chain: 'from Old English tacan', firstKnownUse: '12th century' },
      wordFamily: { nouns: ['taking'] },
      derivedTerms: ['taker'],
    }]));
    const strategy = new JsonEntriesStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'rich.json' },
    );
    await strategy.execute();
    const [stored] = await findDictionaryByResource(LANG, resourceId);
    expect(stored?.senses).toEqual(senses);
    expect(stored?.related).toEqual([{ term: 'take off', kind: 'phrasal', preview: 'cất cánh' }]);
    expect(stored?.level).toBe('B1');
    expect(stored?.etymology?.chain).toBe('from Old English tacan');
    expect(stored?.wordFamily?.nouns).toEqual(['taking']);
    expect(stored?.derivedTerms).toEqual(['taker']);
  });

  it('skips entries without term', async () => {
    const resourceId = await addResource(LANG, {
      name: 'cambridge.json', langCode: LANG, type: 'DICTIONARY', format: 'json-entries',
      signature: 'sig2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const data = strToU8(JSON.stringify([
      { term: 'hello', definition: 'greeting' },
      { definition: 'no term' },
      { term: '', definition: 'empty term' },
    ]));
    const strategy = new JsonEntriesStrategy(
      { resourceId, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
  });

  it('throws ParseError if not array', async () => {
    const data = strToU8('{"term": "hello"}');
    const strategy = new JsonEntriesStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/expected array/);
  });

  it('throws ParseError on invalid JSON', async () => {
    const data = strToU8('{invalid json}');
    const strategy = new JsonEntriesStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'cambridge.json' },
    );
    await expect(strategy.execute()).rejects.toThrow(/invalid JSON/);
  });
});
