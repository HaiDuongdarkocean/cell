import { describe, expect, it } from '@jest/globals';
import { rankToBand, entriesToBand } from './frequencyBand';
import type { FrequencyEntry } from '@/entities/dictionary';

describe('frequencyBand', () => {
  it('maps ranks to core/common/general/advanced/rare', () => {
    expect(rankToBand(100)).toBe('core');
    expect(rankToBand(3000)).toBe('core');
    expect(rankToBand(5000)).toBe('common');
    expect(rankToBand(10000)).toBe('general');
    expect(rankToBand(20000)).toBe('advanced');
    expect(rankToBand(20001)).toBe('rare');
    expect(rankToBand(1000000)).toBe('rare');
    expect(rankToBand(0)).toBe('none');
    expect(rankToBand(-1)).toBe('none');
    expect(rankToBand(Number.NaN)).toBe('none');
  });

  it('uses the best (lowest) rank across entries', () => {
    const entries: FrequencyEntry[] = [
      { id: 1, resourceId: 1, term: 'test', reading: '', frequency: 50000 },
      { id: 2, resourceId: 2, term: 'test', reading: '', frequency: 3000 },
    ];
    expect(entriesToBand(entries)).toBe('core');
  });

  it('falls back to rare for missing entries so every token is colored', () => {
    expect(entriesToBand([])).toBe('rare');
  });
});
