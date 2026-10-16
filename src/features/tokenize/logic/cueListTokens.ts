import type { BilingualCue } from '@/entities/media';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { Token } from '@/features/tokenize/types';
import { getTokenizeMeta } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import { getWordTranslations } from '@/features/translate';
import { getSrsCardTermSet } from '@/features/srs';
import {
  DEFAULT_BAND_THRESHOLDS,
  entriesToBand,
  loadFrequencyBandOptions,
  pickBestFrequencyEntry,
  pickFrequencyReading,
  type FrequencyBandOptions,
  type FrequencyBandThresholds,
} from '@/features/tokenize/utils/frequencyBand';
import { warmEspeakIpa } from '@/features/pronunciation';
import { resolveEspeakReadings } from './espeakReadings';
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

export function applyCueListCardFlags(
  tokenMap: CueListTokenMap,
  cardTerms: ReadonlySet<string>,
): CueListTokenMap {
  let changed = false;
  const resolved = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of tokenMap) {
    const nextTokens = tokens.map((token) => {
      if (token.isSeparator) return token;
      const hasCard = cardTerms.has(token.term);
      if ((token.hasCard ?? false) === hasCard) return token;
      changed = true;
      return { ...token, hasCard };
    });
    resolved.set(cueIndex, nextTokens);
  }
  return changed ? resolved : tokenMap;
}

