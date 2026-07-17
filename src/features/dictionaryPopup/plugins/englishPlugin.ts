// englishPlugin — spec §4.6.3: English language plugin.
//
// Tokenizes by whitespace + punctuation (reusing phraseMatcher's tokenizer),
// lemmatizes with irregular + regular rules, normalizes possessive pronouns,
// and delegates phrase matching to the phraseMatcher (ADR-037).
//
// The plugin is stateless — the orchestrator provides the PhraseIndex per
// lookup. The plugin's matchPhrase is a thin adapter that calls the matcher
// with the resident index for the active resource.

import type {
  LanguagePlugin,
  Token,
  PhraseMatchRequest,
  PhraseMatch,
  Accent,
} from './languagePlugin';
import {
  tokenizeSentence,
  matchPhrase as matcherMatchPhrase,
  type SentenceToken,
} from '@/features/dictionary/logic/phraseMatcher';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';
import { englishLemmaCandidates, englishLemma as sharedEnglishLemma } from '../logic/englishLemma';

/** English accents for audio priority (spec §4.6.3). */
export const ENGLISH_ACCENTS: readonly Accent[] = [
  { id: 'uk', label: 'UK' },
  { id: 'us', label: 'US' },
];

/** Possessive pronouns that normalize to a placeholder. */
const POSSESSIVE_PRONOUNS = new Set([
  'my', 'your', 'his', 'her', 'its', 'our', 'their', "one's",
]);

/** Placeholder for possessive normalization. */
const POSSESSIVE_PLACEHOLDER = 'your';

/**
 * English language plugin.
 *
 * Stateless — the orchestrator provides the PhraseIndex per lookup via
 * `createEnglishPlugin(index)`. The plugin's matchPhrase delegates to
 * phraseMatcher.matchPhrase with the provided index + resourceId.
 * Lemma logic is delegated to the shared `englishLemma` module (ADR-041).
 */
export function createEnglishPlugin(
  index: PhraseIndex,
  sourceResourceId: number = 0,
): LanguagePlugin {
  return {
    langCode: 'en',
    readingKind: 'ipa',
    accents: ENGLISH_ACCENTS,
    tokenize(sentence: string): readonly Token[] {
      return tokenizeSentence(sentence).map((t: SentenceToken) => ({
        text: t.text,
        start: t.start,
        end: t.end,
      }));
    },
    lemma(word: string): string {
      return sharedEnglishLemma(word);
    },
    lemmaCandidates(word: string): string[] {
      return englishLemmaCandidates(word);
    },
    normalizePossessive(text: string): string {
      const lower = text.toLowerCase();
      if (POSSESSIVE_PRONOUNS.has(lower)) return POSSESSIVE_PLACEHOLDER;
      return text;
    },
    matchPhrase(request: PhraseMatchRequest): PhraseMatch | null {
      return matcherMatchPhrase(request, index, sourceResourceId);
    },
  };
}

/** English lemmatization — re-export from shared module (ADR-041).
 * @deprecated Use `englishLemmaCandidates` from `../logic/englishLemma` for multi-candidate. */
export { sharedEnglishLemma as englishLemma };

/** Check if a word is a possessive pronoun. */
export function isPossessivePronoun(word: string): boolean {
  return POSSESSIVE_PRONOUNS.has(word.toLowerCase());
}
