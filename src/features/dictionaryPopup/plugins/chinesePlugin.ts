// chinesePlugin — spec §4.6.4: Chinese language plugin.
//
// Dictionary-driven Forward Maximum Matching (FMM) segmentation: scan
// left→right, match the longest dictionary term at each position. No
// external library — pure function with a TermProbe (hasTerm).
//
// Pinyin reading: the plugin does NOT generate pinyin itself — pinyin
// comes from the dictionary entry (CEDICT stores pinyin per term). The
// plugin's readingKind is 'pinyin' so the orchestrator knows to display
// the entry's reading field as pinyin.
//
// Chengyu (成语): 4-character idioms are naturally handled by FMM — if a
// 4-char sequence is in the dictionary, FMM matches it as a single
// segment. No special-casing needed. The plugin exposes a helper
// `isChengyu(term)` for the UI to label chengyu entries.
//
// ponytail: FMM does not handle ambiguity well (研究生命 → 研究生/命
// vs 研究生/命). Ceiling: ambiguity cases. Upgrade path: DAG + word
// frequency score (spec §D-alternatives).

import type {
  LanguagePlugin,
  Token,
  TermProbe,
  Accent,
} from './languagePlugin';

/** Chinese accents for audio priority (spec §4.6.4). */
export const CHINESE_ACCENTS: readonly Accent[] = [
  { id: 'pinyin', label: 'Pinyin' },
];

/** Maximum word length for FMM — CEDICT's longest entries are ~8 chars. */
const MAX_WORD_LEN = 8;

/** CJK Unified Ideographs range (basic + extension A). */
const CJK_CHAR = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/** Word character for non-CJK runs (latin, digits, apostrophe, hyphen). */
const WORD_CHAR = /[\p{L}\p{N}'-]/u;

/** Check if a character is a CJK ideograph. */
export function isCJK(ch: string): boolean {
  return ch.length === 1 && CJK_CHAR.test(ch);
}

/** Check if a string is entirely CJK ideographs. */
export function isCJKString(s: string): boolean {
  return s.length > 0 && [...s].every(isCJK);
}

/** Check if a term is a chengyu (4-character idiom). */
export function isChengyu(term: string): boolean {
  return term.length === 4 && isCJKString(term);
}

/**
 * Forward Maximum Matching segmentation (spec §4.6.4, §D-alternatives).
 *
 * Scans left→right, at each position tries the longest dictionary term
 * (up to MAX_WORD_LEN chars). If no multi-char term matches, emits the
 * single character as a token. Non-CJK characters (punctuation, spaces,
 * latin) are emitted as single-char tokens.
 *
 * O(n · maxWordLen) where n = text length, maxWordLen = 8. Fast enough
 * for subtitle-length text on RAM 4GB in a Web Worker.
 *
 * ponytail: does not handle ambiguity (研究生命). Ceiling: ambiguity
 * cases. Upgrade: DAG + word frequency score.
 */
export function segmentFMM(text: string, dict: TermProbe): readonly Token[] {
  const tokens: Token[] = [];
  const chars = [...text];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    // Non-CJK: collect a run of word characters (latin/digits/apostrophe)
    // or emit a single non-word character (punctuation, space).
    if (!isCJK(ch)) {
      if (WORD_CHAR.test(ch)) {
        const start = i;
        while (i < chars.length && !isCJK(chars[i]!) && WORD_CHAR.test(chars[i]!)) i++;
        tokens.push({ text: chars.slice(start, i).join('').toLowerCase(), start, end: i });
      } else {
        // Punctuation/space: emit as single-char token.
        tokens.push({ text: ch.toLowerCase(), start: i, end: i + 1 });
        i++;
      }
      continue;
    }
    // CJK: try longest match from MAX_WORD_LEN down to 1.
    let matched = false;
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (dict.hasTerm(candidate)) {
        tokens.push({ text: candidate, start: i, end: i + len });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Single CJK char as fallback token.
      tokens.push({ text: ch, start: i, end: i + 1 });
      i++;
    }
  }
  return tokens;
}

/**
 * Create the Chinese language plugin.
 *
 * The plugin is stateless — the orchestrator provides the TermProbe
 * (dictionary) per segmentation call via plugin.segment(text, dict).
 */
export function createChinesePlugin(): LanguagePlugin {
  return {
    langCode: 'zh',
    readingKind: 'pinyin',
    accents: CHINESE_ACCENTS,
    tokenize(sentence: string): readonly Token[] {
      // For Chinese, tokenize = segment with a trivial probe that matches
      // only single chars. The real segmentation uses plugin.segment
      // with a dictionary-backed TermProbe.
      return segmentFMM(sentence, { hasTerm: () => false });
    },
    segment(text: string, dict: TermProbe): readonly Token[] {
      return segmentFMM(text, dict);
    },
  };
}
