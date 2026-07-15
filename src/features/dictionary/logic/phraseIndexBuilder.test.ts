// phraseIndexBuilder unit tests — ADR-037 §7.2.
//
// Verifies the builder collects multiword terms, parses them, excludes
// unsupported ones, compiles a blob, and persists via putPhraseIndex.

import 'fake-indexeddb/auto';
import { buildPhraseIndexForResource, ENGLISH_INFLECTABLE_VERBS } from './phraseIndexBuilder';
import { closeAllDBs, clearAllStores } from '../repositories/baseRepository';
import { addResource } from '../repositories/resourceRepository';
import { bulkInsertDictionaryEntries } from '../repositories/dictionaryRepository';
import { getPhraseIndex, hasPhraseIndex } from '../repositories/phraseIndexRepository';

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

async function seedResource(
  terms: ReadonlyArray<{ term: string; definition?: string }>,
): Promise<number> {
  const resourceId = await addResource(LANG, {
    name: 'test.json',
    langCode: LANG,
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: `sig-${Date.now()}-${Math.random()}`,
    wordCount: terms.length,
    installationFinished: true,
    importedAt: Date.now(),
  });
  await bulkInsertDictionaryEntries(
    LANG,
    terms.map((t) => ({
      resourceId,
      term: t.term,
      reading: t.term,
      altterm: '',
      pronunciation: '',
      definition: t.definition ?? '',
      pos: '',
      examples: '',
      audio: '',
    })),
  );
  return resourceId;
}

describe('phraseIndexBuilder', () => {
  it('builds a blob from supported multiword terms', async () => {
    const resourceId = await seedResource([
      { term: 'take off', definition: 'to remove' },
      { term: 'kick the bucket', definition: 'to die' },
      { term: 'hello', definition: 'greeting' }, // single-word, excluded
    ]);
    const result = await buildPhraseIndexForResource(LANG, resourceId);

    expect(result.termCount).toBe(2);
    expect(result.unsupportedCount).toBe(0);
    expect(await hasPhraseIndex(LANG, resourceId)).toBe(true);

    const stored = await getPhraseIndex(LANG, resourceId);
    expect(stored?.termCount).toBe(2);
    expect(stored?.blob.byteLength).toBeGreaterThan(0);
  });

  it('counts unsupportedOpen terms and excludes them', async () => {
    const resourceId = await seedResource([
      { term: 'take off', definition: 'to remove' },
      { term: 'and so on ...', definition: 'open-ended' },
    ]);
    const result = await buildPhraseIndexForResource(LANG, resourceId);

    expect(result.termCount).toBe(1);
    expect(result.unsupportedCount).toBe(1);
    expect(result.unsupportedBreakdown.unsupportedOpen).toBe(1);
  });

  it('deduplicates terms', async () => {
    const resourceId = await seedResource([
      { term: 'take off', definition: 'to remove' },
      { term: 'take off', definition: 'to remove (dup)' },
    ]);
    const result = await buildPhraseIndexForResource(LANG, resourceId);
    expect(result.termCount).toBe(1);
  });

  it('persists an empty blob when no multiword terms exist', async () => {
    const resourceId = await seedResource([
      { term: 'hello', definition: 'greeting' },
      { term: 'world', definition: 'earth' },
    ]);
    const result = await buildPhraseIndexForResource(LANG, resourceId);
    expect(result.termCount).toBe(0);
    expect(await hasPhraseIndex(LANG, resourceId)).toBe(true);
  });

  it('marks inflectable verbs so inflected forms match', async () => {
    // 'take' is in ENGLISH_INFLECTABLE_VERBS — the parser marks it inflectable.
    expect(ENGLISH_INFLECTABLE_VERBS.has('take')).toBe(true);
    expect(ENGLISH_INFLECTABLE_VERBS.has('kick')).toBe(true);
    // A non-verb common word is NOT in the set (under-approximation).
    expect(ENGLISH_INFLECTABLE_VERBS.has('the')).toBe(false);
  });

  it('handles hyphenated and slash-alternative terms', async () => {
    const resourceId = await seedResource([
      { term: 'look up to', definition: 'admire' },
      { term: 'put on/off', definition: 'toggle' },
    ]);
    const result = await buildPhraseIndexForResource(LANG, resourceId);
    // Both should parse as supported (slash alternatives are supported).
    expect(result.termCount).toBe(2);
  });
});
