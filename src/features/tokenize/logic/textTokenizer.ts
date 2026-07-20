import { tokenizeSentence, type SentenceToken } from '@/features/dictionary/logic/phraseMatcher';
import { segmentFMM } from '@/features/dictionaryPopup/plugins/chinesePlugin';
import type { Token, TokenStatus, TokenFrequencyBand } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';

/** Treat a token as a separator if it contains no letters or digits. */
function isSeparator(surface: string): boolean {
  return /^[^\p{L}\p{N}]+$/u.test(surface);
}

/** Tokenize a block of text into word tokens with UTF-16 offsets. */
export function tokenizeTextBlock(text: string, langCode: string = DEFAULT_LANG): Token[] {
  const rawTokens = langCode === 'zh' ? segmentFMM(text, { hasTerm: () => false }) : tokenizeSentence(text);
  const result: Token[] = [];

  for (const raw of rawTokens) {
    const surface =
      langCode === 'zh'
        ? raw.text
        : (raw as SentenceToken).raw ?? text.slice(raw.start, raw.end);
    const term = langCode === 'zh' ? raw.text : raw.text.toLowerCase();
    result.push({
      text: surface,
      term,
      start: raw.start,
      end: raw.end,
      isSeparator: isSeparator(surface),
      status: undefined,
      frequencyBand: undefined,
    });
  }

  return result;
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
