// lookupOrchestrator tests — spec §4.6.3/§9.4.

import 'fake-indexeddb/auto';
import { lookupOrchestrator, createDictionaryProbeAsync } from './lookupOrchestrator';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';
import { addDictionaryEntry } from '@/features/dictionary/repositories/dictionaryRepository';
import { addFrequencyEntry } from '@/features/dictionary/repositories/frequencyRepository';
import { putPhraseIndex } from '@/features/dictionary/repositories/phraseIndexRepository';
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
  await clearAllStores('zh');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const TEST_VERBS = new Set(['be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick', 'put', 'look']);

async function seedEnglishDictionary(
  entries: { term: string; definition: string; pos?: string; reading?: string }[],
  phrases: string[] = [],
): Promise<number> {
  const resourceId = await addResource('en', {
    name: 'cambridge.json',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: `en-sig-${Date.now()}-${Math.random()}`,
    wordCount: entries.length,
    installationFinished: true,
    importedAt: Date.now(),
  });
  for (const e of entries) {
    await addDictionaryEntry('en', {
      resourceId,
      term: e.term,
      reading: e.reading ?? '',
      altterm: '',
      pronunciation: '',
      definition: e.definition,
      pos: e.pos ?? '',
      examples: '',
      audio: '',
    });
  }
  if (phrases.length > 0) {
    const inputs: PhraseIndexInput[] = phrases.map((t, i) => {
      const parsed = parsePhraseTemplate(t, { inflectableLiterals: TEST_VERBS });
      if (parsed.status !== 'supported') throw new Error(`unsupported: ${t}`);
      return {
        templateId: i,
        sourceTerm: parsed.sourceTerm,
        normalizedTerm: parsed.normalizedTerm,
        nodes: parsed.nodes,
        fixedTokenCount: parsed.fixedTokenCount,
        minSurfaceTokens: parsed.minSurfaceTokens,
        maxSurfaceTokens: parsed.maxSurfaceTokens,
        frequencyRank: 0,
      };
    });
    const index = compilePhraseIndex(inputs);
    await putPhraseIndex('en', resourceId, serializePhraseIndex(index), {
      compilerVersion: index.compilerVersion,
      termCount: index.termCount,
    });
  }
  return resourceId;
}

async function seedChineseDictionary(entries: { term: string; definition: string; reading?: string }[]): Promise<number> {
  const resourceId = await addResource('zh', {
    name: 'cedict.json',
    langCode: 'zh',
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: `zh-sig-${Date.now()}-${Math.random()}`,
    wordCount: entries.length,
    installationFinished: true,
    importedAt: Date.now(),
  });
  for (const e of entries) {
    await addDictionaryEntry('zh', {
      resourceId,
      term: e.term,
      reading: e.reading ?? '',
      altterm: '',
      pronunciation: '',
      definition: e.definition,
      pos: '',
      examples: '',
      audio: '',
    });
  }
  return resourceId;
}

