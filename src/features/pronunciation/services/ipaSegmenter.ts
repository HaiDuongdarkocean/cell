import type { Phoneme, PhonemeType } from '../types';

/**
 * Known English IPA vowel base characters (eSpeak / en output).
 */
const VOWEL_BASE = new Set([
  'i', 'ɪ', 'e', 'æ', 'ɑ', 'ɒ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ə', 'ɛ', 'œ',
  'ɨ', 'ɘ', 'ɜ', 'y', 'ø', 'ɯ', 'ɤ', 'o', 'a',
]);

/**
 * Known English IPA consonant base characters.
 */
const CONSONANT_BASE = new Set([
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 'ɹ',
  's', 't', 'v', 'w', 'z', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ', 'ç', 'ʎ', 'ɲ',
  'x', 'χ', 'ɣ', 'ʁ', 'ɬ', 'ɮ', 'ʋ', 'ɾ', 'ɽ', 'ʔ', 'ɡ', 'ɢ',
]);

/** Primary stress and secondary stress marks. */
const STRESS_MARKS = new Set(['ˈ', 'ˌ']);

/** Length mark attaches to the preceding vowel. */
const LENGTH_MARK = 'ː';

/** Multi-character vowel units (vowel + length mark). */
const VOWEL_WITH_LENGTH = new Set([
  'iː', 'uː', 'ɑː', 'ɔː', 'ɜː', 'eː', 'oː', 'ɛː', 'æː', 'yː', 'øː',
]);

/** English diphthongs recognized by eSpeak. */
const DIPHTHONGS = new Set([
  'əʊ', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'ɪə', 'eə', 'ʊə', 'oʊ', 'ɔʊ',
  'əu', 'ai', 'au', 'ɔi', 'ei', 'iə', 'uə', 'ou', 'ɔə',
]);

/** Affricates / complex consonants. */
const AFFRICATES = new Set(['tʃ', 'dʒ']);

/** Word/clause separators emitted by eSpeak. */
const SEPARATORS = new Set([' ', '\t', '\n', '\r']);

const MULTI_CHAR_TOKENS: readonly string[] = [...VOWEL_WITH_LENGTH, ...AFFRICATES, ...DIPHTHONGS]
  .sort((a, b) => b.length - a.length);

function classify(ipa: string): PhonemeType {
  if (STRESS_MARKS.has(ipa)) return 'stress';
  if (SEPARATORS.has(ipa)) return 'separator';

  // Known multi-character units first.
  if (VOWEL_WITH_LENGTH.has(ipa)) return 'vowel';
  if (DIPHTHONGS.has(ipa)) return 'diphthong';
  if (AFFRICATES.has(ipa)) return 'consonant';

  const chars = [...ipa];
  const hasVowel = chars.some((c) => VOWEL_BASE.has(c));
  const hasConsonant = chars.some((c) => CONSONANT_BASE.has(c));

  // Length mark attaches to a vowel (should already be handled above, but keep for safety).
  if (chars.includes(LENGTH_MARK)) {
    return hasVowel ? 'vowel' : 'consonant';
  }

  if (hasVowel && hasConsonant) {
    return 'consonant';
  }
  if (hasVowel) {
    return chars.length > 1 ? 'diphthong' : 'vowel';
  }
  return 'consonant';
}

/**
 * Parse an eSpeak IPA string into a sequence of phonemes.
 *
 * Each phoneme is a single logical unit (e.g. "tʃ", "əʊ", "ˈ").
 * The returned timeline values are all `0` — callers should pass through
 * `phonemeTimelineEstimator` to assign `startMs`/`endMs`.
 */
export function parseIPA(ipa: string): Phoneme[] {
  const phonemes: Phoneme[] = [];
  const chars = [...ipa];
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    // 1. Multi-character tokens (longest match).
    let matched = '';
    for (const token of MULTI_CHAR_TOKENS) {
      const slice = chars.slice(i, i + token.length).join('');
      if (slice === token) {
        matched = token;
        break;
      }
    }

    if (matched) {
      phonemes.push({
        ipa: matched,
        startMs: 0,
        endMs: 0,
        type: classify(matched),
      });
      i += matched.length;
      continue;
    }

    // 2. Stress marks (separate tokens, no audio time).
    if (STRESS_MARKS.has(c)) {
      phonemes.push({
        ipa: c,
        startMs: 0,
        endMs: 0,
        type: 'stress',
      });
      i += 1;
      continue;
    }

    // 3. Length mark — should be part of a vowel; attach to previous vowel if any.
    if (c === LENGTH_MARK) {
      const prev = phonemes[phonemes.length - 1];
      if (prev && (prev.type === 'vowel' || prev.type === 'diphthong')) {
        const prevIndex = phonemes.length - 1;
        const joined = prev.ipa + c;
        phonemes[prevIndex] = {
          ...prev,
          ipa: joined,
          type: classify(joined),
        };
      } else {
        phonemes.push({
          ipa: c,
          startMs: 0,
          endMs: 0,
          type: 'vowel',
        });
      }
      i += 1;
      continue;
    }

    // 4. Separator (space between words / clauses).
    if (SEPARATORS.has(c)) {
      phonemes.push({
        ipa: c,
        startMs: 0,
        endMs: 0,
        type: 'separator',
      });
      i += 1;
      continue;
    }

    // 5. Single vowel or consonant base character.
    if (VOWEL_BASE.has(c) || CONSONANT_BASE.has(c)) {
      phonemes.push({
        ipa: c,
        startMs: 0,
        endMs: 0,
        type: classify(c),
      });
      i += 1;
      continue;
    }

    // 6. Unknown character — skip with a dev warning.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[ipaSegmenter] Unknown IPA character at ${i}: "${c}"`);
    }
    i += 1;
  }

  return phonemes;
}
