import type { SegmentRange } from '@/types/media';

/**
 * A group of contiguous segments assigned to one parallel worker.
 */
export interface SegmentGroup {
  /** Zero-based group index. */
  readonly index: number;
  /** Start byte offset in input.ts (inclusive). */
  readonly startByte: number;
  /** End byte offset in input.ts (exclusive). */
  readonly endByte: number;
  /** Total bytes in this group. */
  readonly size: number;
  /** Indices of segments in this group. */
  readonly segmentIndices: readonly number[];
}

/**
 * Group contiguous segments into near-equal byte ranges for parallel
 * processing.
 *
 * Groups are balanced by total bytes, not by segment count. Each group
 * contains a contiguous run of segments — no segment is split across
 * groups.
 *
 * @param segmentRanges - Segment byte ranges in playlist order.
 * @param requestedWorkers - Desired number of groups.
 * @returns Array of segment groups. Actual count may be less than
 *          requested if there are fewer segments than workers.
 */
export function groupSegmentsByBytes(
  segmentRanges: readonly SegmentRange[],
  requestedWorkers: number,
): SegmentGroup[] {
  if (segmentRanges.length === 0 || requestedWorkers <= 0) {
    return [];
  }

  const totalBytes = segmentRanges.reduce((sum, r) => sum + r.size, 0);
  if (totalBytes === 0) {
    return [];
  }

  // Actual workers cannot exceed segment count.
  const actualWorkers = Math.min(requestedWorkers, segmentRanges.length);

  // Target bytes per group.
  const targetBytesPerGroup = totalBytes / actualWorkers;

  const groups: SegmentGroup[] = [];
  let currentSegments: number[] = [];
  let currentSize = 0;
  let groupIndex = 0;

  for (let i = 0; i < segmentRanges.length; i++) {
    const seg = segmentRanges[i];
    currentSegments.push(seg.index);
    currentSize += seg.size;

    // Close the current group if:
    // 1. We've reached the target size AND this isn't the last segment, AND
    //    we haven't already allocated all groups except the last one.
    // 2. OR this is the last segment (final group gets the remainder).
    const isLastSegment = i === segmentRanges.length - 1;
    const remainingGroups = actualWorkers - groupIndex;
    const mustCloseForLastGroup = remainingGroups === 1 && !isLastSegment;

    if (isLastSegment) {
      // Final group — close it.
      groups.push({
        index: groupIndex,
        startByte: seg.endByte - currentSize,
        endByte: seg.endByte,
        size: currentSize,
        segmentIndices: currentSegments,
      });
    } else if (mustCloseForLastGroup) {
      // We need to leave at least 1 segment for the final group.
      // Don't close yet — keep accumulating.
      continue;
    } else if (currentSize >= targetBytesPerGroup) {
      // We've reached the target — close this group.
      groups.push({
        index: groupIndex,
        startByte: seg.endByte - currentSize,
        endByte: seg.endByte,
        size: currentSize,
        segmentIndices: currentSegments,
      });
      groupIndex++;
      currentSegments = [];
      currentSize = 0;
    }
  }

  // If we accumulated segments but never closed the last group (edge case
  // where the loop ended without hitting isLastSegment close), close now.
  if (currentSegments.length > 0 && groups.length < actualWorkers) {
    const lastSeg = segmentRanges[currentSegments[currentSegments.length - 1]];
    if (lastSeg) {
      groups.push({
        index: groupIndex,
        startByte: lastSeg.endByte - currentSize,
        endByte: lastSeg.endByte,
        size: currentSize,
        segmentIndices: currentSegments,
      });
    }
  }

  return groups;
}
