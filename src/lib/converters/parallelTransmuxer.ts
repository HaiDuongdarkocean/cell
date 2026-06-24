/**
 * Parallel TS→MP4 transmuxer using Web Workers.
 *
 * Splits the input by segment group boundaries, transmuxes each group
 * independently on a separate CPU core via Web Workers, then merges
 * all outputs into the final file.
 *
 * Uses Transferable Objects for zero-copy ArrayBuffer transfer between
 * main thread and workers — no data copying overhead.
 *
 * Falls back to inline (single-thread) transmux if Web Workers are
 * not available (e.g., in test environments).
 */

import type { SegmentRange } from '@/types/media';
import type { SegmentGroup } from '@/lib/converters/segmentGrouping';
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
  createOpfsWriter,
  deleteFile,
  writeJsonFile,
  readJsonFile,
} from '@/lib/storage/opfsStorage';

// Web Worker creation is isolated in workerFactory.ts (which uses
// `import.meta.url`) so that Jest's CommonJS transform never parses
// that syntax. The factory is loaded via dynamic import() only when
// workers are actually available at runtime.

export interface ParallelTransmuxResult {
  readonly success: boolean;
  readonly outputName: string;
  readonly error?: string;
  readonly partCount?: number;
  readonly usedWorkers?: boolean;
  readonly groupTimings?: number[];
}

export interface ParallelTransmuxOptions {
  readonly downloadId: string;
  readonly groups: SegmentGroup[];
  readonly segmentRanges: SegmentRange[];
  readonly outputName?: string;
  readonly onProgress?: (processedBytes: number, totalBytes: number) => void;
}

// --- Worker management ---

/** Worker response type (matches transmuxWorker.ts). */
interface WorkerResponse {
  groupIndex: number;
  success: boolean;
  output?: Uint8Array;
  error?: string;
  durationMs: number;
  outputSize: number;
}

/**
 * Check if Web Workers are available in this environment.
 *
 * Workers are skipped in Jest/test environments (no real Worker global,
 * and import.meta.url is invalid under CommonJS transform).
 */
function areWorkersAvailable(): boolean {
  if (typeof Worker === 'undefined') return false;
  // Skip in Jest/test environments
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return false;
  return true;
}

/**
 * Create a Web Worker for transmuxing a segment group.
 *
 * Dynamically imports workerFactory.ts (which contains `import.meta.url`)
 * so that Jest never parses that syntax. The factory is only loaded when
 * workers are actually available.
 */
async function createTransmuxWorker(): Promise<Worker> {
  const { createTransmuxWorker: factory } = await import('./workerFactory');
  return factory();
}

/**
 * Transmux a single group in a Web Worker.
 * Uses Transferable Objects for zero-copy data transfer.
 */
function transmuxGroupInWorker(
  groupData: Uint8Array,
  groupIndex: number,
): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    createTransmuxWorker()
      .then((worker) => {
        // Worker created — wire up handlers below.
        wireWorkerHandlers(worker, resolve, reject, groupIndex, groupData);
      })
      .catch((err) => reject(err));
  });
}

function wireWorkerHandlers(
  worker: Worker,
  resolve: (value: WorkerResponse) => void,
  reject: (reason?: unknown) => void,
  groupIndex: number,
  groupData: Uint8Array,
): void {
  const timeout = setTimeout(() => {
    worker.terminate();
    reject(new Error(`Worker ${groupIndex} timed out after 120s`));
  }, 120000);

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    clearTimeout(timeout);
    worker.terminate();
    resolve(event.data);
  };

  worker.onerror = (err) => {
    clearTimeout(timeout);
    worker.terminate();
    reject(err);
  };

  // Transfer the group data buffer (zero-copy)
  // Note: we must copy the buffer first because the original inputFile
  // buffer is shared across groups — we can only transfer owned buffers.
  const transferBuffer = groupData.slice().buffer;
  worker.postMessage(
    { groupIndex, groupData: new Uint8Array(transferBuffer) },
    [transferBuffer],
  );
}