describe('lookupOrchestrator — English', () => {
  it('returns a phrase match with definitions from dictionary', async () => {
    await seedEnglishDictionary(
      [{ term: 'kick the bucket', definition: 'to die (informal)', pos: 'idiom' }],
      ['kick the bucket'],
    );

    const result = await lookupOrchestrator({
      term: 'kicked',
      langCode: 'en',
      contextSentence: 'He kicked the bucket.',
      cursorOffset: 3,
    });

    expect(result.term).toBe('kick the bucket');
    expect(result.detectedPhrase).not.toBeNull();
    expect(result.detectedPhrase?.dictionaryTerm).toBe('kick the bucket');
    expect(result.matchSource).toBe('plugin');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('to die (informal)');
    expect(result.partsOfSpeech).toContain('idiom');
    expect(result.readingKind).toBe('ipa');
  });

  it('falls back to single-word lookup when no phrase matches', async () => {
    await seedEnglishDictionary(
      [
        { term: 'kick the bucket', definition: 'to die' },
        { term: 'hello', definition: 'a greeting', pos: 'noun' },
      ],
      ['kick the bucket'],
    );

    const result = await lookupOrchestrator({
      term: 'hello',
      langCode: 'en',
      contextSentence: 'She said hello to him.',
      cursorOffset: 9,
    });

    expect(result.term).toBe('hello');
    expect(result.detectedPhrase).toBeNull();
    expect(result.matchSource).toBe('dictionary');
    expect(result.definitions[0]!.text).toBe('a greeting');
  });

  it('returns empty definitions when term not in dictionary', async () => {
    await seedEnglishDictionary([]);

    const result = await lookupOrchestrator({
      term: 'unknownword',
      langCode: 'en',
      contextSentence: 'This is an unknownword here.',
      cursorOffset: 11,
    });

    expect(result.term).toBe('unknownword');
    expect(result.definitions).toEqual([]);
    expect(result.matchSource).toBe('dictionary');
  });

  it('uses fallback mode when fallback=true (verbatim term, no phrase match)', async () => {
    await seedEnglishDictionary(
      [{ term: 'kick the bucket', definition: 'to die' }],
      ['kick the bucket'],
    );

    const result = await lookupOrchestrator({
      term: 'my selection',
      langCode: 'en',
      contextSentence: 'He kicked the bucket.',
      cursorOffset: 3,
      fallback: true,
    });

    expect(result.term).toBe('my selection');
    expect(result.detectedPhrase).toBeNull();
    expect(result.matchSource).toBe('fallback');
  });

  it('includes frequency when available', async () => {
    const resourceId = await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);
    await addFrequencyEntry('en', {
      resourceId,
      term: 'hello',
      reading: '',
      frequency: 500,
    });

    const result = await lookupOrchestrator({
      term: 'hello',
      langCode: 'en',
      contextSentence: 'Hello world.',
      cursorOffset: 0,
    });

    expect(result.frequency).not.toBeNull();
    expect(result.frequency?.rank).toBe(500);
  });

  it('aborts when signal is already aborted', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      lookupOrchestrator(
        { term: 'hello', langCode: 'en', contextSentence: 'Hello.', cursorOffset: 0 },
        {},
        controller.signal,
      ),
    ).rejects.toThrow(/aborted/i);
  });

  it('splits all Cambridge senses including idiom markers without POS', async () => {
    // Real Cambridge JSON shape for "question": 23 senses, some idioms have no
    // POS in parentheses right after the number (e.g. 17.bring/call...).
    const questionDefinition = `1.(noun) a sentence or phrase used to find out information<br><br>2.(noun) in an exam, a problem that tests a person's knowledge or ability<br><br>3.(noun) any matter that needs to be dealt with or considered<br><br>4.(noun) doubt or confusion<br><br>5.sb/sth in question<br>(noun) the person or thing that is being discussed<br><br>6.(verb [ T ]) to ask a person about something, especially officially<br><br>7.(verb [ T ]) to express doubts about the value or truth of something<br><br>8.(noun) a word or words used to find out information<br><br>9.(noun) a matter to be dealt with or discussed, or a problem to be solved<br><br>10.(noun) In an exam, a question is a problem that tests a person's knowledge<br><br>11.(noun) doubt or uncertainty<br><br>12.(verb [ T ]) to use a word or words to find out information<br><br>13.(verb [ T ]) If you question something, you express doubt or uncertainty about it<br><br>14.(noun) a sentence or phrase that asks for information<br><br>15.(noun) a subject or problem<br><br>16.(noun) a feeling of doubt about something<br><br>17.bring/call sth into question<br>(noun) to express doubt about something<br><br>18.(noun) to make people feel doubt about something<br><br>19.in question<br>(noun) that is being discussed<br><br>20.(noun) if something is in question, no-one knows what is going to happen to it<br><br>21.out of the question<br>(noun) if something is out of the question, it definitely will not or cannot happen<br><br>22.(verb [ T ]) to ask someone questions about something<br><br>23.(verb [ T ]) to express doubts about something<br><br>`;
    await seedEnglishDictionary([{ term: 'question', definition: questionDefinition, pos: '' }]);

    const result = await lookupOrchestrator({
      term: 'question',
      langCode: 'en',
      contextSentence: 'Can I ask a question?',
      cursorOffset: 15,
    });

    expect(result.definitions).toHaveLength(23);
    // Idiom markers are split into their own senses and stripped of numbers.
    expect(result.definitions[15]!.text).toBe('a feeling of doubt about something');
    expect(result.definitions[16]!.text).toContain('bring/call sth into question');
    expect(result.definitions[16]!.pos).toBe('noun');
    expect(result.definitions[16]!.text).not.toMatch(/^\d+\./);
    expect(result.definitions[18]!.text).toContain('in question');
    expect(result.definitions[18]!.pos).toBe('noun');
    expect(result.definitions[20]!.text).toContain('out of the question');
    expect(result.definitions[20]!.pos).toBe('noun');
    expect(result.definitions[22]!.text).toBe('to express doubts about something');
  });
});

