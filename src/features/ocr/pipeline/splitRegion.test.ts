// splitRegion.test.ts
import { describe, expect, it } from '@jest/globals';
import { computeSplitHalves, SPLIT_DEFAULT_REGION_PCT } from './splitRegion';

describe('computeSplitHalves', () => {
  const parent = { xPct: 10, yPct: 40, widthPct: 60, heightPct: 30 };
  it('50/50 splits evenly', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.5);
    expect(top).toEqual({ xPct: 10, yPct: 40, widthPct: 60, heightPct: 15 });
    expect(bottom).toEqual({ xPct: 10, yPct: 55, widthPct: 60, heightPct: 15 });
  });
  it('ratio 0.1 → top 10% / bottom 90% of parent height', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.1);
    expect(top.heightPct).toBeCloseTo(3);
    expect(bottom.heightPct).toBeCloseTo(27);
    expect(bottom.yPct).toBeCloseTo(43);
  });
  it('ratio 0.9 mirrors', () => {
    const { top, bottom } = computeSplitHalves(parent, 0.9);
    expect(top.heightPct).toBeCloseTo(27);
    expect(bottom.heightPct).toBeCloseTo(3);
  });
  it('constant exists = 40', () => expect(SPLIT_DEFAULT_REGION_PCT).toBe(40));
});
