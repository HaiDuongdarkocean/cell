import { tokenizeSentence, type SentenceToken } from '@/features/dictionary/logic/phraseMatcher';
import { segmentFMM } from '@/features/dictionaryPopup/plugins/chinesePlugin';
import type { Token, TokenStatus, TokenFrequencyBand, TokenBlock } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';

/** Treat a token as a separator if it contains no letters or digits. */
function isSeparator(surface: string): boolean {
  return /^[^\p{L}\p{N}]+$/u.test(surface);
}

/** Tokenize a block's source text synchronously and store the result on the block. */
export function prepareTokenBlock(block: TokenBlock, langCode: string = DEFAULT_LANG): void {
  if (block.tokens) return;
  block.tokens = tokenizeTextBlock(block.originalText, langCode);
}

/** Tokenize a block of text into word tokens with UTF-16 offsets + sentence index. */
export function tokenizeTextBlock(text: string, langCode: string = DEFAULT_LANG): Token[] {
  const rawTokens = langCode === 'zh' ? segmentFMM(text, { hasTerm: () => false }) : tokenizeSentence(text);
  const result: Token[] = [];
  let sentenceIndex = 0;

  for (const raw of rawTokens) {
    const surface =
      langCode === 'zh'
        ? raw.text
        : (raw as SentenceToken).raw ?? text.slice(raw.start, raw.end);
    const term = langCode === 'zh' ? raw.text : raw.text.toLowerCase();
    // English: increment sentence index when sentence-ending punctuation preceded this token.
    if (langCode !== 'zh' && (raw as SentenceToken).precededBySentencePunct) {
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
    });
  }

  return result;
}

/** Extract the sentence text containing the given token, using sentenceIndex grouping. */
export function getSentenceText(block: TokenBlock, token: Token): string {
  const tokens = block.tokens;
  if (!tokens || tokens.length === 0) return block.originalText;
  const idx = token.sentenceIndex;
  // Find first and last token with the same sentenceIndex.
  let start = token.start;
  let end = token.end;
  for (const t of tokens) {
    if (t.sentenceIndex !== idx) continue;
    if (t.start < start) start = t.start;
    if (t.end > end) end = t.end;
  }
  // Extend end to include trailing punctuation (., !, ?) that was skipped by the tokenizer.
  const text = block.originalText;
  while (end < text.length && /[.!?]/.test(text[end]!)) {
    end++;
  }
  // Trim leading whitespace from the slice for a clean sentence.
  const slice = text.slice(start, end);
  return slice.trimStart();
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
