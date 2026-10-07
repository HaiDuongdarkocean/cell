// lookupOrchestrator tests — spec §4.6.3/§9.4.

import 'fake-indexeddb/auto';
import { lookupOrchestrator, lookupOrchestratorMulti, createDictionaryProbeAsync, clearDictionaryProbeCache } from './lookupOrchestrator';
import { closeAllDBs, clearAllStores } from '@/features/dictionary';
import { addResource } from '@/features/dictionary';
import { addDictionaryEntry } from '@/features/dictionary';
import { addFrequencyEntry } from '@/features/dictionary';
import { putPhraseIndex, getPhraseIndex } from '@/features/dictionary';
import { setWordStatus, setWordStatusPos } from '@/features/dictionary/services/wordStatusStore';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary';
import { parsePhraseTemplate } from '@/features/dictionary';
import * as dictionaryFeature from '@/features/dictionary';
import type { Settings, LanguageProfile } from '@/entities/settings';
import type { DictionaryEntry } from '@/entities/dictionary';
import {
  DEFAULT_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';

// Mock devMode (import.meta.env not available in Jest CJS) + lookupLogStore
// (chrome.storage.local persistence — dev-only, mocked to no-op).
jest.mock('@/shared/lib/env/devMode', () => ({ isDevMode: false }));
jest.mock('../log/lookupLogStore', () => ({ saveLookupLog: jest.fn() }));

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
  clearDictionaryProbeCache(); // T23: clear probe cache between tests.
});

