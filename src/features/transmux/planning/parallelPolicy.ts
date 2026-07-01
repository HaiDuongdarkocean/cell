import type { ParallelConversionMode, Settings } from '@/entities/media';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  DEFAULT_MANUAL_WORKER_COUNT,
  PARALLEL_MIN_FILE_BYTES,
  PARALLEL_LARGE_FILE_BYTES,
} from '@/shared/config/config';

/**
 * Result of resolving the parallel scaling policy.
 */
export interface ParallelPolicy {
  /** Whether parallel conversion should be attempted at all. */
  readonly enabled: boolean;
  /** Intended worker count (clamped to safe bounds). 0 if not enabled. */
  readonly workerCount: number;
  /** Human-readable reason for the decision. */
  readonly reason: string;
  /** The mode that was resolved. */
  readonly mode: ParallelConversionMode;
}

/**
 * Resolve settings + file size + hardware concurrency + active worker budget
 * into an intended worker count.
 *
 * This does NOT inspect media safety (that is the safety analyzer's job).
 * It only determines whether parallel is worth attempting and how many
 * workers to request.
 *
 * @param settings - User settings (parallelConversion, manualWorkerCount).
 * @param fileSizeBytes - Total size of input.ts in bytes.
 * @param hardwareConcurrency - navigator.hardwareConcurrency (CPU cores).
 * @param activeWorkerBudget - How many workers are already in use by other
 *        concurrent conversions. The resolver subtracts this from the cap.
 */
export function resolveParallelPolicy(
  settings: Pick<Settings, 'parallelConversion' | 'manualWorkerCount'>,
  fileSizeBytes: number,
  hardwareConcurrency: number | undefined,
  activeWorkerBudget: number = 0,
): ParallelPolicy {
  const mode = settings.parallelConversion;

  // Mode: off → always sequential.
  if (mode === 'off') {
    return {
      enabled: false,
      workerCount: 0,
      reason: 'parallelConversion is off',
      mode,
    };
  }

  // File too small → sequential is fast enough.
  if (fileSizeBytes < PARALLEL_MIN_FILE_BYTES) {
    return {
      enabled: false,
      workerCount: 0,
      reason: `file size ${fileSizeBytes} bytes < ${PARALLEL_MIN_FILE_BYTES} threshold`,
      mode,
    };
  }

  // Hardware concurrency check: need at least 3 cores (2 workers + 1 for
  // main thread / offscreen overhead).
  const effectiveCores = hardwareConcurrency ?? 1;
  if (effectiveCores < 3) {
    return {
      enabled: false,
      workerCount: 0,
      reason: `hardware concurrency ${effectiveCores} < 3 (need 2 workers + overhead)`,
      mode,
    };
  }

  // Determine requested workers based on mode.
  let requestedWorkers: number;
  if (mode === 'manual') {
    requestedWorkers = settings.manualWorkerCount ?? DEFAULT_MANUAL_WORKER_COUNT;
  } else {
    // auto mode: scale by file size.
    if (fileSizeBytes >= PARALLEL_LARGE_FILE_BYTES) {
      requestedWorkers = 4;
    } else {
      requestedWorkers = 2;
    }
  }

  // Clamp to static safe bounds.
  let clampedWorkers = Math.max(
    MIN_PARALLEL_WORKERS,
    Math.min(MAX_PARALLEL_WORKERS, requestedWorkers),
  );

  // Clamp to hardware limit: leave 1 core for main thread.
  const maxByHardware = Math.max(MIN_PARALLEL_WORKERS, effectiveCores - 1);
  clampedWorkers = Math.min(clampedWorkers, maxByHardware);

  // Clamp to available budget (don't oversubscribe with concurrent jobs).
  const availableBudget = MAX_PARALLEL_WORKERS - activeWorkerBudget;
  if (availableBudget < MIN_PARALLEL_WORKERS) {
    return {
      enabled: false,
      workerCount: 0,
      reason: `no available worker budget (${activeWorkerBudget} active, max ${MAX_PARALLEL_WORKERS})`,
      mode,
    };
  }
  clampedWorkers = Math.min(clampedWorkers, availableBudget);

  if (clampedWorkers < MIN_PARALLEL_WORKERS) {
    return {
      enabled: false,
      workerCount: 0,
      reason: `clamped worker count ${clampedWorkers} < min ${MIN_PARALLEL_WORKERS}`,
      mode,
    };
  }

  return {
    enabled: true,
    workerCount: clampedWorkers,
    reason: `${mode} mode: ${clampedWorkers} workers for ${fileSizeBytes} bytes on ${effectiveCores} cores`,
    mode,
  };
}