export function applyCueListTokenStatuses(
  tokenMap: CueListTokenMap,
  statuses: ReadonlyMap<string, WordStatus>,
): CueListTokenMap {
  if (statuses.size === 0) return tokenMap;
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

export interface CueListResolveCache {
  readonly seenBase: Set<string>;
  readonly statuses: Map<string, WordStatus>;
  readonly freqEntries: Map<string, FrequencyEntry[]>;
  readonly seenReadings: Set<string>;
  readonly readings: Map<string, string>;
  readonly seenGlosses: Set<string>;
  readonly glosses: Map<string, string>;
  /** Shared in-flight/resolved band-options load so the first resolve burst
   *  issues one settings+resources round-trip. Reset to null on rejection
   *  so the next resolve retries. */
  bandOpts: Promise<FrequencyBandOptions> | null;
}

export function createCueListResolveCache(): CueListResolveCache {
  return {
    seenBase: new Set(),
    statuses: new Map(),
    freqEntries: new Map(),
    seenReadings: new Set(),
    readings: new Map(),
    seenGlosses: new Set(),
    glosses: new Map(),
    bandOpts: null,
  };
}

export async function resolveCueListTokenMetadata(
  tokenMap: CueListTokenMap,
  langCode: string,
  options?: {
    readonly includeReadings?: boolean;
    readonly includeGlosses?: boolean;
    readonly glossTargetLanguage?: string;
    readonly cache?: CueListResolveCache;
  },
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

  const cache = options?.cache;
  const baseTerms = cache ? termList.filter((t) => !cache.seenBase.has(t)) : termList;
  const readingTerms = cache
    ? termList.filter((t) => !cache.seenReadings.has(t))
    : termList;
  const glossTerms = cache
    ? termList.filter((t) => !cache.seenGlosses.has(t))
    : termList;
  const wantReadings = Boolean(options?.includeReadings);
  const wantGlosses = Boolean(options?.includeGlosses && options.glossTargetLanguage);
  if (wantReadings) warmEspeakIpa(langCode);

  let bandOptsPromise: Promise<FrequencyBandOptions>;
  if (cache) {
    if (!cache.bandOpts) {
      cache.bandOpts = loadFrequencyBandOptions(langCode).catch((err) => {
        cache.bandOpts = null;
        throw err;
      });
    }
    bandOptsPromise = cache.bandOpts;
  } else {
    bandOptsPromise = loadFrequencyBandOptions(langCode);
  }

  const [metaRes, bandRes, readingsRes, glossesRes, cardTermsRes] = await Promise.allSettled([
    baseTerms.length > 0
      ? getTokenizeMeta(langCode, baseTerms)
      : Promise.resolve({ statuses: new Map<string, WordStatus>(), frequencyEntries: new Map<string, FrequencyEntry[]>() }),
    bandOptsPromise,
    wantReadings && readingTerms.length > 0
      ? fetchTermsChunked(langCode, readingTerms, getReadings)
      : Promise.resolve(null),
    wantGlosses && glossTerms.length > 0 && options?.glossTargetLanguage
      ? getWordTranslations(langCode, options.glossTargetLanguage, glossTerms)
      : Promise.resolve(null),
    getSrsCardTermSet(langCode),
  ]);

  const statusRes: PromiseSettledResult<Map<string, WordStatus>> =
    metaRes.status === 'fulfilled' ? { status: 'fulfilled', value: metaRes.value.statuses } : metaRes;
  const freqRes: PromiseSettledResult<Map<string, FrequencyEntry[]>> =
    metaRes.status === 'fulfilled' ? { status: 'fulfilled', value: metaRes.value.frequencyEntries } : metaRes;

  const statusFresh =
    statusRes.status === 'fulfilled' ? statusRes.value : new Map<string, WordStatus>();
  const freqFresh =
    freqRes.status === 'fulfilled' ? freqRes.value : new Map<string, FrequencyEntry[]>();
  const readingsFresh =
    readingsRes.status === 'fulfilled' ? readingsRes.value : null;
  const glossesFresh =
    glossesRes.status === 'fulfilled' ? glossesRes.value : null;
  // null = card-term fetch failed → keep existing flags rather than flicker.
  const cardTerms =
    cardTermsRes.status === 'fulfilled' ? cardTermsRes.value : null;

  let statusMap: Map<string, WordStatus>;
  let freqMaps: Map<string, FrequencyEntry[]>;
  let dictReadings: Map<string, string> | null;
  let dictGlosses: Map<string, string> | null;
  if (cache) {
    if (statusRes.status === 'fulfilled' && freqRes.status === 'fulfilled') {
      for (const term of baseTerms) cache.seenBase.add(term);
    }
    if (statusRes.status === 'fulfilled') {
      for (const [term, value] of statusFresh) cache.statuses.set(term, value);
    }
    for (const [term, value] of freqFresh) cache.freqEntries.set(term, value);
    if (wantReadings && readingsRes.status === 'fulfilled') {
      for (const term of readingTerms) cache.seenReadings.add(term);
      if (readingsFresh) for (const [term, value] of readingsFresh) cache.readings.set(term, value);
    }
    if (wantGlosses && glossesRes.status === 'fulfilled') {
      for (const term of glossTerms) cache.seenGlosses.add(term);
      if (glossesFresh) for (const [term, value] of glossesFresh) cache.glosses.set(term, value);
    }
    statusMap = cache.statuses;
    freqMaps = cache.freqEntries;
    dictReadings = wantReadings ? cache.readings : null;
    dictGlosses = wantGlosses ? cache.glosses : null;
  } else {
    statusMap = statusFresh;
    freqMaps = freqFresh;
    dictReadings = readingsFresh;
    dictGlosses = glossesFresh;
  }

  const failed = statusRes.status === 'rejected' || (statusRes.status === 'fulfilled' && statusFresh.size === 0 && statusMap.size === 0);
  const freqFailed =
    freqRes.status === 'rejected' || (baseTerms.length > 0 && freqFresh.size === 0 && freqMaps.size === 0);
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

  const espeakReadings = dictReadings
    ? await resolveEspeakReadings(
        langCode,
        termList,
        (term) => dictReadings.get(term) ?? pickFrequencyReading(term, freqMaps.get(term) ?? []),
      )
    : null;

  const resolved = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of tokenMap) {
    resolved.set(
      cueIndex,
      tokens.map((token) => {
        if (token.isSeparator) return token;
        const freqEntries = freqMaps.get(token.term) ?? [];
        return {
          ...token,
          status: failed ? token.status : (statusMap.get(token.term) ?? 'unknown'),
          frequencyBand: entriesToBand(freqEntries, bandOpts),
          reading: dictReadings
            ? dictReadings.get(token.term)
                ?? pickFrequencyReading(token.term, freqEntries)
                ?? espeakReadings?.get(token.term)
            : token.reading,
          gloss: dictGlosses ? dictGlosses.get(token.term) : token.gloss,
          hasCard: cardTerms ? cardTerms.has(token.term) : token.hasCard,
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
