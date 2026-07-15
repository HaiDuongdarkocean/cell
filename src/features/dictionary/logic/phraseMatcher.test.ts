import {
  matchPhrase,
  tokenizeSentence,
  type PhraseMatchRequest,
} from '@/features/dictionary/logic/phraseMatcher';
import {
  compilePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

const TEST_VERBS = new Set([
  'be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick',
  'put', 'hit', 'come', 'look', 'get', 'start', 'go', 'make', 'do', 'have',
  'see', 'know', 'think', 'say', 'tell', 'find', 'call', 'try', 'ask', 'seem',
  'feel', 'leave', 'work', 'keep', 'let', 'begin', 'show', 'hear', 'play',
  'turn', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue',
  'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop',
  'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk',
  'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait',
  'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach',
  'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide',
  'pull', 'return', 'explain', 'hope', 'develop', 'carry', 'break', 'receive',
  'agree', 'support', 'hit', 'produce', 'eat', 'cover', 'catch', 'draw',
  'choose', 'point', 'save', 'design', 'sit', 'arrive', 'visit', 'stay',
]);

function buildIndex(terms: string[]): PhraseIndex {
  const inputs: PhraseIndexInput[] = [];
  let id = 0;
  for (const term of terms) {
    const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
    if (parsed.status !== 'supported') throw new Error(`test template "${term}" unsupported: ${parsed.status}`);
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
  return compilePhraseIndex(inputs);
}

function req(sentence: string, hoverWord: string): PhraseMatchRequest {
  const lower = sentence.toLowerCase();
  const offset = lower.indexOf(hoverWord.toLowerCase());
  if (offset < 0) throw new Error(`hover word "${hoverWord}" not found in sentence`);
  return { sentence, cursorOffset: offset };
}

describe('phraseMatcher', () => {
  describe('tokenizeSentence', () => {
    it('splits a simple sentence into tokens with offsets', () => {
      const tokens = tokenizeSentence('Hello world.');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.text).toBe('hello');
      expect(tokens[0]!.start).toBe(0);
      expect(tokens[0]!.end).toBe(5);
      expect(tokens[1]!.text).toBe('world');
      expect(tokens[1]!.start).toBe(6);
      expect(tokens[1]!.end).toBe(11);
    });

    it('preserves UTF-16 offsets for contractions', () => {
      const tokens = tokenizeSentence("He doesn't know.");
      expect(tokens[0]!.text).toBe('he');
      expect(tokens[1]!.text).toBe("doesn't");
      expect(tokens[1]!.start).toBe(3);
      expect(tokens[1]!.end).toBe(10);
    });

    it('skips whitespace and punctuation between words', () => {
      const tokens = tokenizeSentence('The, quick brown fox!');
      expect(tokens.map((t) => t.text)).toEqual(['the', 'quick', 'brown', 'fox']);
    });
  });

  describe('matchPhrase — positive cases (ADR P01-P33)', () => {
    it('P01: be (right) under your nose — verb inflection + optional + possessive', () => {
      const index = buildIndex(['be (right) under your nose']);
      const m = matchPhrase(req('The answer was right under my nose.', 'was'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('be (right) under your nose');
      expect(m!.surface).toBe('was right under my nose');
      expect(m!.quality).toBe('possessive-template');
    });

    it('P04: spill the beans — verb inflection only', () => {
      const index = buildIndex(['spill the beans']);
      const m = matchPhrase(req('She spilled the beans.', 'spilled'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('spill the beans');
      expect(m!.surface).toBe('spilled the beans');
      expect(m!.quality).toBe('inflected');
    });

    it('P05: break down — irregular verb', () => {
      const index = buildIndex(['break down']);
      const m = matchPhrase(req('The car broke down.', 'broke'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('break down');
      expect(m!.surface).toBe('broke down');
      expect(m!.quality).toBe('inflected');
    });

    it('P06: kick the bucket — regular verb', () => {
      const index = buildIndex(['kick the bucket']);
      const m = matchPhrase(req('The old man kicked the bucket.', 'kicked'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('kick the bucket');
      expect(m!.surface).toBe('kicked the bucket');
    });

    it('P08: a piece of cake — article required', () => {
      const index = buildIndex(['a piece of cake']);
      const m = matchPhrase(req('The test was a piece of cake.', 'piece'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('a piece of cake');
      expect(m!.surface).toBe('a piece of cake');
      expect(m!.quality).toBe('fixed');
    });

    it('P11: (just) in the nick of time — optional consumed', () => {
      const index = buildIndex(['(just) in the nick of time']);
      const m = matchPhrase(req('She arrived just in the nick of time.', 'nick'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('(just) in the nick of time');
      expect(m!.surface).toBe('just in the nick of time');
    });

    it('P12: (just) in the nick of time — optional skipped', () => {
      const index = buildIndex(['(just) in the nick of time']);
      const m = matchPhrase(req('She arrived in the nick of time.', 'nick'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('(just) in the nick of time');
      expect(m!.surface).toBe('in the nick of time');
    });

    it('P13: a close/near thing — alternative branch near', () => {
      const index = buildIndex(['a close/near thing']);
      const m = matchPhrase(req('It was a near thing.', 'near'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('a close/near thing');
      expect(m!.surface).toBe('a near thing');
    });

    it('P15: carry sth out — bounded object slot', () => {
      const index = buildIndex(['carry sth out']);
      const m = matchPhrase(req('He carried the plan out carefully.', 'carried'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('carry sth out');
      expect(m!.surface).toBe('carried the plan out');
      expect(m!.quality).toBe('slot-template');
    });

    it('P16: carry out something — object after particle', () => {
      const index = buildIndex(['carry out something']);
      const m = matchPhrase(req('She carried out the plan.', 'carried'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('carry out something');
      expect(m!.surface).toBe('carried out the plan');
    });

    it('P17: look after sb/sth — verb inflection + slot', () => {
      const index = buildIndex(['look after sb/sth']);
      const m = matchPhrase(req('She looks after her sister.', 'looks'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('look after sb/sth');
      expect(m!.surface).toBe('looks after her sister');
    });

    it('P18: put up with sth/sb — multi-particle', () => {
      const index = buildIndex(['put up with sth/sb']);
      const m = matchPhrase(req('I cannot put up with this noise.', 'put'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('put up with sth/sb');
      expect(m!.surface).toBe('put up with this noise');
    });

    it('P29: cash flow — contiguous compound', () => {
      const index = buildIndex(['cash flow']);
      const m = matchPhrase(req('Cash flow improved this quarter.', 'cash'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('cash flow');
      expect(m!.surface).toBe('Cash flow');
      expect(m!.quality).toBe('fixed');
    });

    it('P33: be (right) under your nose — optional right skipped', () => {
      const index = buildIndex(['be (right) under your nose']);
      const m = matchPhrase(req('The answer was under my nose.', 'under'), index);
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('be (right) under your nose');
      expect(m!.surface).toBe('was under my nose');
    });
  });

  describe('matchPhrase — negative cases (ADR N01-N12)', () => {
    it('N01: no match when preposition differs', () => {
      const index = buildIndex(['be (right) under your nose']);
      const m = matchPhrase(req('The answer was right beside my nose.', 'beside'), index);
      expect(m).toBeNull();
    });

    it('N02: no match when single token cannot split', () => {
      const index = buildIndex(['cash flow']);
      const m = matchPhrase(req('Cashflow improved.', 'cashflow'), index);
      expect(m).toBeNull();
    });

    it('N03: no match when particle is missing', () => {
      const index = buildIndex(['carry sth out']);
      const m = matchPhrase(req('She carried the plan.', 'carried'), index);
      expect(m).toBeNull();
    });

    it('N07: alternatives are mutually exclusive', () => {
      const index = buildIndex(['a close/near thing']);
      const m = matchPhrase(req('It was a close near thing.', 'close'), index);
      expect(m).toBeNull();
    });
  });

  describe('matchPhrase — ranking (ADR §9)', () => {
    it('prefers longer fixed phrase over shorter', () => {
      const index = buildIndex(['pick up', 'pick up the pieces']);
      const m = matchPhrase(req('They picked up the pieces.', 'picked'), index);
      expect(m!.dictionaryTerm).toBe('pick up the pieces');
    });

    it('prefers fixed over slot-template quality', () => {
      const index = buildIndex(['kick the bucket', 'kick sth bucket']);
      const m = matchPhrase(req('He kicked the bucket.', 'kicked'), index);
      expect(m!.dictionaryTerm).toBe('kick the bucket');
      expect(m!.quality).toBe('inflected');
    });
  });

  describe('matchPhrase — edge cases', () => {
    it('returns null when cursor is outside any word token', () => {
      const index = buildIndex(['kick the bucket']);
      const m = matchPhrase({ sentence: 'Hello world.', cursorOffset: 5 }, index);
      expect(m).toBeNull();
    });

    it('returns null when no templates in index', () => {
      const index = buildIndex([]);
      const m = matchPhrase(req('Hello world.', 'hello'), index);
      expect(m).toBeNull();
    });

    it('returns null when no anchor matches any window token', () => {
      const index = buildIndex(['kick the bucket']);
      const m = matchPhrase(req('Hello world.', 'hello'), index);
      expect(m).toBeNull();
    });
  });
});
