// englishPlugin tests — spec §4.6.3.

import { describe, expect, it } from '@jest/globals';
import {
  createEnglishPlugin,
  englishLemma,
  isPossessivePronoun,
  ENGLISH_ACCENTS,
} from './englishPlugin';
import {
  compilePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

const TEST_VERBS = new Set(['be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick', 'put', 'look']);

function buildIndex(terms: string[]): PhraseIndexInput[] {
  return terms.map((t, i) => {
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
}

describe('englishPlugin', () => {
  describe('metadata', () => {
    it('has langCode en and readingKind ipa', () => {
      const plugin = createEnglishPlugin(compilePhraseIndex([]));
      expect(plugin.langCode).toBe('en');
      expect(plugin.readingKind).toBe('ipa');
    });

    it('has UK + US accents', () => {
      expect(ENGLISH_ACCENTS).toHaveLength(2);
      expect(ENGLISH_ACCENTS.map((a) => a.id)).toContain('uk');
      expect(ENGLISH_ACCENTS.map((a) => a.id)).toContain('us');
    });
  });

  describe('tokenize', () => {
    it('splits a sentence into lowercase tokens with offsets', () => {
      const plugin = createEnglishPlugin(compilePhraseIndex([]));
      const tokens = plugin.tokenize('Hello world.');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.text).toBe('hello');
      expect(tokens[0]!.start).toBe(0);
      expect(tokens[1]!.text).toBe('world');
      expect(tokens[1]!.start).toBe(6);
    });

    it('preserves offsets for contractions', () => {
      const plugin = createEnglishPlugin(compilePhraseIndex([]));
      const tokens = plugin.tokenize("don't go");
      expect(tokens[0]!.text).toBe("don't");
      expect(tokens[0]!.start).toBe(0);
      expect(tokens[0]!.end).toBe(5);
    });
  });

  describe('lemma', () => {
    it('lemmatizes irregular verbs', () => {
      expect(englishLemma('was')).toBe('be');
      expect(englishLemma('were')).toBe('be');
      expect(englishLemma('took')).toBe('take');
      expect(englishLemma('gave')).toBe('give');
      expect(englishLemma('ran')).toBe('run');
      expect(englishLemma('came')).toBe('come');
    });

    it('lemmatizes regular past tense (-ed)', () => {
      expect(englishLemma('kicked')).toBe('kick');
      expect(englishLemma('looked')).toBe('look');
      expect(englishLemma('started')).toBe('start');
    });

    it('lemmatizes -ied → -y (carried → carry)', () => {
      expect(englishLemma('carried')).toBe('carry');
    });

    it('lemmatizes 3rd person singular (-s)', () => {
      expect(englishLemma('looks')).toBe('look');
      expect(englishLemma('kicks')).toBe('kick');
    });

    it('lemmatizes -ies → -y (carries → carry)', () => {
      expect(englishLemma('carries')).toBe('carry');
    });

    it('does not split -ss words (class → class)', () => {
      expect(englishLemma('class')).toBe('class');
      expect(englishLemma('boss')).toBe('boss');
    });

    it('lemmatizes gerund (-ing)', () => {
      expect(englishLemma('running')).toBe('runn');
      // ponytail: gerund stripping is naive (runn, not run) — the matcher
      // also tries stem+e and stem+y. This is a known ceiling.
    });

    it('returns lowercase for non-verb words', () => {
      expect(englishLemma('hello')).toBe('hello');
      expect(englishLemma('WORLD')).toBe('world');
    });
  });

  describe('normalizePossessive', () => {
    it('normalizes possessive pronouns to "your"', () => {
      const plugin = createEnglishPlugin(compilePhraseIndex([]));
      expect(plugin.normalizePossessive!('my')).toBe('your');
      expect(plugin.normalizePossessive!('his')).toBe('your');
      expect(plugin.normalizePossessive!('her')).toBe('your');
      expect(plugin.normalizePossessive!('their')).toBe('your');
    });

    it('passes through non-possessive words', () => {
      const plugin = createEnglishPlugin(compilePhraseIndex([]));
      expect(plugin.normalizePossessive!('cat')).toBe('cat');
      expect(plugin.normalizePossessive!('the')).toBe('the');
    });
  });

  describe('isPossessivePronoun', () => {
    it('identifies possessive pronouns', () => {
      expect(isPossessivePronoun('my')).toBe(true);
      expect(isPossessivePronoun('your')).toBe(true);
      expect(isPossessivePronoun('his')).toBe(true);
      expect(isPossessivePronoun('their')).toBe(true);
    });

    it('rejects non-possessive words', () => {
      expect(isPossessivePronoun('cat')).toBe(false);
      expect(isPossessivePronoun('the')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isPossessivePronoun('MY')).toBe(true);
      expect(isPossessivePronoun('His')).toBe(true);
    });
  });

  describe('matchPhrase', () => {
    it('delegates to phraseMatcher and returns a match', () => {
      const inputs = buildIndex(['kick the bucket']);
      const index = compilePhraseIndex(inputs);
      const plugin = createEnglishPlugin(index, 7);
      const m = plugin.matchPhrase!({
        sentence: 'He kicked the bucket.',
        cursorOffset: 3,
      });
      expect(m).not.toBeNull();
      expect(m!.dictionaryTerm).toBe('kick the bucket');
      expect(m!.sourceResourceId).toBe(7);
    });

    it('returns null when no phrase matches', () => {
      const inputs = buildIndex(['kick the bucket']);
      const index = compilePhraseIndex(inputs);
      const plugin = createEnglishPlugin(index);
      const m = plugin.matchPhrase!({
        sentence: 'Hello world.',
        cursorOffset: 0,
      });
      expect(m).toBeNull();
    });
  });
});
