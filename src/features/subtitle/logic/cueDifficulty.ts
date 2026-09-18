import type { CueListTokenMap } from '@/features/tokenize';

export type CueFilterMode = 'all' | 'i1' | 'hasUnknown' | 'allKnown' | 'tracking';

export const CUE_FILTER_MODES: readonly CueFilterMode[] = [
  'i1',
  'hasUnknown',
  'tracking',
  'allKnown',
  'all',
];

export function isCueFilterMode(value: unknown): value is CueFilterMode {
  return typeof value === 'string' && (CUE_FILTER_MODES as readonly string[]).includes(value);
}

export interface CueDifficulty {
  readonly unknown: number;
  readonly tracking: number;
}

export function cueDifficultyMap(tokenMap: CueListTokenMap): Map<number, CueDifficulty> {
  const map = new Map<number, CueDifficulty>();
  for (const [cueIndex, tokens] of tokenMap) {
    let unknown = 0;
    let tracking = 0;
    for (const token of tokens) {
      if (token.isSeparator) continue;
      if (token.status === 'unknown') unknown += 1;
      else if (token.status === 'tracking') tracking += 1;
    }
    map.set(cueIndex, { unknown, tracking });
  }
  return map;
}

export function cueMatchesMode(d: CueDifficulty, mode: CueFilterMode): boolean {
  switch (mode) {
    case 'all':
      return true;
    case 'i1':
      return d.unknown + d.tracking === 1;
    case 'hasUnknown':
      return d.unknown >= 1;
    case 'allKnown':
      return d.unknown === 0 && d.tracking === 0;
    case 'tracking':
      return d.tracking >= 1;
  }
}

export type CueHeatBand = 'easy' | 'i1' | 'dense';

export function cueHeatBand(d: CueDifficulty): CueHeatBand {
  if (d.unknown === 0 && d.tracking === 0) return 'easy';
  if (d.unknown + d.tracking === 1) return 'i1';
  return 'dense';
}

export function countByMode(
  difficulties: ReadonlyMap<number, CueDifficulty>,
): Record<CueFilterMode, number> {
  const counts: Record<CueFilterMode, number> = {
    all: 0,
    i1: 0,
    hasUnknown: 0,
    allKnown: 0,
    tracking: 0,
  };
  for (const d of difficulties.values()) {
    for (const mode of CUE_FILTER_MODES) {
      if (cueMatchesMode(d, mode)) counts[mode] += 1;
    }
  }
  return counts;
}