beforeEach(async () => {
  await clearAllStores('en');
  await clearAllStores('zh');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const TEST_VERBS = new Set(['be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick', 'put', 'look']);

type SeedEntry = {
  term: string;
  definition: string;
  pos?: string;
  reading?: string;
} & Partial<Omit<DictionaryEntry, 'id' | 'resourceId' | 'term' | 'definition' | 'pos' | 'reading'>>;

async function seedEnglishDictionary(
  entries: SeedEntry[],
  phrases: string[] = [],
): Promise<number> {
  const resourceId = await addResource('en', {
    name: 'cambridge.json',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'json-entries',
    signature: `en-sig-${Date.now()}-${Math.random()}`,
    wordCount: entries.length,
    installationFinished: true,
    importedAt: Date.now(),
  });
  for (const e of entries) {
    const { term, definition, pos, reading, ...rest } = e;
    await addDictionaryEntry('en', {
      resourceId,
      term,
      reading: reading ?? '',
      altterm: '',
      pronunciation: '',
      definition,
      pos: pos ?? '',
      examples: '',
      audio: '',
      ...rest,
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

function makeProfile(id: string, target: string): LanguageProfile {
  return {
    id,
    target,
    native: 'vi',
    name: `Test ${id}`,
    order: 1,
    subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: false,
    showReadings: false,
    dictionaryPopup: DEFAULT_DICTIONARY_POPUP_SETTINGS,
  };
}

function settingsWithActiveProfile(profileId: string): Settings {
  return {
    ...DEFAULT_SETTINGS,
    activeProfileId: profileId,
    languageProfiles: [makeProfile(profileId, 'en')],
  };
}

async function seedChineseDictionary(entries: { term: string; definition: string; reading?: string }[]): Promise<number> {
  const resourceId = await addResource('zh', {
    name: 'cedict.json',
    langCode: 'zh',
    type: 'DICTIONARY',
    format: 'json-entries',
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

  it('reads the persisted word status for the surface term', async () => {
    await seedEnglishDictionary(
      [{ term: 'ocean', definition: 'a large body of salt water', pos: 'noun' }],
    );
    await setWordStatus('en', 'ocean', 'known');

    const result = await lookupOrchestrator({
      term: 'ocean',
      langCode: 'en',
      contextSentence: 'The ocean is vast.',
      cursorOffset: 4,
    });

    expect(result.term).toBe('ocean');
    expect(result.status).toBe('known');
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

    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.frequencies[0]?.rank).toBe(500);
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

  it('splits all entry-object senses via canonical rules — strips N. markers, lifts headword lines to pos', async () => {
    // Real entry-object JSON shape for "question": 23 senses, some idioms have no
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
    // Single-line senses keep the whole line as gloss — no pos lift.
    expect(result.definitions[15]!.text).toBe('(noun) a feeling of doubt about something');
    expect(result.definitions[15]!.pos).toBeUndefined();
    // Multi-line senses lift the first line to pos (canonical splitMarkerSense):
    // the idiom headword becomes the pos label and the (POS) line a note.
    expect(result.definitions[16]!.pos).toBe('bring/call sth into question');
    expect(result.definitions[16]!.text).toBe('(noun) to express doubt about something');
    expect(result.definitions[16]!.text).not.toMatch(/^\d+\./);
    expect(result.definitions[18]!.pos).toBe('in question');
    expect(result.definitions[18]!.text).toBe('(noun) that is being discussed');
    expect(result.definitions[20]!.pos).toBe('out of the question');
    expect(result.definitions[20]!.text).toBe('(noun) if something is out of the question, it definitely will not or cannot happen');
    expect(result.definitions[22]!.text).toBe('(verb [ T ]) to express doubts about something');
  });

  it('splits legacy single-<br> numbered senses via the canonical normalizer (Migaku Eng-Vie)', async () => {
    // Legacy row (no `senses`) whose senses are separated by single <br> —
    // the old splitSenses required a blank line and collapsed 1-13 into one
    // def; the canonical numberedLineMarkup rule splits on line-start N.
    const lightDefinition = `1.danh từ<br>ánh sáng, ánh sáng mặt trời, ánh sáng ban ngày<br>· to stand in somebody's light — đứng lấp bóng ai<br>2.danh từ<br>nguồn ánh sáng, đèn đuốc<br>· traffic lights — đèn tín hiệu giao thông<br>3.danh từ<br>lửa, tia lửa; diêm, đóm<br><br>13.danh từ<br>(nghệ thuật) chỗ sáng trong bức tranh<br><br>14.at first light<br>lúc bình minh, lúc rạng đông<br><br>15.to give sb the green light<br>cho phép ai hành động, bật đèn xanh cho ai`;
    await seedEnglishDictionary([{ term: 'light', definition: lightDefinition, pos: '' }]);

    const result = await lookupOrchestrator({
      term: 'light',
      langCode: 'en',
      contextSentence: 'Turn on the light.',
      cursorOffset: 11,
    });

    expect(result.definitions).toHaveLength(6);

    const sense1 = result.definitions[0]!;
    expect(sense1.pos).toBe('danh từ');
    expect(sense1.lines).toEqual([
      { role: 'gloss', text: 'ánh sáng, ánh sáng mặt trời, ánh sáng ban ngày' },
    ]);
    expect(sense1.examples).toContainEqual({
      role: 'example',
      text: "to stand in somebody's light",
      translation: 'đứng lấp bóng ai',
    });

    const sense2 = result.definitions[1]!;
    expect(sense2.pos).toBe('danh từ');
    expect(sense2.text).toBe('nguồn ánh sáng, đèn đuốc');
    expect(sense2.examples).toContainEqual({
      role: 'example',
      text: 'traffic lights',
      translation: 'đèn tín hiệu giao thông',
    });

    const phrase = result.definitions[4]!;
    expect(phrase.pos).toBe('at first light');
    expect(phrase.text).toBe('lúc bình minh, lúc rạng đông');

    // The 'danh từ' marker tail is lifted to pos — never rendered as a gloss.
    for (const def of result.definitions) {
      expect(def.lines?.some((l) => l.text === 'danh từ')).toBeFalsy();
    }
  });

  it('falls back to lowercase candidate when only lowercase entry exists (I take it → i take it)', async () => {
    // The by_term index is case-sensitive; dictionaries store lowercase terms.
    // A capitalized lookup must retry with the lowercase candidate — the
    // lemmaCandidates dedupe must not skip it just because it case-insensitively
    // equals the lookup term.
    await seedEnglishDictionary([
      { term: 'i take it', definition: 'You can say I take it to check with someone…', pos: 'phrase' },
    ]);

    const result = await lookupOrchestrator({
      term: 'I take it',
      langCode: 'en',
      contextSentence: '',
      cursorOffset: 0,
      fallback: true,
    });

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toContain('I take it');
  });

  it('falls back to lemma when raw inflected term not in dictionary (easiest → easy)', async () => {
    // Dictionary has "easy" but NOT "easiest".
    await seedEnglishDictionary([
      { term: 'easy', definition: 'not difficult', pos: 'adjective' },
    ]);

    const result = await lookupOrchestrator({
      term: 'easiest',
      langCode: 'en',
      contextSentence: 'He was the easiest guy to push around.',
      cursorOffset: 12,
    });

    // Surface term is displayed, definitions come from the lemma "easy".
    expect(result.term).toBe('easiest');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('not difficult');
  });

  it('falls back to lemma for comparative (easier → easy)', async () => {
    await seedEnglishDictionary([
      { term: 'easy', definition: 'not difficult', pos: 'adjective' },
    ]);

    const result = await lookupOrchestrator({
      term: 'easier',
      langCode: 'en',
      contextSentence: 'It would have been easier for him.',
      cursorOffset: 22,
    });

    expect(result.term).toBe('easier');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('not difficult');
  });

  it('falls back to lemma for irregular comparison (better → good)', async () => {
    await seedEnglishDictionary([
      { term: 'good', definition: 'of high quality', pos: 'adjective' },
    ]);

    const result = await lookupOrchestrator({
      term: 'better',
      langCode: 'en',
      contextSentence: 'This is better than that.',
      cursorOffset: 10,
    });

    expect(result.term).toBe('better');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('of high quality');
  });

  it('falls back to lemma for CVC doubling (bigger → big)', async () => {
    await seedEnglishDictionary([
      { term: 'big', definition: 'of large size', pos: 'adjective' },
    ]);

    const result = await lookupOrchestrator({
      term: 'bigger',
      langCode: 'en',
      contextSentence: 'This is a bigger box.',
      cursorOffset: 10,
    });

    expect(result.term).toBe('bigger');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('of large size');
  });

  it('falls back to lemma for silent-e (nicest → nice)', async () => {
    await seedEnglishDictionary([
      { term: 'nice', definition: 'pleasant', pos: 'adjective' },
    ]);

    const result = await lookupOrchestrator({
      term: 'nicest',
      langCode: 'en',
      contextSentence: 'This is the nicest day.',
      cursorOffset: 12,
    });

    expect(result.term).toBe('nicest');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('pleasant');
  });

  it('falls back to lemma for irregular plural (children → child)', async () => {
    await seedEnglishDictionary([
      { term: 'child', definition: 'a young human', pos: 'noun' },
    ]);

    const result = await lookupOrchestrator({
      term: 'children',
      langCode: 'en',
      contextSentence: 'The children are playing.',
      cursorOffset: 4,
    });

    expect(result.term).toBe('children');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('a young human');
  });

  it('falls back to lemma for -ves plural (knives → knife)', async () => {
    await seedEnglishDictionary([
      { term: 'knife', definition: 'a cutting tool', pos: 'noun' },
    ]);

    const result = await lookupOrchestrator({
      term: 'knives',
      langCode: 'en',
      contextSentence: 'These knives are sharp.',
      cursorOffset: 6,
    });

    expect(result.term).toBe('knives');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('a cutting tool');
  });

  it('falls back to lemma for sibilant plural (boxes → box)', async () => {
    await seedEnglishDictionary([
      { term: 'box', definition: 'a container', pos: 'noun' },
    ]);

    const result = await lookupOrchestrator({
      term: 'boxes',
      langCode: 'en',
      contextSentence: 'The boxes are heavy.',
      cursorOffset: 4,
    });

    expect(result.term).toBe('boxes');
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('a container');
  });

  it('falls back to lemma for possessive (cat\'s → cat)', async () => {
    await seedEnglishDictionary([
      { term: 'cat', definition: 'a feline animal', pos: 'noun' },
    ]);

    const result = await lookupOrchestrator({
      term: "cat's",
      langCode: 'en',
      contextSentence: "The cat's tail is long.",
      cursorOffset: 4,
    });

    expect(result.term).toBe("cat's");
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.text).toBe('a feline animal');
  });

  it('rebuilds a stale phrase index blob and never matches the buggy bare-slot branch', async () => {
    const sentence = 'Part 1: Morning routine: Phrasal verbs with Georgie';
    const resourceId = await seedEnglishDictionary(
      [
        { term: 'routine', definition: 'the usual order in which you do things', pos: 'noun' },
        { term: "somebody/something can't compete with somebody/something", definition: 'to not be as interesting' },
      ],
      ["somebody/something can't compete with somebody/something"],
    );

    // Stamp the stored blob with the previous compiler version — the parser
    // that produced it allowed a bare-slot branch to swallow any token.
    const stored = await getPhraseIndex('en', resourceId);
    const staleBytes = stored!.blob.slice(0);
    new DataView(staleBytes).setUint32(4, stored!.compilerVersion - 1, true);
    await putPhraseIndex('en', resourceId, staleBytes, {
      compilerVersion: stored!.compilerVersion - 1,
      termCount: stored!.termCount,
    });

    const request = {
      term: 'routine',
      langCode: 'en',
      contextSentence: sentence,
      cursorOffset: sentence.indexOf('routine'),
    };
    const result = await lookupOrchestrator(request);
    expect(result.term).toBe('routine');
    expect(result.detectedPhrase).toBeNull();
    expect(result.phraseIndexPending).toBe(true);

    // The rebuild is fire-and-forget — poll IDB until the blob is regenerated.
    let rebuilt = await getPhraseIndex('en', resourceId);
    for (let i = 0; i < 100 && rebuilt!.compilerVersion !== stored!.compilerVersion; i++) {
      await new Promise((r) => setTimeout(r, 10));
      rebuilt = await getPhraseIndex('en', resourceId);
    }
    expect(rebuilt!.compilerVersion).toBe(stored!.compilerVersion);

    // The fixed parser's index still refuses to match the unrelated sentence.
    const after = await lookupOrchestrator(request);
    expect(after.term).toBe('routine');
    expect(after.detectedPhrase).toBeNull();
    expect(after.phraseIndexPending).toBeFalsy();
  });

  it('flags results while a phrase index blob is missing, then self-heals', async () => {
    const resourceId = await seedEnglishDictionary([
      { term: 'put', definition: 'to move something into a position', pos: 'verb' },
      { term: "put all one's eggs in one basket", definition: 'to depend entirely on one thing', pos: 'idiom' },
    ]);

    const sentence = "Put all one's eggs in one basket";
    const request = {
      term: 'put',
      langCode: 'en',
      contextSentence: sentence,
      cursorOffset: 0,
    };
    const result = await lookupOrchestrator(request);
    expect(result.term).toBe('put');
    expect(result.phraseIndexPending).toBe(true);

    let stored = await getPhraseIndex('en', resourceId);
    for (let i = 0; i < 100 && !stored; i++) {
      await new Promise((r) => setTimeout(r, 10));
      stored = await getPhraseIndex('en', resourceId);
    }
    expect(stored).toBeTruthy();

    const after = await lookupOrchestrator(request);
    expect(after.phraseIndexPending).toBeFalsy();
  });
});

describe('lookupOrchestrator — rich canonical fields', () => {
  it('passes sense labels/level/synonyms/antonyms through to DefinitionEntry', async () => {
    await seedEnglishDictionary([{
      term: 'take',
      definition: 'verb [transitive] [B1]<br>to carry something',
      senses: [{
        pos: 'verb',
        labels: ['transitive'],
        level: 'B1',
        lines: [
          { role: 'gloss', text: 'to carry something', translation: 'mang theo' },
          { role: 'example', text: 'Take an umbrella', pattern: '[VERB noun]', citation: 'src' },
        ],
        subsenses: [{ num: 'a', text: 'to bring along' }],
        synonyms: ['bring', 'carry'],
        antonyms: ['leave'],
      }],
    }]);

    const result = await lookupOrchestrator({
      term: 'take', langCode: 'en', contextSentence: 'take it', cursorOffset: 0,
    });

    const def = result.definitions[0]!;
    expect(def.pos).toBe('verb');
    expect(def.labels).toEqual(['transitive']);
    expect(def.level).toBe('B1');
    expect(def.lines).toEqual([{ role: 'gloss', text: 'to carry something', translation: 'mang theo' }]);
    expect(def.examples).toEqual([
      { role: 'example', text: 'Take an umbrella', pattern: '[VERB noun]', citation: 'src' },
    ]);
    expect(def.subsenses).toEqual([{ num: 'a', text: 'to bring along' }]);
    expect(def.synonyms).toEqual(['bring', 'carry']);
    expect(def.antonyms).toEqual(['leave']);
    expect(def.text).toBe('to carry something — mang theo');
  });

  it('merges entry-level related/level/etymology across resources by priority', async () => {
    // Explicit priority: A (0) wins over B (1) for scalars/first-wins merges.
    const ridA = await addResource('en', {
      name: 'main.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-a-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 0,
    });
    await addDictionaryEntry('en', {
      resourceId: ridA, term: 'take', reading: '', altterm: '', pronunciation: '',
      definition: 'to carry', pos: '', examples: '', audio: '',
      level: 'B1',
      related: [{ term: 'take after', kind: 'phrasal', preview: 'giống' }],
      etymology: { chain: 'from Old English tacan', firstKnownUse: '12th century' },
    });
    const ridB = await addResource('en', {
      name: 'other.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-b-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 1,
    });
    await addDictionaryEntry('en', {
      resourceId: ridB, term: 'take', reading: '', altterm: '', pronunciation: '',
      definition: 'to grab', pos: '', examples: '', audio: '',
      related: [{ term: 'take a dose', kind: 'collocation' }, { term: 'to take after', kind: 'expression' }],
      etymology: { chain: 'from Old Norse taka' },
    });
    expect(ridB).toBeGreaterThan(ridA);

    const result = await lookupOrchestrator({
      term: 'take', langCode: 'en', contextSentence: 'take it', cursorOffset: 0,
    });

    expect(result.level).toBe('B1');
    // Union + dedupe by normalized term ('to take after' ≈ 'take after'), first wins.
    expect(result.related).toEqual([
      { term: 'take after', kind: 'phrasal', preview: 'giống' },
      { term: 'take a dose', kind: 'collocation' },
    ]);
    // First etymology wins the chain; the second becomes a checkable variant.
    expect(result.etymology?.chain).toBe('from Old English tacan');
    expect(result.etymology?.variants).toEqual([{ text: 'from Old Norse taka', source: 'other' }]);
    // Word origin rows are emitted as selectable definition entries.
    const originRows = result.definitions.filter((d) => d.labels?.includes('word origin'));
    expect(originRows).toHaveLength(2);
    expect(originRows[0]!.text).toContain('from Old English tacan');
    expect(originRows[0]!.text).toContain('first known use: 12th century');
    expect(originRows[1]!.text).toBe('from Old Norse taka [other]');
  });

  it('drops disabledComponents per-resource and lets singletons fall through', async () => {
    // Priority 0 disables word forms + IPA → priority 1 supplies both.
    const ridA = await addResource('en', {
      name: 'main.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-comp-a-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 0,
      disabledComponents: ['inflections', 'pronunciation', 'translations'],
    });
    await addDictionaryEntry('en', {
      resourceId: ridA, term: 'take', reading: 'tāk', altterm: '', pronunciation: '/teɪk-A/',
      definition: 'to carry', pos: '', examples: '', audio: '',
      inflections: [{ type: 'past', forms: ['took-A'] }],
      senses: [{
        pos: 'verb',
        lines: [
          { role: 'gloss', text: 'to carry', translation: 'mang' },
          { role: 'example', text: 'Take it', translation: 'Cầm lấy' },
        ],
      }],
    });
    const ridB = await addResource('en', {
      name: 'other.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-comp-b-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 1,
    });
    await addDictionaryEntry('en', {
      resourceId: ridB, term: 'take', reading: '', altterm: '', pronunciation: '/teɪk-B/',
      definition: 'to grab', pos: '', examples: '', audio: '',
      inflections: [{ type: 'past', forms: ['took-B'] }],
    });

    const result = await lookupOrchestrator({
      term: 'take', langCode: 'en', contextSentence: 'take it', cursorOffset: 0,
    });

    // Singleton fall-through: dict B's word forms + IPA win since A disabled them.
    expect(result.inflections).toEqual([{ type: 'past', forms: ['took-B'] }]);
    expect(result.reading).toBe('/teɪk-B/');
    // Translations stripped from A's sense lines.
    expect(result.definitions[0]!.lines?.every((l) => l.translation === undefined)).toBe(true);
  });

  it('falls through IPA when the top dictionary only stores reading === term', async () => {
    // Normalized EN entries default `reading` to the term — that must not
    // count as a pronunciation and swallow lower-priority IPA.
    const ridA = await addResource('en', {
      name: 'origin.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-ipa-a-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 0,
    });
    await addDictionaryEntry('en', {
      resourceId: ridA, term: 'take', reading: 'take', altterm: '', pronunciation: '',
      definition: '', pos: '', examples: '', audio: '',
      etymology: { chain: 'Old Norse taka' },
    });
    const ridB = await addResource('en', {
      name: 'learner.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-ipa-b-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(), priority: 1,
    });
    await addDictionaryEntry('en', {
      resourceId: ridB, term: 'take', reading: 'take', altterm: '', pronunciation: '/teɪk/',
      definition: 'to carry', pos: 'verb', examples: '', audio: '',
    });

    const result = await lookupOrchestrator({
      term: 'take', langCode: 'en', contextSentence: 'take it', cursorOffset: 0,
    });

    expect(result.reading).toBe('/teɪk/');
  });

  it('skips senses entirely when a resource disables definitions', async () => {
    const rid = await addResource('en', {
      name: 'meta-only.json', langCode: 'en', type: 'DICTIONARY', format: 'json-entries',
      signature: `en-sig-comp-c-${Date.now()}`, wordCount: 1, installationFinished: true,
      importedAt: Date.now(),
      disabledComponents: ['definitions'],
    });
    await addDictionaryEntry('en', {
      resourceId: rid, term: 'etym', reading: '', altterm: '', pronunciation: '',
      definition: 'a definition that must not render', pos: '', examples: '', audio: '',
      etymology: { chain: 'from Latin' },
    });

    const result = await lookupOrchestrator({
      term: 'etym', langCode: 'en', contextSentence: 'etym test', cursorOffset: 0,
    });

    expect(result.definitions.every((d) => d.labels?.includes('word origin'))).toBe(true);
    expect(result.rawDefinitions).toEqual([]);
    expect(result.etymology?.chain).toBe('from Latin');
  });
});

describe('lookupOrchestratorMulti — multi-candidate', () => {
  it('returns all phrase matches as separate candidates', async () => {
    // Seed two phrase templates that both match "get" in "I get out and get over it."
    await seedEnglishDictionary(
      [
        { term: 'get out', definition: 'to leave', pos: 'phrasal verb' },
        { term: 'get over', definition: 'to recover from', pos: 'phrasal verb' },
        { term: 'get', definition: 'to obtain', pos: 'verb' },
      ],
      ['get out', 'get over'],
    );

    const results = await lookupOrchestratorMulti({
      term: 'get',
      langCode: 'en',
      contextSentence: 'I get out and get over it.',
      cursorOffset: 2, // cursor on "get" (first one)
    });

    // Winner = "get out" (matches at cursor). Additional = none for first "get"
    // since "get over" matches the second "get" (different cursor position).
    // But both templates anchor on "get" — matcher returns best match at cursor.
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.term).toBe('get out');
    expect(results[0]!.detectedPhrase).not.toBeNull();
  });

  it('returns single result when only one phrase matches', async () => {
    await seedEnglishDictionary(
      [
        { term: 'take off', definition: 'to remove', pos: 'phrasal verb' },
        { term: 'hello', definition: 'greeting', pos: 'noun' },
      ],
      ['take off'],
    );

    const results = await lookupOrchestratorMulti({
      term: 'take',
      langCode: 'en',
      contextSentence: 'Take off your shoes.',
      cursorOffset: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.term).toBe('take off');
    expect(results[0]!.detectedPhrase).not.toBeNull();
  });

  it('returns word fallback as single result when no phrase matches', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);

    const results = await lookupOrchestratorMulti({
      term: 'hello',
      langCode: 'en',
      contextSentence: 'She said hello.',
      cursorOffset: 9,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.term).toBe('hello');
    expect(results[0]!.detectedPhrase).toBeNull();
    expect(results[0]!.matchSource).toBe('dictionary');
  });

  it('adds lemma as additional candidate when both raw and lemma are in dict', async () => {
    // Dictionary has BOTH "easiest" (separate entry) AND "easy".
    await seedEnglishDictionary([
      { term: 'easiest', definition: 'most easy', pos: 'adjective' },
      { term: 'easy', definition: 'not difficult', pos: 'adjective' },
    ]);

    const results = await lookupOrchestratorMulti({
      term: 'easiest',
      langCode: 'en',
      contextSentence: 'He was the easiest guy.',
      cursorOffset: 12,
    });

    // Winner = raw term "easiest", additional candidate = lemma "easy".
    expect(results.length).toBe(2);
    expect(results[0]!.term).toBe('easiest');
    expect(results[0]!.definitions[0]!.text).toBe('most easy');
    expect(results[1]!.term).toBe('easy');
    expect(results[1]!.definitions[0]!.text).toBe('not difficult');
  });

  it('does not add lemma candidate when lemma equals raw term', async () => {
    await seedEnglishDictionary([
      { term: 'easy', definition: 'not difficult', pos: 'adjective' },
    ]);

    const results = await lookupOrchestratorMulti({
      term: 'easy',
      langCode: 'en',
      contextSentence: 'This is easy.',
      cursorOffset: 8,
    });

    // "easy" lemma is "easy" — no duplicate candidate.
    expect(results).toHaveLength(1);
    expect(results[0]!.term).toBe('easy');
  });

  it('returns only lemma result when raw term not in dict but lemma is', async () => {
    await seedEnglishDictionary([
      { term: 'easy', definition: 'not difficult', pos: 'adjective' },
    ]);

    const results = await lookupOrchestratorMulti({
      term: 'easier',
      langCode: 'en',
      contextSentence: 'This is easier.',
      cursorOffset: 8,
    });

    // Raw "easier" not in dict → surface "easier" wins with definitions from "easy";
    // "easy" appears as an origin candidate.
    expect(results).toHaveLength(2);
    expect(results[0]!.term).toBe('easier');
    expect(results[0]!.definitions[0]!.text).toBe('not difficult');
    expect(results[1]!.term).toBe('easy');
  });

  it('rejects loose object-slot phrase and shows surface + origin for "is"', async () => {
    const resourceId = await seedEnglishDictionary(
      [{ term: 'be', definition: 'to exist', pos: 'verb' }],
      ['be (really) something'],
    );
    await addFrequencyEntry('en', { resourceId, term: 'is', reading: '', frequency: 13 });

    const results = await lookupOrchestratorMulti({
      term: 'is',
      langCode: 'en',
      contextSentence: 'The ocean is the body of salt water that covers approximately 70.8% of Earth.[8]',
      cursorOffset: 10,
    });

    expect(results[0]!.term).toBe('is');
    expect(results[0]!.definitions[0]!.text).toBe('to exist');
    expect(results[0]!.frequencies[0]?.rank).toBe(13);
    expect(results[1]!.term).toBe('be');
  });

  it('keeps surface and lemma candidates that only have reading', async () => {
    await seedEnglishDictionary(
      [{ term: 'learn', definition: '', reading: '/lɝːn/' }],
      ['machine learning'],
    );

    const results = await lookupOrchestratorMulti({
      term: 'learning',
      langCode: 'en',
      contextSentence: 'Machine Learning Algorithms',
      cursorOffset: 8,
    });

    const terms = results.map((r) => r.term);
    expect(terms).toEqual(['machine learning', 'learning', 'learn']);
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

describe('lookupOrchestrator — resource controls', () => {
  it('excludes disabled dictionary resources from phrase matching', async () => {
    const enabledId = await addResource('en', {
      name: 'enabled.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'enabled',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now(),
      enabled: true,
    });
    const disabledId = await addResource('en', {
      name: 'disabled.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'disabled',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now() + 1,
      enabled: false,
    });

    await addDictionaryEntry('en', {
      resourceId: enabledId,
      term: 'ocean',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'a large body of salt water',
      pos: 'noun',
      examples: '',
      audio: '',
    });
    await addDictionaryEntry('en', {
      resourceId: disabledId,
      term: 'unknownword',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'should not appear',
      pos: 'noun',
      examples: '',
      audio: '',
    });

    const result = await lookupOrchestrator({
      term: 'unknownword',
      langCode: 'en',
      contextSentence: 'This is an unknownword here.',
      cursorOffset: 11,
    });

    expect(result.term).toBe('unknownword');
    expect(result.definitions).toEqual([]);
  });

  it('includes resources bound to other profiles (profile scoping removed)', async () => {
    const globalId = await addResource('en', {
      name: 'global.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'global',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now(),
    });
    const profileOnlyId = await addResource('en', {
      name: 'profile.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'profile',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now() + 1,
      profileIds: ['p1'],
    });

    await addDictionaryEntry('en', {
      resourceId: globalId,
      term: 'ocean',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'a large body of salt water',
      pos: 'noun',
      examples: '',
      audio: '',
    });
    await addDictionaryEntry('en', {
      resourceId: profileOnlyId,
      term: 'unknownword',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'profile-bound entries still appear',
      pos: 'noun',
      examples: '',
      audio: '',
    });

    const settings = settingsWithActiveProfile('p2');
    const result = await lookupOrchestrator(
      {
        term: 'unknownword',
        langCode: 'en',
        contextSentence: 'This is an unknownword here.',
        cursorOffset: 11,
      },
      { settings },
    );

    expect(result.term).toBe('unknownword');
    expect(result.definitions).not.toEqual([]);
    expect(result.definitions?.[0]?.text).toBe('profile-bound entries still appear');
  });

  it('uses explicit resource priority over resourceId descending', async () => {
    const lowPriorityId = await addResource('en', {
      name: 'low-priority.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'low-priority',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now(),
      priority: 5,
    });
    const highPriorityId = await addResource('en', {
      name: 'high-priority.json',
      langCode: 'en',
      type: 'DICTIONARY',
      format: 'json-entries',
      signature: 'high-priority',
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now() + 1,
      priority: 1,
    });

    const inputs: PhraseIndexInput[] = ['take off'].map((t, i) => {
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

    await putPhraseIndex('en', lowPriorityId, serializePhraseIndex(index), {
      compilerVersion: index.compilerVersion,
      termCount: index.termCount,
    });
    await putPhraseIndex('en', highPriorityId, serializePhraseIndex(index), {
      compilerVersion: index.compilerVersion,
      termCount: index.termCount,
    });

    await addDictionaryEntry('en', {
      resourceId: lowPriorityId,
      term: 'take off',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'wrong winner',
      pos: 'verb',
      examples: '',
      audio: '',
    });
    await addDictionaryEntry('en', {
      resourceId: highPriorityId,
      term: 'take off',
      reading: '',
      altterm: '',
      pronunciation: '',
      definition: 'right winner',
      pos: 'verb',
      examples: '',
      audio: '',
    });

    const result = await lookupOrchestrator({
      term: 'take',
      langCode: 'en',
      contextSentence: 'The plane will take off soon.',
      cursorOffset: 20,
    });

    expect(result.term).toBe('take off');
    expect(result.definitions[0]!.text).toBe('right winner');
  });

  it('picks frequency rank from the highest-priority resource', async () => {
    const globalId = await addResource('en', {
      name: 'global-freq.json',
      langCode: 'en',
      type: 'FREQUENCY',
      format: 'json-entries',
      signature: 'global-freq',
      wordCount: 0,
      installationFinished: true,
      importedAt: Date.now(),
    });
    const highPriorityId = await addResource('en', {
      name: 'priority-freq.json',
      langCode: 'en',
      type: 'FREQUENCY',
      format: 'json-entries',
      signature: 'priority-freq',
      wordCount: 0,
      installationFinished: true,
      importedAt: Date.now() + 1,
      priority: 1,
    });

    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);

    await addFrequencyEntry('en', {
      resourceId: globalId,
      term: 'hello',
      reading: '',
      frequency: 500,
    });
    await addFrequencyEntry('en', {
      resourceId: highPriorityId,
      term: 'hello',
      reading: '',
      frequency: 15000,
    });

    const result = await lookupOrchestrator({
      term: 'hello',
      langCode: 'en',
      contextSentence: 'Hello world.',
      cursorOffset: 0,
    });

    // Highest-priority resource has rank 15000 (worse absolute rank), but
    // it leads the frequencies list because it is the highest-priority list.
    expect(result.frequencies).toEqual([
      { rank: 15000, source: 'priority-freq' },
      { rank: 500, source: 'global-freq' },
    ]);
  });
});

describe('lookupOrchestrator — active profile language', () => {
  function settingsForProfile(profileId: string, target: string): Settings {
    return {
      ...DEFAULT_SETTINGS,
      activeProfileId: profileId,
      languageProfiles: [makeProfile(profileId, target)],
    };
  }

  it('resolves langCode from the active profile, ignoring a stale request.langCode', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);
    await setWordStatus('en', 'hello', 'known');

    const result = await lookupOrchestrator(
      { term: 'hello', langCode: 'en', contextSentence: 'Hello world.', cursorOffset: 0 },
      { settings: settingsForProfile('p-aa', 'aa') },
    );

    expect(result.langCode).toBe('aa');
    expect(result.definitions).toEqual([]);
    expect(result.frequencies).toEqual([]);
    expect(result.status).toBe('unknown');
  });

  it('still serves English data when the active profile targets en', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);
    await setWordStatus('en', 'hello', 'known');

    const result = await lookupOrchestrator(
      { term: 'hello', langCode: 'aa', contextSentence: 'Hello world.', cursorOffset: 0 },
      { settings: settingsForProfile('p-en', 'en') },
    );

    expect(result.langCode).toBe('en');
    expect(result.definitions[0]!.text).toBe('greeting');
    expect(result.status).toBe('known');
  });
});

describe('lookupOrchestrator — lookup-hot-path', () => {
  it('reads each distinct term at most once per request', async () => {
    await seedEnglishDictionary([
      { term: 'kick the bucket', definition: 'to die', pos: 'idiom' },
      { term: 'kick', definition: 'to strike with the foot', pos: 'verb' },
    ], ['kick the bucket']);

    const dictSpy = jest.spyOn(dictionaryFeature, 'findDictionaryByTerm');
    const freqSpy = jest.spyOn(dictionaryFeature, 'findFrequencyByTerm');
    try {
      const results = await lookupOrchestratorMulti({
        term: 'kicked',
        langCode: 'en',
        contextSentence: 'He kicked the bucket.',
        cursorOffset: 3,
      });
      expect(results.map((r) => r.term)).toEqual(['kick the bucket', 'kicked', 'kick']);

      const dictTerms = dictSpy.mock.calls.map(([, t]) => t);
      expect(new Set(dictTerms).size).toBe(dictTerms.length);
      const freqTerms = freqSpy.mock.calls.map(([, t]) => t);
      expect(new Set(freqTerms).size).toBe(freqTerms.length);
    } finally {
      dictSpy.mockRestore();
      freqSpy.mockRestore();
    }
  });

  it('assembles candidates and lemma probes concurrently', async () => {
    await seedEnglishDictionary(
      [
        { term: 'kick the bucket', definition: 'to die', pos: 'idiom' },
        { term: 'kick', definition: 'to strike with the foot', pos: 'verb' },
      ],
      ['kick the bucket'],
    );

    let pending = 0;
    let maxPending = 0;
    const realFind = dictionaryFeature.findDictionaryByTerm;
    const spy = jest
      .spyOn(dictionaryFeature, 'findDictionaryByTerm')
      .mockImplementation(async (lang, term) => {
        pending += 1;
        maxPending = Math.max(maxPending, pending);
        try {
          return await realFind(lang, term);
        } finally {
          pending -= 1;
        }
      });
    try {
      await lookupOrchestratorMulti({
        term: 'kicked',
        langCode: 'en',
        contextSentence: 'He kicked the bucket.',
        cursorOffset: 3,
      });
      expect(maxPending).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('probes all lemma candidates in one batch and keeps the first hit', async () => {
    await seedEnglishDictionary([
      { term: 'bigg', definition: 'first candidate', pos: 'noun' },
      { term: 'bigge', definition: 'later candidate', pos: 'noun' },
    ]);

    const results = await lookupOrchestratorMulti({
      term: 'bigger',
      langCode: 'en',
      contextSentence: 'A bigger boat.',
      cursorOffset: 2,
    });

    expect(results[0]!.term).toBe('bigger');
    expect(results[0]!.definitions[0]!.text).toBe('first candidate');
    expect(results.map((r) => r.term)).toEqual(['bigger', 'bigg', 'bigge']);
  });

  it('reaches later lemma candidates when earlier ones are empty', async () => {
    await seedEnglishDictionary([
      { term: 'bigge', definition: 'only later candidate', pos: 'noun' },
    ]);

    const result = await lookupOrchestrator({
      term: 'bigger',
      langCode: 'en',
      contextSentence: 'A bigger boat.',
      cursorOffset: 2,
    });

    expect(result.term).toBe('bigger');
    expect(result.definitions[0]!.text).toBe('only later candidate');
  });

  it('keeps additional phrase candidates that have no dictionary entries', async () => {
    await seedEnglishDictionary(
      [{ term: 'kick the bucket', definition: 'to die', pos: 'idiom' }],
      ['kick the bucket', 'kick the bucket hard'],
    );

    const results = await lookupOrchestratorMulti({
      term: 'kicked',
      langCode: 'en',
      contextSentence: 'He kicked the bucket hard.',
      cursorOffset: 3,
    });

    const hard = results.find((r) => r.term === 'kick the bucket hard');
    expect(hard).toBeDefined();
    expect(hard!.definitions).toHaveLength(0);
  });

  it('drops surface and lemma candidates that resolve to nothing', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);

    const results = await lookupOrchestratorMulti({
      term: 'spouted',
      langCode: 'en',
      contextSentence: 'The whale spouted.',
      cursorOffset: 11,
    });

    expect(results.map((r) => r.term)).toEqual(['spouted']);
  });

  it('reuses the resource context across lookups until the cache is cleared', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'greeting' }]);
    const request = {
      term: 'hello',
      langCode: 'en',
      contextSentence: 'Say hello.',
      cursorOffset: 4,
    };

    const spy = jest.spyOn(dictionaryFeature, 'getAllResources');
    try {
      await lookupOrchestrator(request);
      await lookupOrchestrator(request);
      expect(spy.mock.calls.filter(([lang]) => lang === 'en')).toHaveLength(1);

      clearDictionaryProbeCache();
      await lookupOrchestrator(request);
      expect(spy.mock.calls.filter(([lang]) => lang === 'en')).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('lookupOrchestrator — pos variants (pos-dictionary-variants)', () => {
  async function seedFreqResource(name = 'coca.json'): Promise<number> {
    return addResource('en', {
      name,
      langCode: 'en',
      type: 'FREQUENCY',
      format: 'json-frequency',
      signature: `en-freq-${Date.now()}-${Math.random()}`,
      wordCount: 1,
      installationFinished: true,
      importedAt: Date.now(),
    });
  }

  const presentEntries: SeedEntry[] = [
    {
      term: 'present',
      definition: 'existing or happening now',
      pos: 'adjective',
      prons: [
        { accent: 'AmE', ipa: 'ˈprezənt', audioRef: 'sound://us_present1.mp3' },
        { accent: 'BrE', ipa: 'ˈprez(ə)nt', audioRef: 'sound://uk_present1.wav' },
      ],
      frequencyStars: 3,
    },
    {
      term: 'present',
      definition: 'to give something to somebody formally',
      pos: 'verb',
      prons: [{ accent: 'AmE', ipa: 'prɪˈzent', audioRef: 'sound://us_present2.mp3' }],
      inflections: [{ type: 'past', forms: ['presented'] }],
    },
    {
      term: 'present',
      definition: 'a gift',
      pos: 'noun',
      prons: [{ accent: 'AmE', ipa: 'ˈprezənt' }],
      inflections: [{ type: 'plural', forms: ['presents'] }],
    },
  ];

  it('assembles one variant per pos with scoped prons, stars, inflections and defs', async () => {
    await seedEnglishDictionary(presentEntries);

    const result = await lookupOrchestrator({
      term: 'present',
      langCode: 'en',
      contextSentence: 'The present task presents a challenge.',
      cursorOffset: 4,
    });

    expect(result.variants).toHaveLength(3);
    const [adj, verb, noun] = result.variants!;
    expect(adj!.pos).toBe('adjective');
    expect(adj!.prons.map((p) => p.accent)).toEqual(['AmE', 'BrE']);
    expect(adj!.frequencyStars).toEqual({ count: 3, source: 'cambridge' });
    expect(adj!.definitions.map((d) => d.text)).toEqual(['existing or happening now']);

    expect(verb!.pos).toBe('verb');
    expect(verb!.prons[0]!.ipa).toBe('prɪˈzent');
    expect(verb!.inflections?.[0]?.forms).toEqual(['presented']);
    expect(verb!.definitions.map((d) => d.text)).toEqual(['to give something to somebody formally']);

    expect(noun!.pos).toBe('noun');
    expect(noun!.definitions.map((d) => d.text)).toEqual(['a gift']);
  });

  it('joins pos-specific frequency rows per variant; term-level rows fall back', async () => {
    await seedEnglishDictionary(presentEntries);
    const freqId = await seedFreqResource();
    const otherFreqId = await seedFreqResource('legacy.json');
    await addFrequencyEntry('en', { resourceId: freqId, term: 'present', reading: '', frequency: 818, pos: 'v', total: 53923 });
    await addFrequencyEntry('en', { resourceId: freqId, term: 'present', reading: '', frequency: 1334, pos: 'j', total: 32520 });
    await addFrequencyEntry('en', { resourceId: otherFreqId, term: 'present', reading: '', frequency: 900 });

    const result = await lookupOrchestrator({
      term: 'present',
      langCode: 'en',
      contextSentence: 'present',
      cursorOffset: 0,
    });

    const [adj, verb, noun] = result.variants!;
    expect(adj!.frequencies.map((f) => f.rank)).toEqual([900, 1334]);
    expect(adj!.frequencies[1]!.total).toBe(32520);
    expect(verb!.frequencies.map((f) => f.rank)).toEqual([900, 818]);
    expect(verb!.frequencies[1]!.total).toBe(53923);
    expect(noun!.frequencies.map((f) => f.rank)).toEqual([900]);
    expect(noun!.frequencies[0]!.source).toBe('legacy');
  });

  it('resolves pos status independently and aggregates over all variants', async () => {
    await seedEnglishDictionary(presentEntries);
    await setWordStatusPos('en', 'present', 'verb', 'learning');

    const result = await lookupOrchestrator({
      term: 'present',
      langCode: 'en',
      contextSentence: 'present',
      cursorOffset: 0,
    });

    const [adj, verb, noun] = result.variants!;
    expect(verb!.status).toBe('learning');
    expect(adj!.status).toBe('unknown');
    expect(noun!.status).toBe('unknown');
    expect(result.status).toBe('unknown');
  });

  it('pos row beats term row for the same variant; term row still feeds other variants', async () => {
    await seedEnglishDictionary(presentEntries);
    await setWordStatus('en', 'present', 'known');
    await setWordStatusPos('en', 'present', 'noun', 'tracking');

    const result = await lookupOrchestrator({
      term: 'present',
      langCode: 'en',
      contextSentence: 'present',
      cursorOffset: 0,
    });

    const [adj, verb, noun] = result.variants!;
    expect(adj!.status).toBe('known');
    expect(verb!.status).toBe('known');
    expect(noun!.status).toBe('tracking');
  });

  it('omits variants entirely for pos-less single-variant data', async () => {
    await seedEnglishDictionary([{ term: 'hello', definition: 'a greeting' }]);

    const result = await lookupOrchestrator({
      term: 'hello',
      langCode: 'en',
      contextSentence: 'Say hello.',
      cursorOffset: 4,
    });

    expect(result.variants).toBeUndefined();
  });
});