describe('lookupOrchestrator — Chinese', () => {
  it('segments and looks up the correct term', async () => {
    await seedChineseDictionary([
      { term: '喜欢', definition: 'to like', reading: 'xǐ huan' },
      { term: '我', definition: 'I, me', reading: 'wǒ' },
      { term: '你', definition: 'you', reading: 'nǐ' },
    ]);

    // Debug: check probe
    const probe = await createDictionaryProbeAsync('zh');
    console.log('probe has 喜欢:', probe.hasTerm('喜欢'));
    console.log('probe has 我:', probe.hasTerm('我'));

    const result = await lookupOrchestrator({
      term: '喜',
      langCode: 'zh',
      contextSentence: '我喜欢你',
      cursorOffset: 1, // cursor on 喜
    });
    console.log('Chinese result:', JSON.stringify({ term: result.term, matchSource: result.matchSource, defs: result.definitions.length }));

    expect(result.term).toBe('喜欢');
    expect(result.matchSource).toBe('plugin');
    expect(result.definitions[0]!.text).toBe('to like');
    expect(result.reading).toBe('xǐ huan');
    expect(result.readingKind).toBe('pinyin');
  });

  it('falls back to single char when no multi-char term in dict', async () => {
    await seedChineseDictionary([{ term: '我', definition: 'I, me', reading: 'wǒ' }]);

    const result = await lookupOrchestrator({
      term: '喜',
      langCode: 'zh',
      contextSentence: '我喜欢你',
      cursorOffset: 1,
    });

    // '喜' is not in dict → FMM emits single char → no dict entry → empty.
    expect(result.term).toBe('喜');
    expect(result.definitions).toEqual([]);
  });
});

describe('lookupOrchestrator — fallback language', () => {
  it('uses the hovered token for unknown languages', async () => {
    const result = await lookupOrchestrator({
      term: 'bonjour',
      langCode: 'fr',
      contextSentence: 'Bonjour monde.',
      cursorOffset: 0,
    });

    expect(result.term).toBe('bonjour');
    expect(result.matchSource).toBe('dictionary');
    expect(result.readingKind).toBe('none');
    expect(result.definitions).toEqual([]);
  });
});

describe('createDictionaryProbeAsync', () => {
  it('creates a probe that returns true for dictionary terms', async () => {
    await seedChineseDictionary([{ term: '喜欢', definition: 'to like' }]);
    const probe = await createDictionaryProbeAsync('zh');
    expect(probe.hasTerm('喜欢')).toBe(true);
    expect(probe.hasTerm('不存在的词')).toBe(false);
  });

  it('is case-insensitive', async () => {
    await seedEnglishDictionary([{ term: 'Hello', definition: 'greeting' }]);
    const probe = await createDictionaryProbeAsync('en');
    expect(probe.hasTerm('hello')).toBe(true);
    expect(probe.hasTerm('HELLO')).toBe(true);
  });
});
