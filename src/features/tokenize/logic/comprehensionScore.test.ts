import { describe, expect, it } from '@jest/globals';
import type { Token, TokenBlock } from '@/features/tokenize/types';
import type { WordStatus } from '@/entities/dictionary';
import {
  bandForCoverage,
  computeStats,
  createScoreTracker,
  markIPlus1Tokens,
  markIPlus1TokensAcrossBlocks,
} from './comprehensionScore';

function tok(term: string, status?: WordStatus, isSeparator = false, sentenceIndex = 0): Token {
  return { text: term, term, start: 0, end: term.length, isSeparator, sentenceIndex, status, frequencyBand: undefined, reading: undefined };
}

function wtok(text: string, start: number, status?: WordStatus, sentenceIndex = 0): Token {
  return { text, term: text.toLowerCase(), start, end: start + text.length, isSeparator: false, sentenceIndex, status, frequencyBand: undefined, reading: undefined };
}

function blk(text: string, tokens: Token[]): TokenBlock {
  return {
    id: 'b',
    element: null as unknown as Element,
    sourceNodes: [],
    originalText: text,
    tokens,
    isBound: false,
    lastAccessedAt: 0,
  };
}

describe('markIPlus1Tokens', () => {
  it('marks the only new word of a sentence and leaves the rest unmarked', () => {
    const tokens = [
      tok('the', 'known'),
      tok('durian', 'unknown'),
      tok('tastes', 'known'),
      tok('aardvark', 'unknown', false, 1),
      tok('met', 'known', false, 1),
      tok('platypus', 'unknown', false, 1),
      tok('the', 'known', false, 2),
      tok('cat', 'known', false, 2),
    ];
    markIPlus1Tokens(tokens);
    expect(tokens.map((t) => t.iPlus1)).toEqual([false, true, false, false, false, false, false, false]);
  });

  it('treats tracking/learning as still-new gaps', () => {
    const tokens = [tok('the', 'known'), tok('tram', 'learning'), tok('stops', 'tracking', false, 1)];
    markIPlus1Tokens(tokens);
    expect(tokens.map((t) => t.iPlus1)).toEqual([false, true, true]);
  });

  it('ignores separators and pure numbers when counting gaps', () => {
    const tokens = [
      tok('the', 'known'),
      tok(' ', undefined, true),
      tok('71', 'unknown'),
      tok('languages', 'unknown'),
    ];
    markIPlus1Tokens(tokens);
    expect(tokens.map((t) => t.iPlus1)).toEqual([false, false, false, true]);
  });
});

describe('markIPlus1TokensAcrossBlocks', () => {
  it('counts gaps over the whole visual sentence split by inline elements', () => {
    // "The function body consists of a single <a>statement</a>, a call to the
    //  <code>printf</code> ..." — three new words in one rendered sentence,
    //  each alone inside its own text-node block. Per-block marking would paint
    //  three i+1 pills; the sentence has three gaps so none may be marked.
    const a = blk('The function body consists of a single ', [
      wtok('The', 0, 'known'),
      wtok('function', 4, 'unknown'),
      wtok('body', 13, 'known'),
      wtok('consists', 18, 'known'),
      wtok('of', 27, 'known'),
      wtok('a', 30, 'known'),
      wtok('single', 32, 'known'),
    ]);
    const b = blk('statement', [wtok('statement', 0, 'unknown')]);
    const c = blk(', a call to the ', [
      wtok('a', 2, 'known'),
      wtok('call', 4, 'known'),
      wtok('to', 9, 'known'),
      wtok('the', 12, 'known'),
    ]);
    const d = blk('printf', [wtok('printf', 0, 'unknown')]);
    markIPlus1TokensAcrossBlocks([a, b, c, d]);
    expect(a.tokens!.map((t) => t.iPlus1)).toEqual([false, false, false, false, false, false, false]);
    expect(b.tokens![0]!.iPlus1).toBe(false);
    expect(d.tokens![0]!.iPlus1).toBe(false);
  });

  it('marks the single gap when the split sentence has exactly one new word', () => {
    const a = blk('the cat ', [wtok('the', 0, 'known'), wtok('cat', 4, 'known')]);
    const b = blk('sat', [wtok('sat', 0, 'unknown')]);
    const c = blk(' down', [wtok('down', 1, 'known')]);
    markIPlus1TokensAcrossBlocks([a, b, c]);
    expect(a.tokens!.map((t) => t.iPlus1)).toEqual([false, false]);
    expect(b.tokens![0]!.iPlus1).toBe(true);
    expect(c.tokens![0]!.iPlus1).toBe(false);
  });

  it('closes the sentence when the previous block ends with a terminator', () => {
    const a = blk('I run.', [wtok('I', 0, 'known'), wtok('run', 2, 'unknown')]);
    const b = blk('He walks', [wtok('He', 0, 'known'), wtok('walks', 3, 'unknown')]);
    markIPlus1TokensAcrossBlocks([a, b]);
    expect(a.tokens![1]!.iPlus1).toBe(true);
    expect(b.tokens![1]!.iPlus1).toBe(true);
  });

  it('treats a separator-only block carrying the terminator as the boundary', () => {
    const a = blk('I run', [wtok('I', 0, 'known'), wtok('run', 2, 'unknown')]);
    const dot = blk('.', [{ text: '.', term: '.', start: 0, end: 1, isSeparator: true, sentenceIndex: 0, status: undefined, frequencyBand: undefined, reading: undefined }]);
    const b = blk(' He walks', [wtok('He', 1, 'known'), wtok('walks', 4, 'unknown')]);
    markIPlus1TokensAcrossBlocks([a, dot, b]);
    expect(a.tokens![1]!.iPlus1).toBe(true);
    expect(b.tokens![1]!.iPlus1).toBe(true);
  });

  it('detects the boundary when the next block starts with a terminator', () => {
    const a = blk('I run', [wtok('I', 0, 'known'), wtok('run', 2, 'unknown')]);
    const b = blk('. He walks', [wtok('He', 2, 'known', 1), wtok('walks', 5, 'unknown', 1)]);
    markIPlus1TokensAcrossBlocks([a, b]);
    expect(a.tokens![1]!.iPlus1).toBe(true);
    expect(b.tokens![1]!.iPlus1).toBe(true);
  });
});

