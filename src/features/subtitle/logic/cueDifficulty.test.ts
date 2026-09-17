import { describe, expect, it } from '@jest/globals';
import type { Token, CueListTokenMap } from '@/features/tokenize';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import {
  CUE_FILTER_MODES,
  countByMode,
  cueDifficultyMap,
  cueMatchesMode,
  isCueFilterMode,
  type CueDifficulty,
} from './cueDifficulty';

const THRESHOLDS: FrequencyBandThresholds = {
  core: 10,
  common: 20,
  general: 30,
  advanced: 40,
};

function token(
  term: string,
  status: Token['status'],
  isSeparator = false,
): Token {
  return {
    text: term,
    term,
    start: 0,
    end: term.length,
    isSeparator,
    sentenceIndex: 0,
    status,
    frequencyBand: undefined,
  };
}

function cueMap(entries: Record<number, Token[]>): CueListTokenMap {
  return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v]));
}

function ranks(entries: Record<string, number | null>): ReadonlyMap<string, number | null> {
  return new Map(Object.entries(entries));
}

describe('cueDifficultyMap', () => {
  it('counts unknown and tracking tokens within the level rank gate', () => {
    const map = cueMap({
      1: [token('cat', 'unknown'), token('dog', 'tracking'), token('hat', 'known')],
    });
    const rankByTerm = ranks({ cat: 5, dog: 15, hat: 5 });

    const d = cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'common', false).get(1);

    expect(d).toEqual({ strange: 2, tracking: 1 });
  });

  it('gates by the selected level threshold', () => {
    const map = cueMap({ 1: [token('cat', 'unknown')] });
    const rankByTerm = ranks({ cat: 15 });

    expect(cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'core', false).get(1)?.strange).toBe(0);
    expect(cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'common', false).get(1)?.strange).toBe(1);
    expect(cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'general', false).get(1)?.strange).toBe(1);
    expect(cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'advanced', false).get(1)?.strange).toBe(1);
  });

  it('excludes rank 0, null, and missing terms', () => {
    const map = cueMap({
      1: [token('zero', 'unknown'), token('none', 'unknown'), token('gone', 'tracking')],
    });
    const rankByTerm = ranks({ zero: 0, none: null });

    const d = cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'advanced', false).get(1);

    expect(d).toEqual({ strange: 0, tracking: 0 });
  });

  it('counts every unknown/tracking token when freqUnfiltered', () => {
    const map = cueMap({
      1: [token('cat', 'unknown'), token('dog', 'tracking'), token('hat', 'known')],
    });

    const d = cueDifficultyMap(map, ranks({}), THRESHOLDS, 'core', true).get(1);

    expect(d).toEqual({ strange: 2, tracking: 1 });
  });

  it('skips separators and tokens without a resolved status', () => {
    const map = cueMap({
      1: [token(' ', 'unknown', true), token('word', undefined), token('cat', 'unknown')],
    });
    const rankByTerm = ranks({ cat: 5, word: 5 });

    const d = cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'common', false).get(1);

    expect(d).toEqual({ strange: 1, tracking: 0 });
  });

  it('divergence: a term absent from enabled resources is not counted even though frequencyBand may show a band', () => {
    const map = cueMap({ 1: [{ ...token('rare', 'unknown'), frequencyBand: 'common' }] });
    const rankByTerm = ranks({});

    const d = cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'advanced', false).get(1);

    expect(d).toEqual({ strange: 0, tracking: 0 });
  });

  it('counts tracking only when the token also passes the rank gate', () => {
    const map = cueMap({
      1: [token('near', 'tracking'), token('far', 'tracking'), token('way', 'unknown')],
    });
    const rankByTerm = ranks({ near: 5, far: 99, way: 5 });

    const d = cueDifficultyMap(map, rankByTerm, THRESHOLDS, 'common', false).get(1);

    expect(d).toEqual({ strange: 2, tracking: 1 });
  });
});

describe('cueMatchesMode', () => {
  const cases: [CueDifficulty, Parameters<typeof cueMatchesMode>[1], boolean][] = [
    [{ strange: 0, tracking: 0 }, 'all', true],
    [{ strange: 1, tracking: 0 }, 'i1', true],
    [{ strange: 2, tracking: 2 }, 'i1', true],
    [{ strange: 3, tracking: 0 }, 'i1', false],
    [{ strange: 0, tracking: 0 }, 'i1', false],
    [{ strange: 1, tracking: 0 }, 'hasUnknown', true],
    [{ strange: 0, tracking: 0 }, 'hasUnknown', false],
    [{ strange: 0, tracking: 0 }, 'allKnown', true],
    [{ strange: 1, tracking: 0 }, 'allKnown', false],
    [{ strange: 3, tracking: 0 }, 'dense', true],
    [{ strange: 2, tracking: 0 }, 'dense', false],
    [{ strange: 1, tracking: 1 }, 'tracking', true],
    [{ strange: 1, tracking: 0 }, 'tracking', false],
  ];

  it.each(cases)('%o matches %s → %s', (d, mode, expected) => {
    expect(cueMatchesMode(d, mode)).toBe(expected);
  });
});

describe('countByMode', () => {
  it('counts every mode in one pass', () => {
    const difficulties = new Map<number, CueDifficulty>([
      [1, { strange: 0, tracking: 0 }],
      [2, { strange: 1, tracking: 0 }],
      [3, { strange: 2, tracking: 1 }],
      [4, { strange: 4, tracking: 1 }],
    ]);

    expect(countByMode(difficulties)).toEqual({
      all: 4,
      i1: 2,
      hasUnknown: 3,
      allKnown: 1,
      dense: 1,
      tracking: 2,
    });
  });
});

describe('isCueFilterMode', () => {
  it('accepts known modes and rejects anything else', () => {
    for (const mode of CUE_FILTER_MODES) expect(isCueFilterMode(mode)).toBe(true);
    for (const bad of ['xyz', '', 'I1', 0, null, undefined, {}]) {
      expect(isCueFilterMode(bad)).toBe(false);
    }
  });
});
