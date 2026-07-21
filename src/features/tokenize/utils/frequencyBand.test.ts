import { describe, expect, it } from '@jest/globals';
import { rankToBand, entriesToBand } from './frequencyBand';
import type { FrequencyEntry } from '@/entities/dictionary';

describe('frequencyBand', () => {
  it('maps ranks to high/medium/low/very-low', () => {
    expect(rankToBand(100)).toBe('high');
    expect(rankToBand(1000)).toBe('high');
    expect(rankToBand(5000)).toBe('medium');
    expect(rankToBand(20000)).toBe('low');
    expect(rankToBand(20001)).toBe('very-low');
    expect(rankToBand(1000000)).toBe('very-low');
    expect(rankToBand(0)).toBe('none');
    expect(rankToBand(-1)).toBe('none');
    expect(rankToBand(Number.NaN)).toBe('none');
  });

  it('uses the best (lowest) rank across entries', () => {
    const entries: FrequencyEntry[] = [
      { id: 1, resourceId: 1, term: 'test', reading: '', frequency: 50000 },
      { id: 2, resourceId: 2, term: 'test', reading: '', frequency: 3000 },
    ];
    expect(entriesToBand(entries)).toBe('medium');
  });

  it('returns none for empty entries', () => {
    expect(entriesToBand([])).toBe('none');
  });
});
