import { describe, expect, it } from '@jest/globals';
import type { BilingualCue } from '@/entities/media';
import type { Token, CueListTokenMap } from '@/features/tokenize';
import { buildPrimerList } from './primerList';

function token(partial: Partial<Token> & Pick<Token, 'term' | 'start'>): Token {
  return {
    text: partial.term,
    end: partial.start + partial.term.length,
    isSeparator: false,
    sentenceIndex: 0,
    status: 'unknown',
    frequencyBand: 'general',
    ...partial,
  };
}

function cue(index: number, start: number, text: string): BilingualCue {
  return { index, start, end: start + 2000, targetText: text, nativeText: '' };
}

function mapOf(entries: [number, readonly Token[]][]): CueListTokenMap {
  return new Map(entries);
}

describe('buildPrimerList', () => {
  it('keeps only non-separator tokens with unknown/tracking status', () => {
    const tokens: Token[] = [
      token({ term: 'alpha', start: 0, status: 'unknown' }),
      token({ term: 'beta', start: 6, status: 'tracking' }),
      token({ term: 'gamma', start: 12, status: 'known' }),
      token({ term: 'delta', start: 18, status: 'ignore' }),
      token({ term: ' ', start: 23, isSeparator: true, status: undefined }),
    ];
    const rows = buildPrimerList(mapOf([[0, tokens]]), new Map(), [cue(0, 0, 'alpha beta gamma delta ')]);
    expect(rows.map((r) => r.term)).toEqual(['alpha', 'beta']);
  });

  it('counts occurrences and keeps the first occurrence context', () => {
    const map = mapOf([
      [0, [token({ term: 'alpha', start: 0 }), token({ term: 'beta', start: 6 })]],
      [1, [token({ term: 'beta', start: 0 }), token({ term: 'alpha', start: 5 })]],
      [2, [token({ term: 'alpha', start: 10 })]],
    ]);
    const cues = [cue(0, 0, 'alpha beta'), cue(1, 2000, 'beta alpha'), cue(2, 4000, 'x alpha y')];
    const rows = buildPrimerList(map, new Map(), cues);
    const alpha = rows.find((r) => r.term === 'alpha');
    const beta = rows.find((r) => r.term === 'beta');
    expect(alpha?.count).toBe(3);
    expect(alpha?.firstCueIndex).toBe(0);
    expect(alpha?.firstCueStartMs).toBe(0);
    expect(alpha?.contextText).toBe('alpha beta');
    expect(alpha?.firstTokenOffset).toBe(0);
    expect(beta?.count).toBe(2);
    expect(beta?.contextText).toBe('alpha beta');
    expect(beta?.firstTokenOffset).toBe(6);
  });

  it('sorts by rank asc, then count desc, then term asc; null ranks last', () => {
    const map = mapOf([
      [0, [
        token({ term: 'zz', start: 0 }),      // rank null
        token({ term: 'common', start: 3 }),  // rank 10
        token({ term: 'rare1', start: 10 }),  // rank 5000
        token({ term: 'aa', start: 16 }),     // rank null, count 2
        token({ term: 'aa', start: 19 }),     // rank null, count 2
        token({ term: 'core', start: 22 }),   // rank 5
      ]],
    ]);
    const rankByTerm = new Map<string, number | null>([
      ['common', 10],
      ['rare1', 5000],
      ['core', 5],
    ]);
    const rows = buildPrimerList(map, rankByTerm, [cue(0, 0, 'zz common rare1 aa aa core')]);
    expect(rows.map((r) => r.term)).toEqual(['core', 'common', 'rare1', 'aa', 'zz']);
  });

  it('orders all-null ranks by count desc then term asc (freqUnfiltered)', () => {
    const map = mapOf([
      [0, [
        token({ term: 'b', start: 0 }),
        token({ term: 'a', start: 2 }),
        token({ term: 'a', start: 4 }),
        token({ term: 'c', start: 6 }),
      ]],
    ]);
    const rows = buildPrimerList(map, new Map(), [cue(0, 0, 'b a a c')]);
    expect(rows.map((r) => r.term)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => r.rank === null)).toBe(true);
  });

  it('takes band from the first-occurrence token frequencyBand', () => {
    const map = mapOf([
      [0, [token({ term: 'w', start: 0, frequencyBand: 'core' })]],
      [1, [token({ term: 'w', start: 0, frequencyBand: 'rare' })]],
    ]);
    const rows = buildPrimerList(map, new Map(), [cue(0, 0, 'w'), cue(1, 1000, 'w')]);
    expect(rows[0]?.band).toBe('core');
  });

  it('defaults band to none when token has no frequencyBand', () => {
    const map = mapOf([[0, [token({ term: 'w', start: 0, frequencyBand: undefined })]]]);
    const rows = buildPrimerList(map, new Map(), [cue(0, 0, 'w')]);
    expect(rows[0]?.band).toBe('none');
  });

  it('resolves cue metadata by cue.index, not array position', () => {
    const map = mapOf([[42, [token({ term: 'w', start: 3 })]]]);
    const cues = [cue(10, 500, 'x'), cue(42, 9000, 'see w here')];
    const rows = buildPrimerList(map, new Map(), cues);
    expect(rows[0]?.firstCueIndex).toBe(42);
    expect(rows[0]?.firstCueStartMs).toBe(9000);
    expect(rows[0]?.firstCueEndMs).toBe(11000);
    expect(rows[0]?.contextText).toBe('see w here');
  });

  it('skips tokenMap entries whose cue index is absent from cues', () => {
    const map = mapOf([[99, [token({ term: 'ghost', start: 0 })]]]);
    const rows = buildPrimerList(map, new Map(), [cue(0, 0, 'real')]);
    expect(rows).toEqual([]);
  });

  it('returns an empty list for an empty tokenMap', () => {
    expect(buildPrimerList(new Map(), new Map(), [])).toEqual([]);
  });
});
