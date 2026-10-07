import { describe, expect, it } from '@jest/globals';
import type { Token, CueListTokenMap } from '@/features/tokenize';
import {
  CUE_FILTER_MODES,
  countByMode,
  cueDifficultyMap,
  cueHeatBand,
  cueMatchesMode,
  isCueFilterMode,
  type CueDifficulty,
} from './cueDifficulty';

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

    reading: undefined,
  };
}

function cueMap(entries: Record<number, Token[]>): CueListTokenMap {
  return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v]));
}

describe('cueDifficultyMap', () => {
  it('counts every unknown and tracking token — what you see is what counts', () => {
    const map = cueMap({
      1: [token('cat', 'unknown'), token('dog', 'tracking'), token('hat', 'known')],
    });

    expect(cueDifficultyMap(map).get(1)).toEqual({ unknown: 1, tracking: 1 });
  });

  it('counts words without frequency data — an unranked word is still a new word', () => {
    const map = cueMap({
      1: [
        { ...token('rare', 'unknown'), frequencyBand: 'rare' },
        token('gone', 'tracking'),
        token('ok', 'known'),
      ],
    });

    expect(cueDifficultyMap(map).get(1)).toEqual({ unknown: 1, tracking: 1 });
  });

  it('skips separators and tokens without a resolved status', () => {
    const map = cueMap({
      1: [token(' ', 'unknown', true), token('word', undefined), token('cat', 'unknown')],
    });

    expect(cueDifficultyMap(map).get(1)).toEqual({ unknown: 1, tracking: 0 });
  });

  it('produces an entry per cue including empty cues', () => {
    const map = cueMap({ 1: [], 2: [token('cat', 'ignore')] });

    expect(cueDifficultyMap(map).get(1)).toEqual({ unknown: 0, tracking: 0 });
    expect(cueDifficultyMap(map).get(2)).toEqual({ unknown: 0, tracking: 0 });
  });
});

describe('cueMatchesMode', () => {
  const cases: [CueDifficulty, Parameters<typeof cueMatchesMode>[1], boolean][] = [
    [{ unknown: 0, tracking: 0 }, 'all', true],
    [{ unknown: 1, tracking: 0 }, 'i1', true],
    [{ unknown: 0, tracking: 1 }, 'i1', true],
    [{ unknown: 1, tracking: 1 }, 'i1', false],
    [{ unknown: 1, tracking: 2 }, 'i1', false],
    [{ unknown: 2, tracking: 0 }, 'i1', false],
    [{ unknown: 0, tracking: 2 }, 'i1', false],
    [{ unknown: 0, tracking: 0 }, 'i1', false],
    [{ unknown: 1, tracking: 0 }, 'hasUnknown', true],
    [{ unknown: 0, tracking: 1 }, 'hasUnknown', false],
    [{ unknown: 0, tracking: 0 }, 'hasUnknown', false],
    [{ unknown: 0, tracking: 0 }, 'allKnown', true],
    [{ unknown: 0, tracking: 1 }, 'allKnown', false],
    [{ unknown: 1, tracking: 0 }, 'allKnown', false],
    [{ unknown: 1, tracking: 1 }, 'tracking', true],
    [{ unknown: 0, tracking: 1 }, 'tracking', true],
    [{ unknown: 1, tracking: 0 }, 'tracking', false],
  ];

  it.each(cases)('%o matches %s → %s', (d, mode, expected) => {
    expect(cueMatchesMode(d, mode)).toBe(expected);
  });
});

describe('countByMode', () => {
  it('counts every mode in one pass', () => {
    const difficulties = new Map<number, CueDifficulty>([
      [1, { unknown: 0, tracking: 0 }],
      [2, { unknown: 1, tracking: 0 }],
      [3, { unknown: 2, tracking: 1 }],
      [4, { unknown: 4, tracking: 1 }],
      [5, { unknown: 0, tracking: 1 }],
    ]);

    expect(countByMode(difficulties)).toEqual({
      all: 5,
      i1: 2,
      hasUnknown: 3,
      allKnown: 1,
      tracking: 3,
    });
  });
});

describe('cueHeatBand', () => {
  it('maps counts to bands — i1 means exactly one new word (unknown or tracking)', () => {
    expect(cueHeatBand({ unknown: 0, tracking: 0 })).toBe('easy');
    expect(cueHeatBand({ unknown: 1, tracking: 0 })).toBe('i1');
    expect(cueHeatBand({ unknown: 0, tracking: 1 })).toBe('i1');
    expect(cueHeatBand({ unknown: 2, tracking: 0 })).toBe('dense');
    expect(cueHeatBand({ unknown: 1, tracking: 1 })).toBe('dense');
    expect(cueHeatBand({ unknown: 0, tracking: 2 })).toBe('dense');
    expect(cueHeatBand({ unknown: 10, tracking: 4 })).toBe('dense');
  });
});

describe('isCueFilterMode', () => {
  it('accepts known modes and rejects anything else', () => {
    for (const mode of CUE_FILTER_MODES) expect(isCueFilterMode(mode)).toBe(true);
    for (const bad of ['xyz', '', 'I1', 'dense', 0, null, undefined, {}]) {
      expect(isCueFilterMode(bad)).toBe(false);
    }
  });
});
