import type { BilingualCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { getFrequencyEntries } from '@/features/dictionary/services/frequencyClient';
import {
  entriesToBand,
  loadFrequencyBandOptions,
} from '@/features/tokenize/utils/frequencyBand';
import {
  applyTokenListStatus,
  createTokenList,
} from '@/features/tokenize/logic/tokenListMetadata';

export type CueListTokenMap = ReadonlyMap<number, readonly Token[]>;

export function createCueListTokenMap(
  cues: readonly BilingualCue[],
  langCode: string,
): CueListTokenMap {
  const map = new Map<number, readonly Token[]>();
  for (const cue of cues) {
    map.set(cue.index, createTokenList(cue.targetText, langCode));
  }
  return map;
}

export function applyCueListTokenStatus(
  tokenMap: CueListTokenMap,
  term: string,
  status: WordStatus,
): CueListTokenMap {
  let changed = false;
  const resolved = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of tokenMap) {
    const nextTokens = applyTokenListStatus(tokens, term, status);
    if (nextTokens !== tokens) changed = true;
    resolved.set(cueIndex, nextTokens);
  }
  return changed ? resolved : tokenMap;
}

export function applyCueListTokenStatuses(
  tokenMap: CueListTokenMap,
  statuses: ReadonlyMap<string, WordStatus>,
): CueListTokenMap {
  let changed = false;
  const resolved = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of tokenMap) {
    const nextTokens = tokens.map((token) => {
      if (token.isSeparator) return token;
      const status = statuses.get(token.term);
      if (!status || token.status === status) return token;
      changed = true;
      return { ...token, status };
    });
    resolved.set(cueIndex, nextTokens);
  }
  return changed ? resolved : tokenMap;
}

export async function resolveCueListTokenMetadata(
  tokenMap: CueListTokenMap,
  langCode: string,
): Promise<CueListTokenMap> {
  const terms = new Set<string>();
  for (const tokens of tokenMap.values()) {
    for (const token of tokens) {
      if (!token.isSeparator) terms.add(token.term);
    }
  }
  if (terms.size === 0) return tokenMap;

  const termList = [...terms];
  try {
    const [statusMap, freqMaps, bandOpts] = await Promise.all([
      getWordStatuses(langCode, termList),
      getFrequencyEntries(langCode, termList),
      loadFrequencyBandOptions(langCode),
    ]);

    const resolved = new Map<number, readonly Token[]>();
    for (const [cueIndex, tokens] of tokenMap) {
      resolved.set(
        cueIndex,
        tokens.map((token) =>
          token.isSeparator
            ? token
            : {
                ...token,
                status: statusMap.get(token.term) ?? 'unknown',
                frequencyBand:
                  entriesToBand(freqMaps.get(token.term) ?? [], bandOpts) ?? 'none',
              },
        ),
      );
    }
    return resolved;
  } catch {
    return tokenMap;
  }
}
