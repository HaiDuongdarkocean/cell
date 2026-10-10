import type { WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import { getWordStatuses } from '@/features/dictionary';
import { getFrequencyEntries } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import { getSrsCardTermSet } from '@/features/srs';
import {
  entriesToBand,
  loadFrequencyBandOptions,
  pickFrequencyReading,
} from '@/features/tokenize/utils/frequencyBand';

export function createTokenList(text: string, langCode: string): Token[] {
  return tokenizeTextBlock(text, langCode).map((token) => ({
    ...token,
    status: 'unknown' as const,
    frequencyBand: 'none' as const,
    reading: undefined,
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

export function applyTokenListCardFlags(
  tokens: readonly Token[],
  cardTerms: ReadonlySet<string>,
): readonly Token[] {
  let changed = false;
  const next = tokens.map((token) => {
    if (token.isSeparator) return token;
    const hasCard = cardTerms.has(token.term);
    if ((token.hasCard ?? false) === hasCard) return token;
    changed = true;
    return { ...token, hasCard };
  });
  return changed ? next : tokens;
}

export async function resolveTokenListMetadata(
  tokens: readonly Token[],
  langCode: string,
  options?: { readonly includeReadings?: boolean },
): Promise<readonly Token[]> {
  const terms = new Set<string>();
  for (const token of tokens) {
    if (!token.isSeparator) terms.add(token.term);
  }
  if (terms.size === 0) return tokens;

  const termList = [...terms];
  try {
    const [statusMap, freqMaps, bandOpts, dictReadings, cardTerms] = await Promise.all([
      getWordStatuses(langCode, termList),
      getFrequencyEntries(langCode, termList),
      loadFrequencyBandOptions(langCode),
      options?.includeReadings
        ? getReadings(langCode, termList).catch(() => null)
        : Promise.resolve(null),
      getSrsCardTermSet(langCode).catch(() => null),
    ]);

    return tokens.map((token) => {
      if (token.isSeparator) return token;
      const freqEntries = freqMaps.get(token.term) ?? [];
      // null = reading fetch failed → keep the existing reading rather than
      // flicker to blank; a resolved map is authoritative.
      const reading = dictReadings
        ? dictReadings.get(token.term) ?? pickFrequencyReading(token.term, freqEntries)
        : token.reading;
      return {
        ...token,
        status: statusMap.get(token.term) ?? 'unknown',
        frequencyBand: entriesToBand(freqEntries, bandOpts),
        reading,
        hasCard: cardTerms ? cardTerms.has(token.term) : token.hasCard,
      };
    });
  } catch {
    return tokens;
  }
}
