import { analyzeParallelSafety } from '@/lib/converters/parallelSafetyAnalyzer';
import type { SegmentRange } from '@/types/media';
import { MIN_PARALLEL_WORKERS } from '@/shared/config/config';

function makeRange(index: number, size: number, startByte: number): SegmentRange {
  return { index, startByte, endByte: startByte + size, size, duration: 10.0 };
}

function makeEvenRanges(count: number, sizeEach: number): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    ranges.push(makeRange(i, sizeEach, offset));
    offset += sizeEach;
  }
  return ranges;
}

describe('analyzeParallelSafety', () => {
  describe('eligible cases', () => {
    it('returns eligible for normal segment metadata with enough segments', () => {
      const ranges = makeEvenRanges(12, 1000);
      const result = analyzeParallelSafety(ranges, 4);

      expect(result.eligible).toBe(true);
      expect(result.maxSafeWorkers).toBe(4);
      expect(result.groups).toBeDefined();
      expect(result.groups).toHaveLength(4);
    });

    it('returns eligible with groups when requested workers > segments', () => {
      const ranges = makeEvenRanges(3, 1000);
      const result = analyzeParallelSafety(ranges, 6);

      expect(result.eligible).toBe(true);
      expect(result.maxSafeWorkers).toBe(3); // clamped to segment count
      expect(result.groups).toHaveLength(3);
    });

    it('returns eligible for large realistic dataset', () => {
      const ranges = makeEvenRanges(310, 1_400_000);
      const result = analyzeParallelSafety(ranges, 4);

      expect(result.eligible).toBe(true);
      expect(result.maxSafeWorkers).toBe(4);
      expect(result.groups).toHaveLength(4);
    });
  });

  describe('missing metadata', () => {
    it('returns not eligible when segmentRanges is undefined', () => {
      const result = analyzeParallelSafety(undefined, 4);

      expect(result.eligible).toBe(false);
      expect(result.maxSafeWorkers).toBe(0);
      expect(result.reason).toContain('no segment metadata');
    });

    it('returns not eligible when segmentRanges is empty', () => {
      const result = analyzeParallelSafety([], 4);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('no segment metadata');
    });
  });

  describe('insufficient segments', () => {
    it('returns not eligible when fewer segments than MIN_PARALLEL_WORKERS', () => {
      const ranges = makeEvenRanges(1, 1000);
      const result = analyzeParallelSafety(ranges, 4);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('only 1 segments');
    });
  });

  describe('invalid byte ranges', () => {
    it('returns not eligible for negative startByte', () => {
      const ranges: SegmentRange[] = [
        { index: 0, startByte: -1, endByte: 100, size: 101 },
        { index: 1, startByte: 100, endByte: 200, size: 100 },
      ];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('invalid byte range');
    });

    it('returns not eligible when endByte <= startByte', () => {
      const ranges: SegmentRange[] = [
        { index: 0, startByte: 0, endByte: 0, size: 0 },
        { index: 1, startByte: 0, endByte: 100, size: 100 },
      ];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('invalid byte range');
    });

    it('returns not eligible for non-contiguous ranges', () => {
      const ranges: SegmentRange[] = [
        { index: 0, startByte: 0, endByte: 100, size: 100 },
        { index: 1, startByte: 150, endByte: 250, size: 100 }, // gap!
      ];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('startByte 150 != prev endByte 100');
    });

    it('returns not eligible for overlapping ranges', () => {
      const ranges: SegmentRange[] = [
        { index: 0, startByte: 0, endByte: 150, size: 150 },
        { index: 1, startByte: 100, endByte: 250, size: 150 }, // overlap!
      ];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('startByte 100 != prev endByte 150');
    });
  });

  describe('malformed metadata (never throws)', () => {
    it('returns not eligible for undefined startByte', () => {
      const ranges = [
        { index: 0, endByte: 100, size: 100 },
        { index: 1, startByte: 100, endByte: 200, size: 100 },
      ] as unknown as SegmentRange[];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('invalid byte range');
    });

    it('returns not eligible for NaN startByte', () => {
      const ranges: SegmentRange[] = [
        { index: 0, startByte: NaN, endByte: 100, size: 100 },
        { index: 1, startByte: 100, endByte: 200, size: 100 },
      ];
      const result = analyzeParallelSafety(ranges, 2);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('invalid byte range');
    });
  });

  describe('maxSafeWorkers', () => {
    it('clamps to actual group count when requested > segments', () => {
      const ranges = makeEvenRanges(MIN_PARALLEL_WORKERS, 1000);
      const result = analyzeParallelSafety(ranges, 6);

      expect(result.eligible).toBe(true);
      expect(result.maxSafeWorkers).toBe(MIN_PARALLEL_WORKERS);
    });

    it('equals requested when enough segments', () => {
      const ranges = makeEvenRanges(20, 1000);
      const result = analyzeParallelSafety(ranges, 4);

      expect(result.eligible).toBe(true);
      expect(result.maxSafeWorkers).toBe(4);
    });
  });
});
