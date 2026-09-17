import type { CueListTokenMap } from '@/features/tokenize';
import type { UnknownLevel } from '@/entities/studyMode';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';

export type CueFilterMode = 'all' | 'i1' | 'hasUnknown' | 'allKnown' | 'dense' | 'tracking';

export const CUE_FILTER_MODES: readonly CueFilterMode[] = [
  'all',
  'i1',
  'hasUnknown',
  'allKnown',
  'dense',
  'tracking',
];

export function isCueFilterMode(value: unknown): value is CueFilterMode {
  return typeof value === 'string' && (CUE_FILTER_MODES as readonly string[]).includes(value);
}

export interface CueDifficulty {
  readonly strange: number;
  readonly tracking: number;
}

const LEVEL_THRESHOLD: Record<UnknownLevel, keyof FrequencyBandThresholds> = {
  core: 'core',
  common: 'common',
  general: 'general',
  advanced: 'advanced',
};

export function cueDifficultyMap(
  tokenMap: CueListTokenMap,
  rankByTerm: ReadonlyMap<string, number | null>,
  thresholds: FrequencyBandThresholds,
  level: UnknownLevel,
  freqUnfiltered: boolean,
): Map<number, CueDifficulty> {
  const maxRank = thresholds[LEVEL_THRESHOLD[level]];
  const map = new Map<number, CueDifficulty>();
  for (const [cueIndex, tokens] of tokenMap) {
    let strange = 0;
    let tracking = 0;
    for (const token of tokens) {
      if (token.isSeparator) continue;
      const status = token.status;
      if (status !== 'unknown' && status !== 'tracking') continue;
      if (!freqUnfiltered) {
        const rank = rankByTerm.get(token.term);
        if (rank === null || rank === undefined || rank <= 0 || rank > maxRank) continue;
      }
      strange += 1;
      if (status === 'tracking') tracking += 1;
    }
    map.set(cueIndex, { strange, tracking });
  }
  return map;
}

export function cueMatchesMode(d: CueDifficulty, mode: CueFilterMode): boolean {
  switch (mode) {
    case 'all':
      return true;
    case 'i1':
      return d.strange >= 1 && d.strange <= 2;
    case 'hasUnknown':
      return d.strange >= 1;
    case 'allKnown':
      return d.strange === 0;
    case 'dense':
      return d.strange >= 3;
    case 'tracking':
      return d.tracking >= 1;
  }
}

export function countByMode(
  difficulties: ReadonlyMap<number, CueDifficulty>,
): Record<CueFilterMode, number> {
  const counts: Record<CueFilterMode, number> = {
    all: 0,
    i1: 0,
    hasUnknown: 0,
    allKnown: 0,
    dense: 0,
    tracking: 0,
  };
  for (const d of difficulties.values()) {
    for (const mode of CUE_FILTER_MODES) {
      if (cueMatchesMode(d, mode)) counts[mode] += 1;
    }
  }
  return counts;
}