describe('bandForCoverage', () => {
  it('media bands: >=95 comfortable, 90-<95 stretch, <90 hard', () => {
    expect(bandForCoverage(95, 'media')).toBe('comfortable');
    expect(bandForCoverage(100, 'media')).toBe('comfortable');
    expect(bandForCoverage(94.9, 'media')).toBe('stretch');
    expect(bandForCoverage(90, 'media')).toBe('stretch');
    expect(bandForCoverage(89.9, 'media')).toBe('hard');
    expect(bandForCoverage(0, 'media')).toBe('hard');
  });

  it('text bands: >=98 comfortable, 95-<98 stretch, <95 hard', () => {
    expect(bandForCoverage(98, 'text')).toBe('comfortable');
    expect(bandForCoverage(97.9, 'text')).toBe('stretch');
    expect(bandForCoverage(95, 'text')).toBe('stretch');
    expect(bandForCoverage(94.9, 'text')).toBe('hard');
  });
});

describe('computeStats', () => {
  it('counts running tokens by status, separators excluded', () => {
    const tokens = [
      tok('the', 'known'), tok(',', 'known', true), tok('cat', 'known'),
      tok('sat', 'unknown'), tok('on', 'tracking'),
      tok('the', 'known'),
    ];
    const s = computeStats(tokens, 'media');
    expect(s.totalTokens).toBe(5);
    expect(s.knownTokens).toBe(3);
    expect(s.trackingTokens).toBe(1);
    expect(s.unknownTokens).toBe(1);
  });

  it('coverage = (known + 0.5*tracking) / total, 1 decimal', () => {
    const tokens = [
      tok('a', 'known'), tok('b', 'known'), tok('c', 'known'),
      tok('d', 'known'), tok('e', 'known'), tok('f', 'known'),
      tok('g', 'known'), tok('h', 'known'), tok('i', 'known'),
      tok('j', 'tracking'),
    ];
    const s = computeStats(tokens, 'media');
    expect(s.coverage).toBe(95);
    expect(s.band).toBe('comfortable');
  });

  it('undefined status counts as unknown; ignore counts as known', () => {
    const tokens = [tok('a', 'ignore'), tok('b', undefined), tok('c', 'known')];
    const s = computeStats(tokens, 'media');
    expect(s.knownTokens).toBe(2);
    expect(s.unknownTokens).toBe(1);
    expect(s.coverage).toBe(66.7);
  });

  it('newTerms counts unique unknown+tracking terms', () => {
    const tokens = [
      tok('x', 'unknown'), tok('x', 'unknown'), tok('y', 'tracking'),
      tok('z', 'known'),
    ];
    expect(computeStats(tokens, 'media').newTerms).toBe(2);
  });

  it('empty / all-separator input → totalTokens 0, coverage 0', () => {
    const s = computeStats([tok(',', 'known', true)], 'text');
    expect(s.totalTokens).toBe(0);
    expect(s.coverage).toBe(0);
  });

  it('pure-numeric tokens excluded from totals and terms', () => {
    const tokens = [tok('a', 'known'), tok('2024'), tok('b', 'known'), tok('42')];
    const s = computeStats(tokens, 'media');
    expect(s.totalTokens).toBe(2);
    expect(s.coverage).toBe(100);
  });
});

describe('createScoreTracker', () => {
  const tokens = [tok('Hello', undefined), tok('world', undefined), tok('foo', undefined)];

  it('builds stats from token terms + status map (non-zh terms already lowercased by tokenizer)', () => {
    const tracker = createScoreTracker(
      [tok('hello'), tok('world'), tok('foo')],
      new Map<string, WordStatus>([['hello', 'known'], ['world', 'known']]),
      'en',
    );
    const s = tracker.stats('media');
    expect(s.knownTokens).toBe(2);
    expect(s.unknownTokens).toBe(1);
    expect(s.coverage).toBe(66.7);
  });

  it('applyStatus updates totals O(1) and returns true on change', () => {
    const tracker = createScoreTracker(
      [tok('hello'), tok('hello'), tok('world')],
      new Map([['hello', 'known']]),
      'en',
    );
    expect(tracker.stats('media').knownTokens).toBe(2);
    expect(tracker.applyStatus('world', 'known')).toBe(true);
    const s = tracker.stats('media');
    expect(s.knownTokens).toBe(3);
    expect(s.coverage).toBe(100);
    expect(s.newTerms).toBe(0);
  });

  it('applyStatus returns false for absent term or unchanged status', () => {
    const tracker = createScoreTracker(tokens, new Map([['hello', 'known']]), 'en');
    expect(tracker.applyStatus('absent', 'known')).toBe(false);
    expect(tracker.applyStatus('hello', 'known')).toBe(false);
  });

  it('applyStatus normalizes case for non-zh, keeps case for zh', () => {
    const en = createScoreTracker([tok('hello')], new Map(), 'en');
    expect(en.applyStatus('Hello', 'known')).toBe(true);

    const zh = createScoreTracker([tok('Nh')], new Map(), 'zh');
    expect(zh.applyStatus('nh', 'known')).toBe(false);
    expect(zh.applyStatus('Nh', 'known')).toBe(true);
  });
});
