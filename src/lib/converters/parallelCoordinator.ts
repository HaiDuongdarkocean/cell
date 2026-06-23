/**
 * Integration coordinator for parallel conversion.
 *
 * Wires together all parallel conversion components:
 * - Policy resolver (settings → worker count)
 * - Safety analyzer (segment metadata → eligibility)
 * - Parallel transmuxer (experimental)
 * - Fallback handler (parallel → sequential)
 * - Progress tracker (phase-based progress)
 * - Cancellation token (cancel by downloadId)
 * - MP4 validator (output validation)
 * - Benchmark harness (performance measurement)
 *
 * This is the single entry point that the offscreen conversion path
 * should call when parallel conversion is enabled.
 *
 * BEHIND FEATURE FLAG — not called by default. The sequential
 * transmuxer remains the active code path until Task 20 enables
 * auto mode after benchmark gates pass.
 */

import type { Settings, SegmentRange } from '@/types/media';
import { planParallelConversion, type ParallelPlan } from '@/lib/converters/parallelPlanner';
import { transmuxTsToFmp4ParallelExperimental } from '@/lib/converters/parallelTransmuxer';
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import { executeWithFallback } from '@/lib/converters/parallelFallback';
import {
  ParallelProgressTracker,
  type ParallelConversionPhase,
} from '@/lib/converters/parallelProgress';
import { validateFragmentedMp4 } from '@/lib/converters/mp4Validator';
import {
  CancellationTokenRegistry,
  ParallelConversionCancelledError,
  cleanupParallelTempFiles,
} from '@/lib/converters/parallelCancellation';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
} from '@/lib/storage/opfsStorage';

/** Result of parallel conversion coordination. */
export interface ParallelConversionResult {
  readonly success: boolean;
  readonly outputName: string;
  readonly error?: string;
  readonly usedParallel: boolean;
  readonly workerCount?: number;
  readonly fallbackUsed?: boolean;
  readonly durationMs?: number;
}

/** Global registry for cancellation tokens. */
const tokenRegistry = new CancellationTokenRegistry();

/** Cancel a parallel conversion by downloadId. */
export function cancelParallelConversion(downloadId: string): void {
  tokenRegistry.cancel(downloadId);
}

/** Check if a parallel conversion is cancelled. */
export function isParallelConversionCancelled(downloadId: string): boolean {
  return tokenRegistry.isCancelled(downloadId);
}

/**
 * Execute a conversion with parallel support and fallback.
 *
 * This is the main entry point for parallel conversion. It:
 * 1. Plans the conversion (policy + safety)
 * 2. If parallel is viable, tries parallel with fallback
 * 3. If parallel is not viable, runs sequential directly
 * 4. Validates output if parallel was used
 * 5. Cleans up temp files
 *
 * @param settings - User settings
 * @param downloadId - Download ID for OPFS lookup
 * @param segmentRanges - Segment byte ranges (from download phase)
 * @param fileSizeBytes - Total input.ts size
 * @param hardwareConcurrency - navigator.hardwareConcurrency
 * @param activeWorkerBudget - Workers already in use
 * @param onProgress - Progress callback (percent, phase)
 */
export async function executeParallelConversion(
  settings: Pick<Settings, 'parallelConversion' | 'manualWorkerCount' | 'parallelFallback'>,
  downloadId: string,
  segmentRanges: SegmentRange[] | undefined,
  fileSizeBytes: number,
  hardwareConcurrency: number | undefined,
  activeWorkerBudget: number = 0,
  onProgress?: (percent: number, phase: ParallelConversionPhase) => void,
): Promise<ParallelConversionResult> {
  const startedAt = performance.now();
  const progressTracker = new ParallelProgressTracker(onProgress);

  // Step 1: Plan
  progressTracker.start('planning');
  const plan: ParallelPlan = planParallelConversion(
    settings,
    segmentRanges,
    fileSizeBytes,
    hardwareConcurrency,
    activeWorkerBudget,
  );

  console.debug(plan.summary);

  // If parallel is not viable, run sequential directly.
  if (!plan.shouldUseParallel || !plan.safety.groups) {
    console.debug('[parallel-coordinator] Running sequential conversion');
    const result = await runSequential(downloadId, progressTracker);
    return {
      ...result,
      usedParallel: false,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  // Step 2: Create cancellation token
  const token = tokenRegistry.create(downloadId);

  try {
    // Step 3: Execute with fallback
    progressTracker.start('transmuxing');
    const workerCount = plan.workerCount;
    const groups = plan.safety.groups;

    const result = await executeWithFallback(
      async (_workers) => {
        token.throwIfCancelled();
        return await transmuxTsToFmp4ParallelExperimental({
          downloadId,
          groups,
          segmentRanges: segmentRanges ?? [],
          outputName: 'output.mp4',
          onProgress: (processed, total) => {
            progressTracker.update(processed / total);
          },
        });
      },
      async () => {
        token.throwIfCancelled();
        return await runSequential(downloadId, progressTracker);
      },
      settings.parallelFallback,
      workerCount,
    );

    // Step 4: Validate output if parallel was used
    progressTracker.start('validating');
    if (result.success) {
      const validationError = await validateOutput(downloadId);
      if (validationError) {
        console.warn(`[parallel-coordinator] Validation failed: ${validationError}`);
        // Fall back to sequential
        const seqResult = await runSequential(downloadId, progressTracker);
        return {
          ...seqResult,
          usedParallel: false,
          fallbackUsed: true,
          durationMs: Math.round(performance.now() - startedAt),
        };
      }
    }

    progressTracker.done();
    return {
      success: result.success,
      outputName: result.outputName,
      error: result.error,
      usedParallel: true,
      workerCount,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (err: unknown) {
    if (err instanceof ParallelConversionCancelledError) {
      console.debug(`[parallel-coordinator] Cancelled: ${downloadId}`);
      return {
        success: false,
        outputName: 'output.mp4',
        error: 'Conversion cancelled',
        usedParallel: false,
        durationMs: Math.round(performance.now() - startedAt),
      };
    }
    throw err;
  } finally {
    // Step 5: Cleanup
    await cleanupParallelTempFiles(downloadId);
    tokenRegistry.dispose(downloadId);
  }
}

/**
 * Run sequential conversion.
 */
async function runSequential(
  downloadId: string,
  progressTracker: ParallelProgressTracker,
): Promise<{ success: boolean; outputName: string; error?: string }> {
  const dirHandle = await ensureDownloadSubdir(downloadId);
  const inputFile = await opfsReadFile(dirHandle, 'input.ts');

  progressTracker.start('transmuxing');
  const result = await transmuxTsToFmp4(
    inputFile,
    dirHandle,
    'output.mp4',
    (processed, total) => {
      progressTracker.update(processed / total);
    },
  );

  if (result.success) {
    progressTracker.done();
  }

  return result;
}

/**
 * Validate the output MP4 file.
 * Returns undefined if valid, error string if invalid.
 */
async function validateOutput(downloadId: string): Promise<string | undefined> {
  try {
    const dirHandle = await ensureDownloadSubdir(downloadId);
    const file = await opfsReadFile(dirHandle, 'output.mp4');
    const buffer = await file.arrayBuffer();
    const result = validateFragmentedMp4(new Uint8Array(buffer));
    if (!result.valid) {
      return result.reason;
    }
    return undefined;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}
