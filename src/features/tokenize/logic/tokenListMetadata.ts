import type { WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { getFrequencyEntries } from '@/features/dictionary/services/frequencyClient';
import {
  entriesToBand,
  loadFrequencyBandOptions,
} from '@/features/tokenize/utils/frequencyBand';

export function createTokenList(text: string, langCode: string): Token[] {
  return tokenizeTextBlock(text, langCode).map((token) => ({
    ...token,
    status: 'unknown' as const,
    frequencyBand: 'none' as const,
  }));
}

export function applyTokenListStatus(
  tokens: readonly Token[],
  term: string,
  status: WordStatus,
): readonly Token[] {
  let changed = false;
  const next = tokens.map((token) => {
    if (token.isSeparator || token.term !== term || token.status === status) return token;
    changed = true;
    return { ...token, status };
  });
  return changed ? next : tokens;
}

export async function resolveTokenListMetadata(
  tokens: readonly Token[],
  langCode: string,
): Promise<readonly Token[]> {
  const terms = new Set<string>();
  for (const token of tokens) {
    if (!token.isSeparator) terms.add(token.term);
  }
  if (terms.size === 0) return tokens;

  const termList = [...terms];
  try {
    const [statusMap, freqMaps, bandOpts] = await Promise.all([
      getWordStatuses(langCode, termList),
      getFrequencyEntries(langCode, termList),
      loadFrequencyBandOptions(langCode),
    ]);

    return tokens.map((token) =>
      token.isSeparator
        ? token
        : {
            ...token,
            status: statusMap.get(token.term) ?? 'unknown',
            frequencyBand: entriesToBand(freqMaps.get(token.term) ?? [], bandOpts),
          },
    );
  } catch {
    return tokens;
  }
}