/**
 * Transmux a single group inline (fallback when Workers unavailable).
 * Uses the sequential transmuxer on a sliced File.
 */
async function transmuxGroupInline(
  inputFile: Blob,
  dirHandle: FileSystemDirectoryHandle,
  group: SegmentGroup,
  partName: string,
  _groupIndex: number,
  onGroupProgress?: (processedBytes: number, groupTotalBytes: number) => void,
): Promise<{ success: boolean; partName: string; error?: string; durationMs: number }> {
  const start = performance.now();
  const groupFile = inputFile.slice(group.startByte, group.endByte, 'video/mp2t');
  const result = await transmuxTsToFmp4(
    groupFile,
    dirHandle,
    partName,
    onGroupProgress,
  );
  return {
    success: result.success,
    partName,
    error: result.error,
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Transmux a `.ts` file in parallel by segment groups.
 *
 * Uses Web Workers for true parallelism (separate CPU cores) when
 * available. Falls back to Promise.all (single-thread concurrency)
 * when Workers are not available.
 *
 * Uses Transferable Objects for zero-copy data transfer to workers.
 */
export async function transmuxTsToFmp4ParallelExperimental(
  options: ParallelTransmuxOptions,
): Promise<ParallelTransmuxResult> {
  const {
    downloadId,
    groups,
    outputName = 'output.mp4',
    onProgress,
  } = options;

  if (groups.length === 0) {
    return { success: false, outputName, error: 'No segment groups provided' };
  }

  const dirHandle = await ensureDownloadSubdir(downloadId);
  const inputFile = await opfsReadFile(dirHandle, 'input.ts');
  const totalBytes = inputFile.size;
  const useWorkers = areWorkersAvailable();

  console.debug(
    `[parallel-transmuxer] Starting: ${groups.length} groups, ${totalBytes} bytes, ${useWorkers ? 'Web Workers' : 'inline (fallback)'}`,
  );

  // Track progress across all groups.
  const groupProgress = new Array(groups.length).fill(0);
  const reportProgress = (): void => {
    const processed = groupProgress.reduce((sum, p) => sum + p, 0);
    onProgress?.(processed, totalBytes);
  };

  const partNames = groups.map((g) => `part-${g.index}.fmp4`);
  const groupTimings: number[] = new Array(groups.length).fill(0);

  if (useWorkers) {
    // --- Web Worker path (true parallelism) ---

    // Read the entire input into memory for slicing to workers.
    // For a 424MB file, this uses ~424MB RAM temporarily.
    // The sequential path also reads in chunks, but workers need
    // the full group data upfront.
    const inputBuffer = new Uint8Array(await inputFile.arrayBuffer());

    const results = await Promise.all(
      groups.map(async (group, i) => {
        console.debug(
          `[parallel-transmuxer] Worker ${i}: bytes [${group.startByte}, ${group.endByte}), ${group.segmentIndices.length} segments`,
        );

        const groupData = inputBuffer.subarray(group.startByte, group.endByte);
        const response = await transmuxGroupInWorker(groupData, i);

        groupTimings[i] = response.durationMs;
        groupProgress[i] = group.size;
        reportProgress();

        if (!response.success) {
          return { success: false, partName: partNames[i], error: response.error };
        }

        // Write worker output to part file
        const writer = await createOpfsWriter(dirHandle, partNames[i]);
        await writer.write(response.output!);
        await writer.close();

        console.debug(
          `[parallel-transmuxer] Worker ${i}: ${response.durationMs}ms, ${(response.outputSize / 1024 / 1024).toFixed(1)}MB output`,
        );

        return { success: true, partName: partNames[i] };
      }),
    );

    // Check if any group failed
    const failedGroup = results.find((r) => !r.success);
    if (failedGroup) {
      await cleanupPartFiles(dirHandle, partNames);
      return {
        success: false,
        outputName,
        error: `Group transmux failed: ${failedGroup.error}`,
        usedWorkers: true,
        groupTimings,
      };
    }
  } else {
    // --- Inline fallback path (single-thread concurrency) ---

    const results = await Promise.all(
      groups.map(async (group, i) => {
        const partName = partNames[i];
        console.debug(
          `[parallel-transmuxer] Inline ${i}: bytes [${group.startByte}, ${group.endByte}), ${group.segmentIndices.length} segments`,
        );

        const result = await transmuxGroupInline(
          inputFile,
          dirHandle,
          group,
          partName,
          i,
          (processedBytes, groupTotalBytes) => {
            groupProgress[i] = (processedBytes / groupTotalBytes) * group.size;
            reportProgress();
          },
        );

        groupTimings[i] = result.durationMs;

        if (!result.success) {
          return { success: false, partName, error: result.error };
        }
        return { success: true, partName };
      }),
    );

    const failedGroup = results.find((r) => !r.success);
    if (failedGroup) {
      await cleanupPartFiles(dirHandle, partNames);
      return {
        success: false,
        outputName,
        error: `Group transmux failed: ${failedGroup.error}`,
        usedWorkers: false,
        groupTimings,
      };
    }
  }

  // Merge all part files into the final output.
  console.debug(`[parallel-transmuxer] Merging ${partNames.length} parts into ${outputName}`);
  const mergeResult = await mergePartFiles(dirHandle, partNames, outputName);
  await cleanupPartFiles(dirHandle, partNames);

  if (!mergeResult.success) {
    return {
      success: false,
      outputName,
      error: `Merge failed: ${mergeResult.error}`,
      usedWorkers: useWorkers,
      groupTimings,
    };
  }

  console.debug(`[parallel-transmuxer] Done: ${outputName} from ${partNames.length} parts`);
  return {
    success: true,
    outputName,
    partCount: partNames.length,
    usedWorkers: useWorkers,
    groupTimings,
  };
}

/**
 * Merge fragmented MP4 part files into a single output file.
 */
async function mergePartFiles(
  dirHandle: FileSystemDirectoryHandle,
  partNames: string[],
  outputName: string,
): Promise<{ success: boolean; error?: string }> {
  if (partNames.length === 0) {
    return { success: false, error: 'No parts to merge' };
  }

  const writer = await createOpfsWriter(dirHandle, outputName);
  let totalWritten = 0;

  try {
    for (let i = 0; i < partNames.length; i++) {
      const partName = partNames[i];
      const partFile = await opfsReadFile(dirHandle, partName);
      const partSize = partFile.size;

      if (partSize === 0) {
        return { success: false, error: `Part ${partName} is empty` };
      }

      const buffer = await partFile.arrayBuffer();
      await writer.write(new Uint8Array(buffer));
      totalWritten += partSize;

      console.debug(
        `[parallel-transmuxer] Merged ${partName}: ${partSize} bytes (total: ${totalWritten})`,
      );
    }

    if (totalWritten === 0) {
      return { success: false, error: 'Merged output is empty' };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parallel-transmuxer] Merge failed:', message);
    return { success: false, error: message };
  } finally {
    await writer.close();
  }
}

/**
 * Delete all part files from OPFS. Safe to call even if some files don't exist.
 */
async function cleanupPartFiles(
  dirHandle: FileSystemDirectoryHandle,
  partNames: string[],
): Promise<void> {
  for (const name of partNames) {
    await deleteFile(dirHandle, name).catch(() => {
      // Ignore — file may not exist if transmux failed early.
    });
  }
}

/**
 * Read segment ranges from OPFS for a given downloadId.
 */
export async function readSegmentRanges(
  downloadId: string,
): Promise<SegmentRange[] | undefined> {
  const dirHandle = await ensureDownloadSubdir(downloadId);
  return readJsonFile<SegmentRange[]>(dirHandle, 'segment-ranges.json');
}

/**
 * Write segment ranges to OPFS for a given downloadId.
 */
export async function writeSegmentRanges(
  downloadId: string,
  ranges: SegmentRange[],
): Promise<void> {
  const dirHandle = await ensureDownloadSubdir(downloadId);
  await writeJsonFile(dirHandle, 'segment-ranges.json', ranges);
}
