import { tokenizeSentence, type SentenceToken } from '@/features/dictionary';
import { segmentFMM } from '@/features/dictionary';
import { languageMatches } from '@/shared/config/languageRegistry';
import { SENTENCE_END_PUNCT_RE } from '@/shared/lib/sentencePunct';
import type { Token, TokenStatus, TokenFrequencyBand, TokenBlock } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';

/** Compact duration stamps ("29m", "15h", "3d", "2w", "1y") are timestamp
 *  chrome on social feeds, not vocabulary — render as separators so no
 *  annotation lanes appear. */
const DURATION_STAMP_RE = /^\d+[smhdwy]$/i;

/** Treat a token as a separator if it contains no letters or digits. */
function isSeparator(surface: string): boolean {
  return /^[^\p{L}\p{N}]+$/u.test(surface) || DURATION_STAMP_RE.test(surface);
}

/** Allowed characters for an English token surface (ASCII letters, digits,
 *  apostrophes, hyphens) plus a check that at least one letter is present.
 *  This filters Vietnamese diacritics and other non-English scripts.
 *
 *  ponytail: this is an ASCII-only heuristic. It deliberately drops legitimate
 *  English words with diacritics (café, naïve, résumé) to keep the check fast
 *  and deterministic. Upgrade path: derive allowed character sets per language
 *  from the language registry or a Unicode script profile. */
