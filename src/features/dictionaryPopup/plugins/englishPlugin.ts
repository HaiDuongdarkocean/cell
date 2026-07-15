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

/** English accents for audio priority (spec §4.6.3). */
export const ENGLISH_ACCENTS: readonly Accent[] = [
  { id: 'uk', label: 'UK' },
  { id: 'us', label: 'US' },
];

/** Irregular verb lemmas (same set as phraseMatcher). */
const IRREGULAR_LEMMAS: ReadonlyMap<string, string> = new Map([
  ['was', 'be'], ['were', 'be'], ['been', 'be'], ['being', 'be'], ['is', 'be'], ['are', 'be'], ['am', 'be'],
  ['spilled', 'spill'], ['spilt', 'spill'],
  ['broke', 'break'], ['broken', 'break'],
  ['kicked', 'kick'],
  ['carried', 'carry'],
  ['took', 'take'], ['taken', 'take'],
  ['gave', 'give'], ['given', 'give'],
  ['ran', 'run'],
  ['picked', 'pick'],
  ['came', 'come'],
  ['looked', 'look'],
  ['got', 'get'], ['gotten', 'get'],
  ['started', 'start'],
  ['went', 'go'], ['gone', 'go'],
  ['made', 'make'],
  ['did', 'do'], ['done', 'do'],
  ['had', 'have'], ['has', 'have'],
  ['said', 'say'],
  ['saw', 'see'], ['seen', 'see'],
  ['knew', 'know'], ['known', 'know'],
  ['found', 'find'],
  ['told', 'tell'],
  ['called', 'call'],
  ['tried', 'try'],
  ['asked', 'ask'],
  ['felt', 'feel'],
  ['left', 'leave'],
  ['worked', 'work'],
  ['kept', 'keep'],
  ['began', 'begin'], ['begun', 'begin'],
  ['showed', 'show'], ['shown', 'show'],
  ['heard', 'hear'],
  ['played', 'play'],
  ['turned', 'turn'],
  ['moved', 'move'],
  ['lived', 'live'],
  ['held', 'hold'],
  ['brought', 'bring'],
  ['happened', 'happen'],
  ['wrote', 'write'], ['written', 'write'],
  ['sat', 'sit'],
  ['stood', 'stand'],
  ['lost', 'lose'],
  ['paid', 'pay'],
  ['met', 'meet'],
  ['set', 'set'],
  ['led', 'lead'],
  ['stopped', 'stop'],
  ['spoke', 'speak'], ['spoken', 'speak'],
  ['read', 'read'],
  ['spent', 'spend'],
  ['grew', 'grow'], ['grown', 'grow'],
  ['won', 'win'],
  ['bought', 'buy'],
  ['sent', 'send'],
  ['built', 'build'],
  ['fell', 'fall'], ['fallen', 'fall'],
  ['cut', 'cut'],
  ['reached', 'reach'],
  ['passed', 'pass'],
  ['sold', 'sell'],
  ['decided', 'decide'],
  ['pulled', 'pull'],
  ['hoped', 'hope'],
  ['received', 'receive'],
  ['produced', 'produce'],
  ['ate', 'eat'], ['eaten', 'eat'],
  ['caught', 'catch'],
  ['drew', 'draw'], ['drawn', 'draw'],
  ['chose', 'choose'], ['chosen', 'choose'],
  ['saved', 'save'],
  ['arrived', 'arrive'],
  ['visited', 'visit'],
]);

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
      return englishLemma(word);
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

/** English lemmatization — irregular map + regular -ed/-s stripping. */
export function englishLemma(word: string): string {
  const lower = word.toLowerCase();
  const irreg = IRREGULAR_LEMMAS.get(lower);
  if (irreg) return irreg;
  // Regular past: ends in 'ed'.
  if (lower.length > 3 && lower.endsWith('ed')) {
    const stem = lower.slice(0, -2);
    // "carried" → "carri" — also try stem + 'y' and stem + 'e'.
    if (stem.endsWith('i')) return stem.slice(0, -1) + 'y';
    return stem;
  }
  // Regular 3rd person: ends in 's' (not 'ss').
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) {
    // "looks" → "look", "carries" → "carrie" → "carry"
    const stem = lower.slice(0, -1);
    if (stem.endsWith('ie')) return stem.slice(0, -2) + 'y';
    return stem;
  }
  // Gerund/present participle: ends in 'ing'.
  if (lower.length > 4 && lower.endsWith('ing')) {
    const stem = lower.slice(0, -3);
    if (stem.length >= 3) return stem;
  }
  return lower;
}

/** Check if a word is a possessive pronoun. */
export function isPossessivePronoun(word: string): boolean {
  return POSSESSIVE_PRONOUNS.has(word.toLowerCase());
}
