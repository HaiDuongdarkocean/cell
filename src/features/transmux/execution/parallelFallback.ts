/**
 * Fallback policy for parallel conversion failures.
 *
 * When parallel conversion fails, the system must decide whether to:
 * 1. Retry with fewer workers
 * 2. Fall back to sequential conversion
 * 3. Fail immediately (for non-recoverable errors)
 *
 * The policy is configurable via `parallelFallback` setting:
 * - 'sequential': always fall back to sequential (safest, default)
 * - 'retry-reduced': retry once with fewer workers, then sequential
 * - 'fail': fail immediately (for debugging)
 */

import type { ParallelFallbackMode } from '@/types/media';

/** Result of fallback decision. */
export interface FallbackDecision {
  readonly action: 'retry-reduced' | 'sequential' | 'fail';
  readonly retryWorkerCount?: number;
  readonly reason: string;
}

/**
 * Decide what to do when a parallel conversion attempt fails.
 *
 * @param strategy - User's fallback strategy setting.
 * @param currentWorkerCount - Workers used in the failed attempt.
 * @param attemptNumber - Which attempt this was (1 = first, 2 = retry).
 * @param error - The error that caused the failure.
 * @param minWorkers - Minimum viable worker count (default 2).
 */
export function decideFallback(
  strategy: ParallelFallbackMode,
  currentWorkerCount: number,
  attemptNumber: number,
  error: string,
  minWorkers: number = 2,
): FallbackDecision {
  // 'fail' strategy: never retry, never fallback.
  if (strategy === 'fail') {
    return {
      action: 'fail',
      reason: `fail strategy: ${error}`,
    };
  }

  // 'sequential' strategy: always go to sequential on any failure.
  if (strategy === 'sequential') {
    return {
      action: 'sequential',
      reason: `sequential fallback: ${error}`,
    };
  }

  // 'save-ts' strategy: skip conversion entirely, save .ts directly.
  if (strategy === 'save-ts') {
    return {
      action: 'fail',
      reason: `save-ts fallback (save .ts directly): ${error}`,
    };
  }

  // 'retry-reduced' strategy: retry once with fewer workers, then sequential.
  if (strategy === 'retry-reduced') {
    if (attemptNumber === 1) {
      const reducedWorkers = Math.max(minWorkers, Math.floor(currentWorkerCount / 2));
      if (reducedWorkers < currentWorkerCount && reducedWorkers >= minWorkers) {
        return {
          action: 'retry-reduced',
          retryWorkerCount: reducedWorkers,
          reason: `retry with ${reducedWorkers} workers (was ${currentWorkerCount}): ${error}`,
        };
      }
    }
    // After retry attempt, or if can't reduce further, go sequential.
    return {
      action: 'sequential',
      reason: `sequential fallback after retry: ${error}`,
    };
  }

  // Unknown strategy: safest is sequential.
  return {
    action: 'sequential',
    reason: `unknown strategy '${strategy}', falling back to sequential: ${error}`,
  };
}

/**
 * Execute a conversion with fallback handling.
 *
 * Tries the parallel conversion first. If it fails, consults
 * `decideFallback` and either retries with fewer workers or falls
 * back to the sequential converter.
 *
 * @param parallelFn - Function that runs parallel conversion with N workers.
 * @param sequentialFn - Function that runs sequential conversion.
 * @param strategy - Fallback strategy.
 * @param initialWorkerCount - Workers for first attempt.
 * @param minWorkers - Minimum viable workers.
 */
export async function executeWithFallback<T>(
  parallelFn: (workerCount: number) => Promise<T>,
  sequentialFn: () => Promise<T>,
  strategy: ParallelFallbackMode,
  initialWorkerCount: number,
  minWorkers: number = 2,
): Promise<T> {
  let workerCount = initialWorkerCount;
  let attempt = 1;

  // Try parallel conversion (with optional retry).
   
  while (true) {
    try {
      return await parallelFn(workerCount);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const decision = decideFallback(strategy, workerCount, attempt, errorMsg, minWorkers);

      console.log(`[fallback] Attempt ${attempt} failed: ${decision.reason}`);

      if (decision.action === 'fail') {
        throw err;
      }

      if (decision.action === 'sequential') {
        console.log('[fallback] Falling back to sequential conversion');
        return await sequentialFn();
      }

      if (decision.action === 'retry-reduced' && decision.retryWorkerCount) {
        workerCount = decision.retryWorkerCount;
        attempt++;
        continue;
      }

      // Shouldn't reach here, but fallback to sequential just in case.
      return await sequentialFn();
    }
  }
}