const ENGLISH_TOKEN_CHARS = /^[A-Za-z0-9'-]+$/;
const HAS_LATIN_LETTER = /[A-Za-z]/;
/** English has only two one-letter words ("a", "I"). Other single letters are
 *  anti-scraping splinters (Facebook renders "Sponsored" as one letter per
 *  span) or timestamp units ("16 h") — never worth annotating. */
const SINGLE_LETTER_WORD = /^[ai]$/i;

/** Check whether a token surface looks like an English word. */
function isEnglishLikeToken(surface: string): boolean {
  if (surface.length === 1 && !SINGLE_LETTER_WORD.test(surface)) return false;
  return ENGLISH_TOKEN_CHARS.test(surface) && HAS_LATIN_LETTER.test(surface);
}

/** Check whether a token surface is compatible with the target tokenize language.
 *  For English this rejects words containing non-ASCII characters, preventing
 *  Vietnamese/French/etc. words from being tokenized and looked up by mistake. */
function isTokenCompatibleWithLanguage(surface: string, langCode: string): boolean {
  if (languageMatches('zh', langCode)) return true;
  if (languageMatches('en', langCode)) return isEnglishLikeToken(surface);
  return true;
}

/** Tokenize a block's source text synchronously and store the result on the block. */
export function prepareTokenBlock(block: TokenBlock, langCode: string = DEFAULT_LANG): void {
  if (block.tokens) return;
  block.tokens = tokenizeTextBlock(block.originalText, langCode);
}

/** Prefix count of sentence terminators per code-point offset, so the CJK path
 *  derives a token's sentence index in O(1) — the segmenter emits terminators
 *  as their own tokens and carries no sentence information. */
function buildBoundaryPrefix(chars: readonly string[]): number[] {
  const prefix = new Array<number>(chars.length + 1).fill(0);
  for (let i = 0; i < chars.length; i++) {
    prefix[i + 1] = prefix[i]! + (SENTENCE_END_PUNCT_RE.test(chars[i]!) ? 1 : 0);
  }
  return prefix;
}

/** Tokenize a block of text into word tokens with UTF-16 offsets + sentence index. */
export function tokenizeTextBlock(text: string, langCode: string = DEFAULT_LANG): Token[] {
  const isZh = langCode === 'zh';
  const rawTokens = isZh ? segmentFMM(text, { hasTerm: () => false }) : tokenizeSentence(text);
  // The CJK segmenter offsets index the code-point array, not UTF-16 units.
  const boundaryPrefix = isZh ? buildBoundaryPrefix([...text]) : null;
  const result: Token[] = [];
  let sentenceIndex = 0;

  for (const raw of rawTokens) {
    const surface =
      isZh
        ? raw.text
        : (raw as SentenceToken).raw ?? text.slice(raw.start, raw.end);
    const term = isZh ? raw.text : raw.text.toLowerCase();
    if (!isTokenCompatibleWithLanguage(surface, langCode)) continue;
    if (boundaryPrefix) {
      sentenceIndex = boundaryPrefix[raw.start] ?? sentenceIndex;
    } else if ((raw as SentenceToken).precededBySentencePunct) {
      sentenceIndex++;
    }
    result.push({
      text: surface,
      term,
      start: raw.start,
      end: raw.end,
      isSeparator: isSeparator(surface),
      sentenceIndex,
      status: undefined,
      frequencyBand: undefined,
      reading: undefined,
    });
  }

  return result;
}

export interface SentenceRange {
  readonly start: number;
  readonly end: number;
}

const SENTENCE_CLOSER_RE = /["'”’)\]}»›]/;

/** Position after the last sentence terminator inside `text[from, to)`, or -1
 *  when the gap holds none. */
function lastTerminatorEnd(text: string, from: number, to: number): number {
  let end = -1;
  for (let i = from; i < to; i++) {
    if (SENTENCE_END_PUNCT_RE.test(text[i]!)) end = i + 1;
  }
  return end;
}

/** Span of the sentence `sentenceIndex` covers.
 *
 *  Token surfaces can be filtered out (digits, single letters, non-target
 *  scripts), so token.start/end alone truncates the sentence at filtered
 *  runs like "−2 °C". The boundary lives inside the gap between kept tokens:
 *  the last terminator in that gap closes the sentence (mirroring how the
 *  renderer assigns the gap separator to the previous sentence). */
export function sentenceRangeForIndex(
  tokens: readonly Token[],
  text: string,
  sentenceIndex: number,
): SentenceRange | null {
  const words = tokens.filter((t) => !t.isSeparator);
  const firstIdx = words.findIndex((t) => t.sentenceIndex === sentenceIndex);
  if (firstIdx < 0) return null;
  const first = words[firstIdx]!;
  let last = first;
  let next: Token | undefined;
  for (let i = firstIdx + 1; i < words.length; i++) {
    if (words[i]!.sentenceIndex !== sentenceIndex) {
      next = words[i];
      break;
    }
    last = words[i]!;
  }

  let start = first.start;
  if (firstIdx === 0 && start > 0) {
    const leadEnd = lastTerminatorEnd(text, 0, start);
    start = leadEnd >= 0 ? leadEnd : 0;
    while (start < first.start && SENTENCE_CLOSER_RE.test(text[start]!)) start++;
  }

  let end: number;
  if (next) {
    const closed = lastTerminatorEnd(text, last.end, next.start);
    end = closed >= 0 ? closed : next.start;
    while (end < next.start && SENTENCE_CLOSER_RE.test(text[end]!)) end++;
  } else {
    end = text.length;
  }
  return { start, end };
}

/** Sentence index of the token at `offset`; offsets on gaps (spaces,
 *  punctuation, filtered-out surfaces) resolve to the nearest token — a tie
 *  goes to the following token so a selection starting in the whitespace
 *  before a sentence lands inside that sentence. */
export function sentenceIndexAtOffset(tokens: readonly Token[], offset: number): number | null {
  let before: Token | null = null;
  let after: Token | null = null;
  for (const token of tokens) {
    if (token.isSeparator) continue;
    if (offset >= token.start && offset < token.end) return token.sentenceIndex;
    if (token.end <= offset) {
      if (!before || token.end > before.end) before = token;
      continue;
    }
    after = token;
    break;
  }
  if (before && after) {
    return offset - before.end < after.start - offset ? before.sentenceIndex : after.sentenceIndex;
  }
  return (before ?? after)?.sentenceIndex ?? null;
}

/** Locate the sentence containing `offset` inside raw text, using the same
 *  tokenizer sentenceIndex the hover wash paints — untokenized surfaces get
 *  the identical boundary. */
export function sentenceRangeAtOffset(
  text: string,
  offset: number,
  langCode: string = DEFAULT_LANG,
): SentenceRange | null {
  const tokens = tokenizeTextBlock(text, langCode);
  const index = sentenceIndexAtOffset(tokens, offset);
  if (index === null) return null;
  return sentenceRangeForIndex(tokens, text, index);
}

/** Sentence text for `sentenceIndex` inside a token list of `text`. */
export function sentenceTextForIndex(
  tokens: readonly Token[],
  text: string,
  sentenceIndex: number,
): string {
  const range = sentenceRangeForIndex(tokens, text, sentenceIndex);
  return range ? text.slice(range.start, range.end).trim() : text.trim();
}

/** Extract the sentence text containing the given token, using sentenceIndex grouping. */
export function getSentenceText(block: TokenBlock, token: Token): string {
  const tokens = block.tokens;
  if (!tokens || tokens.length === 0) return block.originalText;
  return sentenceTextForIndex(tokens, block.originalText, token.sentenceIndex);
}

/** Resolve status and frequency band for all tokens in a block. */
export async function resolveTokenMetadata(
  tokens: Token[],
  getStatus: (term: string) => Promise<TokenStatus>,
  getFrequencyBand: (term: string) => Promise<TokenFrequencyBand>,
): Promise<void> {
  const terms = new Set<string>();
  for (const token of tokens) {
    if (!token.isSeparator) terms.add(token.term);
  }

  const termList = [...terms];
  const [statusMap, frequencyMap] = await Promise.all([
    Promise.all(termList.map(async (term) => [term, await getStatus(term)] as const)),
    Promise.all(termList.map(async (term) => [term, await getFrequencyBand(term)] as const)),
  ]);

  const statuses = new Map<string, TokenStatus>(statusMap);
  const frequencies = new Map<string, TokenFrequencyBand>(frequencyMap);

  for (const token of tokens) {
    if (token.isSeparator) continue;
    token.status = statuses.get(token.term) ?? 'unknown';
    token.frequencyBand = frequencies.get(token.term) ?? 'none';
  }
}
