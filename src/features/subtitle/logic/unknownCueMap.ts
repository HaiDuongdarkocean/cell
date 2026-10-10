import type { SrtCue } from '@/entities/media';
import type { CueBandProbe, UnknownLevel, UnknownCueHit } from '@/entities/studyMode';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import {
  createTokenList,
  applyTokenListStatus,
  loadFrequencyBandOptions,
  pickBestFrequencyEntry,
  DEFAULT_BAND_THRESHOLDS,
  type FrequencyBandThresholds,
  type Token,
} from '@/features/tokenize';
import { getWordStatuses, getFrequencyEntries, isNotKnown } from '@/features/dictionary';
import { cueDifficultyMap, cueHeatBand, type CueDifficulty } from './cueDifficulty';

export interface UnknownCueResolver {
  readonly probe: (cueIndex: number) => UnknownCueHit | null;
  readonly bandProbe: CueBandProbe;
  readonly applyStatus: (term: string, status: WordStatus) => void;
  readonly destroy: () => void;
}

type CueTokens = ReadonlyMap<number, readonly Token[]>;
type FreqByTerm = ReadonlyMap<string, readonly FrequencyEntry[]>;

const LEVEL_THRESHOLD: Record<UnknownLevel, keyof FrequencyBandThresholds> = {
  core: 'core',
  common: 'common',
  general: 'general',
  advanced: 'advanced',
};

interface FreqContext {
  readonly thresholds: FrequencyBandThresholds;
  readonly resourcePriority: readonly number[];
  readonly byTerm: FreqByTerm;
  /** No enabled frequency resource → levels can't gate; every learnable
   *  word pauses (graceful fallback so the feature still works for users
   *  without an imported frequency list). */
  readonly unfiltered: boolean;
}

function bestRank(term: string, freq: FreqContext): number | null {
  const entries = freq.byTerm.get(term);
  if (!entries || entries.length === 0) return null;
  const enabled = entries.filter((e) => freq.resourcePriority.includes(e.resourceId));
  return pickBestFrequencyEntry(enabled)?.frequency ?? null;
}

function firstPausableToken(
  tokens: readonly Token[],
  level: UnknownLevel,
  freq: FreqContext,
): Token | null {
  const maxRank = freq.thresholds[LEVEL_THRESHOLD[level]];
  for (const token of tokens) {
    if (token.isSeparator) continue;
    if (!token.status || !isNotKnown(token.status)) continue;
    if (freq.unfiltered) return token;
    const rank = bestRank(token.term, freq);
    if (rank === null || rank <= 0 || rank > maxRank) continue;
    return token;
  }
  return null;
}

function toUnknownMap(
  tokenMap: CueTokens,
  level: UnknownLevel,
  freq: FreqContext,
): Map<number, UnknownCueHit> {
  const map = new Map<number, UnknownCueHit>();
  for (const [cueIndex, tokens] of tokenMap) {
    const token = firstPausableToken(tokens, level, freq);
    if (token !== null) map.set(cueIndex, { term: token.term, offset: token.start });
  }
  return map;
}

function toBandMap(tokenMap: CueTokens): Map<number, CueDifficulty> {
  return cueDifficultyMap(tokenMap);
}

export async function createUnknownCueResolver(
  cues: readonly SrtCue[],
  langCode: string,
  level: UnknownLevel,
): Promise<UnknownCueResolver> {
  let tokenMap = new Map<number, readonly Token[]>();
  cues.forEach((cue, i) => {
    tokenMap.set(i, createTokenList(cue.text, langCode));
  });

  const terms = new Set<string>();
  for (const tokens of tokenMap.values()) {
    for (const token of tokens) {
      if (!token.isSeparator) terms.add(token.term);
    }
  }

  let freq: FreqContext = {
    thresholds: DEFAULT_BAND_THRESHOLDS,
    resourcePriority: [],
    byTerm: new Map(),
    unfiltered: true,
  };
  if (terms.size > 0) {
    const termList = [...terms];
    try {
      const [statusMap, freqMaps, bandOptions] = await Promise.all([
        getWordStatuses(langCode, termList),
        getFrequencyEntries(langCode, termList),
        loadFrequencyBandOptions(langCode),
      ]);
      freq = {
        byTerm: freqMaps,
        thresholds: bandOptions.thresholds,
        resourcePriority: bandOptions.resourcePriority,
        unfiltered: bandOptions.resourcePriority.length === 0,
      };
      const resolved = new Map<number, readonly Token[]>();
      for (const [cueIndex, tokens] of tokenMap) {
        resolved.set(
          cueIndex,
          tokens.map((token) =>
            token.isSeparator
              ? token
              : { ...token, status: statusMap.get(token.term) ?? 'unknown' },
          ),
        );
      }
      tokenMap = resolved;
    } catch {
      // Metadata unavailable (e.g. no resources) — tokens stay 'unknown'
      // and freq.unfiltered remains true, so pauses still work.
    }
  }

  let unknownMap: Map<number, UnknownCueHit> = toUnknownMap(tokenMap, level, freq);
  let bandMap: Map<number, CueDifficulty> = toBandMap(tokenMap);

  return {
    probe: (cueIndex) => unknownMap.get(cueIndex) ?? null,

    bandProbe: (cueIndex) => {
      const d = bandMap.get(cueIndex);
      return d ? cueHeatBand(d) : null;
    },

    applyStatus: (term, status) => {
      const normalized = langCode === 'zh' ? term : term.toLowerCase();
      let changed = false;
      const next = new Map<number, readonly Token[]>();
      for (const [cueIndex, tokens] of tokenMap) {
        const updated = applyTokenListStatus(tokens, normalized, status);
        if (updated !== tokens) changed = true;
        next.set(cueIndex, updated);
      }
      if (!changed) return;
      tokenMap = next;
      unknownMap = toUnknownMap(tokenMap, level, freq);
      bandMap = toBandMap(tokenMap);
    },

    destroy: () => {
      tokenMap = new Map();
      unknownMap = new Map();
      bandMap = new Map();
      freq = { ...freq, byTerm: new Map() };
    },
  };
}
