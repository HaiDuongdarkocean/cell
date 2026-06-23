import { groupSegmentsByBytes } from '@/lib/converters/segmentGrouping';
import type { SegmentRange } from '@/types/media';

function makeRange(index: number, size: number, startByte: number): SegmentRange {
  return {
    index,
    startByte,
    endByte: startByte + size,
    size,
    duration: 10.0,
  };
}

/**
 * Create N segments of equal size.
 */
function makeEvenSegments(count: number, sizeEach: number): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    ranges.push(makeRange(i, sizeEach, offset));
    offset += sizeEach;
  }
  return ranges;
}

describe('groupSegmentsByBytes', () => {
  it('returns empty array for no segments', () => {
    expect(groupSegmentsByBytes([], 4)).toEqual([]);
  });

  it('returns empty array for zero workers', () => {
    const segments = makeEvenSegments(10, 1000);
    expect(groupSegmentsByBytes(segments, 0)).toEqual([]);
  });

  it('returns empty array for negative workers', () => {
    const segments = makeEvenSegments(10, 1000);
    expect(groupSegmentsByBytes(segments, -1)).toEqual([]);
  });

  it('returns empty array when total bytes is zero', () => {
    const segments: SegmentRange[] = [
      makeRange(0, 0, 0),
      makeRange(1, 0, 0),
    ];
    expect(groupSegmentsByBytes(segments, 2)).toEqual([]);
  });

  it('groups even segments into equal-sized groups', () => {
    // 12 segments of 1000 bytes each = 12000 total
    // 4 workers → 3 segments per group, 3000 bytes per group
    const segments = makeEvenSegments(12, 1000);
    const groups = groupSegmentsByBytes(segments, 4);

    expect(groups).toHaveLength(4);

    // Each group should have 3 segments
    groups.forEach((g) => {
      expect(g.segmentIndices).toHaveLength(3);
      expect(g.size).toBe(3000);
    });

    // Groups should be contiguous
    expect(groups[0].startByte).toBe(0);
    expect(groups[0].endByte).toBe(3000);
    expect(groups[1].startByte).toBe(3000);
    expect(groups[1].endByte).toBe(6000);
    expect(groups[2].startByte).toBe(6000);
    expect(groups[2].endByte).toBe(9000);
    expect(groups[3].startByte).toBe(9000);
    expect(groups[3].endByte).toBe(12000);
  });

  it('produces contiguous groups with no gaps or overlaps', () => {
    const segments = makeEvenSegments(20, 500);
    const groups = groupSegmentsByBytes(segments, 4);

    expect(groups).toHaveLength(4);

    for (let i = 0; i < groups.length; i++) {
      if (i > 0) {
        expect(groups[i].startByte).toBe(groups[i - 1].endByte);
      }
    }
    // First group starts at 0, last group ends at total
    expect(groups[0].startByte).toBe(0);
    expect(groups[groups.length - 1].endByte).toBe(20 * 500);
  });

  it('preserves segment order within groups', () => {
    const segments = makeEvenSegments(12, 1000);
    const groups = groupSegmentsByBytes(segments, 3);

    groups.forEach((g, groupIdx) => {
      g.segmentIndices.forEach((segIdx, j) => {
        // Segments within a group should be in increasing order
        if (j > 0) {
          expect(segIdx).toBeGreaterThan(g.segmentIndices[j - 1]);
        }
      });
      // First segment of each group should be greater than last of previous
      if (groupIdx > 0) {
        expect(g.segmentIndices[0]).toBeGreaterThan(
          groups[groupIdx - 1].segmentIndices[
            groups[groupIdx - 1].segmentIndices.length - 1
          ],
        );
      }
    });
  });

  it('no segment appears in more than one group', () => {
    const segments = makeEvenSegments(15, 800);
    const groups = groupSegmentsByBytes(segments, 5);

    const allIndices = groups.flatMap((g) => g.segmentIndices);
    const uniqueIndices = new Set(allIndices);
    expect(allIndices.length).toBe(uniqueIndices.size);
    expect(uniqueIndices.size).toBe(15);
  });

  it('handles uneven segment sizes', () => {
    // Segments with varying sizes
    const segments: SegmentRange[] = [
      makeRange(0, 100, 0),
      makeRange(1, 200, 100),
      makeRange(2, 50, 300),
      makeRange(3, 300, 350),
      makeRange(4, 150, 650),
      makeRange(5, 200, 800),
    ];
    // Total = 1000 bytes, 2 workers → target 500 per group
    const groups = groupSegmentsByBytes(segments, 2);

    expect(groups).toHaveLength(2);
    // Groups should be roughly balanced
    expect(groups[0].size).toBeGreaterThanOrEqual(300);
    expect(groups[1].size).toBeGreaterThanOrEqual(300);
    // Contiguous
    expect(groups[0].endByte).toBe(groups[1].startByte);
    expect(groups[0].startByte).toBe(0);
    expect(groups[1].endByte).toBe(1000);
  });

  it('actual group count <= requested workers when fewer segments', () => {
    // 3 segments, 6 workers → should produce 3 groups, not 6
    const segments = makeEvenSegments(3, 1000);
    const groups = groupSegmentsByBytes(segments, 6);

    expect(groups).toHaveLength(3);
    groups.forEach((g) => {
      expect(g.segmentIndices).toHaveLength(1);
    });
  });

  it('handles single segment', () => {
    const segments = makeEvenSegments(1, 5000);
    const groups = groupSegmentsByBytes(segments, 4);

    expect(groups).toHaveLength(1);
    expect(groups[0].segmentIndices).toEqual([0]);
    expect(groups[0].size).toBe(5000);
    expect(groups[0].startByte).toBe(0);
    expect(groups[0].endByte).toBe(5000);
  });

  it('handles one worker (all segments in one group)', () => {
    const segments = makeEvenSegments(10, 1000);
    const groups = groupSegmentsByBytes(segments, 1);

    expect(groups).toHaveLength(1);
    expect(groups[0].segmentIndices).toHaveLength(10);
    expect(groups[0].size).toBe(10000);
  });

  it('handles large realistic dataset (310 segments, 4 workers)', () => {
    // Simulate a 424MB file with 310 segments of ~1.37MB each
    const segSize = Math.floor((424 * 1024 * 1024) / 310);
    const segments = makeEvenSegments(310, segSize);
    const groups = groupSegmentsByBytes(segments, 4);

    expect(groups).toHaveLength(4);

    // Each group should have roughly 77-78 segments
    groups.forEach((g) => {
      expect(g.segmentIndices.length).toBeGreaterThanOrEqual(75);
      expect(g.segmentIndices.length).toBeLessThanOrEqual(80);
    });

    // Total size should equal sum of group sizes
    const totalGroupSize = groups.reduce((sum, g) => sum + g.size, 0);
    const totalSegmentSize = segments.reduce((sum, s) => sum + s.size, 0);
    expect(totalGroupSize).toBe(totalSegmentSize);

    // Groups should be contiguous
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i].startByte).toBe(groups[i - 1].endByte);
    }
  });
});
