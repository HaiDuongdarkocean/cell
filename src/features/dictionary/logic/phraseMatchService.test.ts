import 'fake-indexeddb/auto';
import {
  matchPhraseRequest,
} from '@/features/dictionary/logic/phraseMatchService';
import {
  putPhraseIndex,
} from '@/features/dictionary/repositories/phraseIndexRepository';
import {
  addDictionaryEntry,
} from '@/features/dictionary/repositories/dictionaryRepository';
import {
  addResource,
} from '@/features/dictionary/repositories/resourceRepository';
import {
  closeAllDBs,
  clearAllStores,
} from '@/features/dictionary/repositories/baseRepository';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

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

const TEST_VERBS = new Set(['be', 'spill', 'break', 'kick', 'carry', 'look', 'put']);

async function setupResourceWithPhraseIndex(
  terms: string[],
  dictEntries: { term: string; definition: string }[],
): Promise<{ resourceId: number }> {
  // 1. Create resource.
  const resourceId = await addResource('en', {
    name: 'test-dict.json',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: 'test-sig-phrase',
    wordCount: dictEntries.length,
    installationFinished: true,
    importedAt: Date.now(),
  });

  // 2. Insert dictionary entries.
  for (const e of dictEntries) {
    await addDictionaryEntry('en', {
      resourceId,
      term: e.term,
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: e.definition,
      pos: '',
      examples: '',
      audio: '',
    });
  }

  // 3. Build + store phrase index.
  const inputs: PhraseIndexInput[] = [];
  let id = 0;
  for (const term of terms) {
    const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
    if (parsed.status !== 'supported') continue;
    inputs.push({
      templateId: id++,
      sourceTerm: parsed.sourceTerm,
      normalizedTerm: parsed.normalizedTerm,
      nodes: parsed.nodes,
      fixedTokenCount: parsed.fixedTokenCount,
      minSurfaceTokens: parsed.minSurfaceTokens,
      maxSurfaceTokens: parsed.maxSurfaceTokens,
      frequencyRank: 0,
    });
  }
  const index = compilePhraseIndex(inputs);
  const blob = serializePhraseIndex(index);
  await putPhraseIndex('en', resourceId, blob, {
    compilerVersion: index.compilerVersion,
    termCount: index.termCount,
  });

  return { resourceId };
}

describe('phraseMatchService', () => {
  describe('matchPhraseRequest — phrase match', () => {
    it('returns a phrase match with definition from dictionary', async () => {
      await setupResourceWithPhraseIndex(
        ['kick the bucket'],
        [{ term: 'kick the bucket', definition: 'to die (informal)' }],
      );

      const result = await matchPhraseRequest({
        langCode: 'en',
        sentence: 'The old man kicked the bucket.',
        cursorOffset: 16, // "kicked"
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('phrase');
      expect(result!.dictionaryTerm).toBe('kick the bucket');
      expect(result!.surface).toBe('kicked the bucket');
      expect(result!.definition).toBe('to die (informal)');
    });
  });

  describe('matchPhraseRequest — fallback to single-word lookup', () => {
    it('falls back to single-word lookup when no phrase matches', async () => {
      await setupResourceWithPhraseIndex(
        ['kick the bucket'],
        [
          { term: 'kick the bucket', definition: 'to die' },
          { term: 'hello', definition: 'a greeting' },
        ],
      );

      const result = await matchPhraseRequest({
        langCode: 'en',
        sentence: 'She said hello to him.',
        cursorOffset: 9, // "hello"
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('word');
      expect(result!.dictionaryTerm).toBe('hello');
      expect(result!.definition).toBe('a greeting');
    });

    it('returns null when neither phrase nor word matches', async () => {
      await setupResourceWithPhraseIndex([], []);

      const result = await matchPhraseRequest({
        langCode: 'en',
        sentence: 'Unknown wordxyz here.',
        cursorOffset: 0,
      });

      expect(result).toBeNull();
    });
  });

  describe('matchPhraseRequest — cancellation', () => {
    it('aborts when signal is already aborted', async () => {
      await setupResourceWithPhraseIndex(['kick the bucket'], [
        { term: 'kick the bucket', definition: 'to die' },
      ]);

      const controller = new AbortController();
      controller.abort();

      await expect(
        matchPhraseRequest({
          langCode: 'en',
          sentence: 'He kicked the bucket.',
          cursorOffset: 3,
          signal: controller.signal,
        }),
      ).rejects.toThrow(/aborted/i);
    });
  });

  describe('matchPhraseRequest — no phrase index', () => {
    it('falls back to word lookup when no phrase index exists', async () => {
      const resourceId = await addResource('en', {
        name: 'dict-no-phrase.json',
        langCode: 'en',
        type: 'DICTIONARY',
        format: 'cambridge-json',
        signature: 'test-sig-no-phrase',
        wordCount: 1,
        installationFinished: true,
        importedAt: Date.now(),
      });
      await addDictionaryEntry('en', {
        resourceId,
        term: 'world',
        reading: '',
        altterm: '',
        pronunciation: '',
        definition: 'the earth',
        pos: 'noun',
        examples: '',
        audio: '',
      });

      const result = await matchPhraseRequest({
        langCode: 'en',
        sentence: 'Hello world.',
        cursorOffset: 6, // "world"
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('word');
      expect(result!.dictionaryTerm).toBe('world');
    });
  });
});
