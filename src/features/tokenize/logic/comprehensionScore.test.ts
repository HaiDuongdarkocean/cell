import { describe, expect, it } from '@jest/globals';
import type { Token } from '@/features/tokenize/types';
import type { WordStatus } from '@/entities/dictionary';
import {
  bandForCoverage,
  computeStats,
  createScoreTracker,
} from './comprehensionScore';

function tok(term: string, status?: WordStatus, isSeparator = false): Token {
  return { text: term, term, start: 0, end: term.length, isSeparator, sentenceIndex: 0, status, frequencyBand: undefined, reading: undefined };
}

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
