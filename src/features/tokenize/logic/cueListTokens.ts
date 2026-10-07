import type { BilingualCue } from '@/entities/media';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { getWordStatuses } from '@/features/dictionary';
import { getFrequencyEntries } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import {
  DEFAULT_BAND_THRESHOLDS,
  entriesToBand,
  loadFrequencyBandOptions,
  pickBestFrequencyEntry,
  pickFrequencyReading,
  type FrequencyBandOptions,
  type FrequencyBandThresholds,
} from '@/features/tokenize/utils/frequencyBand';
import {
  applyTokenListStatus,
  createTokenList,
} from '@/features/tokenize/logic/tokenListMetadata';

export type CueListTokenMap = ReadonlyMap<number, readonly Token[]>;

export interface ResolveMeta {
  readonly resolved: boolean;
  readonly failed: boolean;
  readonly freqUnfiltered: boolean;
  readonly rankByTerm: ReadonlyMap<string, number | null>;
  readonly thresholds: FrequencyBandThresholds;
}

export interface ResolvedCueListTokens {
  readonly map: CueListTokenMap;
  readonly meta: ResolveMeta;
}

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

const MAX_TERMS_PER_REQUEST = 1000;
const MAX_TERM_LENGTH = 200;

async function fetchTermsChunked<T>(
  langCode: string,
  terms: readonly string[],
  fetch: (langCode: string, terms: readonly string[]) => Promise<Map<string, T>>,
): Promise<Map<string, T>> {
  const merged = new Map<string, T>();
  for (let i = 0; i < terms.length; i += MAX_TERMS_PER_REQUEST) {
    const batch = await fetch(langCode, terms.slice(i, i + MAX_TERMS_PER_REQUEST));
    for (const [term, value] of batch) merged.set(term, value);
  }
  return merged;
}

export async function resolveCueListTokenMetadata(
  tokenMap: CueListTokenMap,
  langCode: string,
  options?: { readonly includeReadings?: boolean },
): Promise<ResolvedCueListTokens> {
  const terms = new Set<string>();
  for (const tokens of tokenMap.values()) {
    for (const token of tokens) {
      if (!token.isSeparator) terms.add(token.term);
    }
  }
  const termList = [...terms].filter((t) => t.length > 0 && t.length <= MAX_TERM_LENGTH);
  if (termList.length === 0) {
    return {
      map: tokenMap,
      meta: {
        resolved: true,
        failed: false,
        freqUnfiltered: false,
        rankByTerm: new Map(),
        thresholds: DEFAULT_BAND_THRESHOLDS,
      },
    };
  }

  const [statusRes, freqRes, bandRes, readingsRes] = await Promise.allSettled([
    fetchTermsChunked(langCode, termList, getWordStatuses),
    fetchTermsChunked(langCode, termList, getFrequencyEntries),
    loadFrequencyBandOptions(langCode),
    options?.includeReadings
      ? fetchTermsChunked(langCode, termList, getReadings)
      : Promise.resolve(null),
  ]);

  const statusMap =
    statusRes.status === 'fulfilled' && statusRes.value.size > 0 ? statusRes.value : null;
  const failed = statusMap === null;
  const freqMaps =
    freqRes.status === 'fulfilled' ? freqRes.value : new Map<string, FrequencyEntry[]>();
  const freqFailed = freqRes.status === 'rejected' || freqMaps.size === 0;
  const bandOpts: FrequencyBandOptions =
    bandRes.status === 'fulfilled'
      ? bandRes.value
      : { thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] };
  const freqUnfiltered =
    bandOpts.resourcePriority.length === 0 || freqFailed || bandRes.status === 'rejected';

  const rankByTerm = new Map<string, number | null>();
  for (const term of termList) {
    const entries = freqMaps.get(term) ?? [];
    const enabled = entries.filter((e) => bandOpts.resourcePriority.includes(e.resourceId));
    rankByTerm.set(term, pickBestFrequencyEntry(enabled)?.frequency ?? null);
  }

  // null = reading fetch skipped (toggle off) or failed → keep existing
  // readings; a resolved map is authoritative, frequency rows as fallback.
  const dictReadings =
    readingsRes.status === 'fulfilled' ? readingsRes.value : null;

  const resolved = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of tokenMap) {
    resolved.set(
      cueIndex,
      tokens.map((token) => {
        if (token.isSeparator) return token;
        const freqEntries = freqMaps.get(token.term) ?? [];
        return {
          ...token,
          status: statusMap ? (statusMap.get(token.term) ?? 'unknown') : token.status,
          frequencyBand: entriesToBand(freqEntries, bandOpts),
          reading: dictReadings
            ? dictReadings.get(token.term) ?? pickFrequencyReading(token.term, freqEntries)
            : token.reading,
        };
      }),
    );
  }

  return {
    map: resolved,
    meta: {
      resolved: true,
      failed,
      freqUnfiltered,
      rankByTerm,
      thresholds: bandOpts.thresholds,
    },
  };
}
