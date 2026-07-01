import type { Settings, SegmentRange } from '@/entities/media';
import { resolveParallelPolicy, type ParallelPolicy } from './parallelPolicy';
import { analyzeParallelSafety, type SafetyAnalysis } from '../execution/parallelSafetyAnalyzer';

/**
 * Combined result of parallel conversion planning (policy + safety).
 */
export interface ParallelPlan {
  /** Whether parallel conversion should be attempted. */
  readonly shouldUseParallel: boolean;
  /** Policy decision (file size, hardware, mode). */
  readonly policy: ParallelPolicy;
  /** Safety analysis (segment metadata quality). */
  readonly safety: SafetyAnalysis;
  /** Final worker count to use (0 if not parallel). */
  readonly workerCount: number;
  /** Human-readable summary for logging. */
  readonly summary: string;
}

/**
 * Plan parallel conversion by combining the policy resolver and safety
 * analyzer.
 *
 * This is a pure function — it does not execute any conversion. It
 * determines whether parallel is feasible and logs the decision.
 *
 * @param settings - User settings.
 * @param segmentRanges - Segment byte ranges from download phase.
 * @param fileSizeBytes - Total input.ts size in bytes.
 * @param hardwareConcurrency - navigator.hardwareConcurrency.
 * @param activeWorkerBudget - Workers already in use by other jobs.
 */
export function planParallelConversion(
  settings: Pick<Settings, 'parallelConversion' | 'manualWorkerCount'>,
  segmentRanges: SegmentRange[] | undefined,
  fileSizeBytes: number,
  hardwareConcurrency: number | undefined,
  activeWorkerBudget: number = 0,
): ParallelPlan {
  // Step 1: Resolve policy (mode, file size, hardware, budget).
  const policy = resolveParallelPolicy(
    settings,
    fileSizeBytes,
    hardwareConcurrency,
    activeWorkerBudget,
  );

  if (!policy.enabled) {
    return {
      shouldUseParallel: false,
      policy,
      safety: {
        eligible: false,
        reason: 'policy disabled parallel',
        maxSafeWorkers: 0,
      },
      workerCount: 0,
      summary: `[parallel-plan] disabled: ${policy.reason}`,
    };
  }

  // Step 2: Analyze safety (segment metadata quality).
  const safety = analyzeParallelSafety(segmentRanges, policy.workerCount);

  if (!safety.eligible) {
    return {
      shouldUseParallel: false,
      policy,
      safety,
      workerCount: 0,
      summary: `[parallel-plan] disabled: policy ok (${policy.reason}) but safety rejected: ${safety.reason}`,
    };
  }

  // Step 3: Use the lesser of policy worker count and safety max.
  const workerCount = Math.min(policy.workerCount, safety.maxSafeWorkers);

  return {
    shouldUseParallel: true,
    policy,
    safety,
    workerCount,
    summary: `[parallel-plan] enabled: ${workerCount} workers (${policy.reason}, ${safety.reason})`,
  };
}
