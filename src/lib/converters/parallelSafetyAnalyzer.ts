import type { SegmentRange } from '@/types/media';
import { groupSegmentsByBytes, type SegmentGroup } from '@/lib/converters/segmentGrouping';
import { MIN_PARALLEL_WORKERS } from '@/constants/config';

/**
 * Result of the parallel conversion safety analysis.
 */
export interface SafetyAnalysis {
  /** Whether the input is eligible for parallel conversion. */
  readonly eligible: boolean;
  /** Human-readable reason for the decision. */
  readonly reason: string;
  /** Maximum safe worker count (may be less than requested). */
  readonly maxSafeWorkers: number;
  /** Segment groups that would be used (undefined if not eligible). */
  readonly groups?: SegmentGroup[];
}

/**
 * Analyze whether an input is eligible for experimental parallel
 * conversion.
 *
 * MVP safe criteria:
 * - segment metadata exists and is non-empty
 * - enough segment ranges for at least MIN_PARALLEL_WORKERS groups
 * - segment grouping produces non-empty groups
 * - byte ranges are contiguous and monotonic
 *
 * This function never throws for malformed metadata — it returns
 * `{ eligible: false }` instead.
 *
 * @param segmentRanges - Segment byte ranges from the download phase.
 * @param requestedWorkers - Worker count from the policy resolver.
 */
export function analyzeParallelSafety(
  segmentRanges: SegmentRange[] | undefined,
  requestedWorkers: number,
): SafetyAnalysis {
  // Missing metadata → not eligible.
  if (!segmentRanges || segmentRanges.length === 0) {
    return {
      eligible: false,
      reason: 'no segment metadata available',
      maxSafeWorkers: 0,
    };
  }

  // Validate byte ranges are contiguous and monotonic.
  for (let i = 0; i < segmentRanges.length; i++) {
    const range = segmentRanges[i];
    if (!range || typeof range.startByte !== 'number' || typeof range.endByte !== 'number') {
      return {
        eligible: false,
        reason: `segment ${i} has invalid byte range`,
        maxSafeWorkers: 0,
      };
    }
    // Use Number.isFinite to reject NaN, Infinity, -Infinity.
    if (
      !Number.isFinite(range.startByte) ||
      !Number.isFinite(range.endByte) ||
      range.startByte < 0 ||
      range.endByte <= range.startByte
    ) {
      return {
        eligible: false,
        reason: `segment ${i} has invalid byte range [${range.startByte}, ${range.endByte})`,
        maxSafeWorkers: 0,
      };
    }
    if (i > 0) {
      const prev = segmentRanges[i - 1];
      if (prev && range.startByte !== prev.endByte) {
        return {
          eligible: false,
          reason: `segment ${i} startByte ${range.startByte} != prev endByte ${prev.endByte}`,
          maxSafeWorkers: 0,
        };
      }
    }
  }

  // Need at least MIN_PARALLEL_WORKERS segments for meaningful parallelism.
  if (segmentRanges.length < MIN_PARALLEL_WORKERS) {
    return {
      eligible: false,
      reason: `only ${segmentRanges.length} segments, need >= ${MIN_PARALLEL_WORKERS}`,
      maxSafeWorkers: 0,
    };
  }

  // Try grouping. If grouping fails or produces empty result, not eligible.
  let groups: SegmentGroup[];
  try {
    groups = groupSegmentsByBytes(segmentRanges, requestedWorkers);
  } catch (err: unknown) {
    return {
      eligible: false,
      reason: `grouping failed: ${err instanceof Error ? err.message : String(err)}`,
      maxSafeWorkers: 0,
    };
  }

  if (groups.length === 0) {
    return {
      eligible: false,
      reason: 'grouping produced 0 groups',
      maxSafeWorkers: 0,
    };
  }

  // Max safe workers = actual group count (can't use more workers than groups).
  const maxSafeWorkers = groups.length;

  if (maxSafeWorkers < MIN_PARALLEL_WORKERS) {
    return {
      eligible: false,
      reason: `only ${maxSafeWorkers} groups possible, need >= ${MIN_PARALLEL_WORKERS}`,
      maxSafeWorkers: 0,
    };
  }

  return {
    eligible: true,
    reason: `${segmentRanges.length} segments → ${maxSafeWorkers} groups, each >= 1 segment`,
    maxSafeWorkers,
    groups,
  };
}
