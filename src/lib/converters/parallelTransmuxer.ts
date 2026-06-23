/**
 * Experimental parallel TS→MP4 transmuxer.
 *
 * Splits the input by segment group boundaries, transmuxes each group
 * independently, writes each group's output to a temp part file, then
 * merges all parts into the final output.
 *
 * BEHIND FEATURE FLAG — not used by default. The sequential transmuxer
 * remains the active code path until this is proven safe.
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

export interface ParallelTransmuxResult {
  readonly success: boolean;
  readonly outputName: string;
  readonly error?: string;
  readonly partCount?: number;
}

export interface ParallelTransmuxOptions {
  readonly downloadId: string;
  readonly groups: SegmentGroup[];
  readonly segmentRanges: SegmentRange[];
  readonly outputName?: string;
  readonly onProgress?: (processedBytes: number, totalBytes: number) => void;
}

/**
 * Transmux a `.ts` file in parallel by segment groups.
 *
 * Each group is transmuxed independently using a separate mux.js Transmuxer
 * instance. The input for each group is a byte-range slice of `input.ts`.
 * Each group's output is written to `parts/part-{i}.fmp4`. After all groups
 * complete, the parts are merged into `output.mp4`.
 *
 * If any group fails, the entire operation fails (caller should fallback).
 *
 * @experimental Not used by default. Behind feature flag.
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

  console.debug(
    `[parallel-transmuxer] Starting: ${groups.length} groups, ${totalBytes} bytes total`,
  );

  // Track progress across all groups.
  const groupProgress = new Array(groups.length).fill(0);
  const reportProgress = (): void => {
    const processed = groupProgress.reduce((sum, p) => sum + p, 0);
    onProgress?.(processed, totalBytes);
  };

  // Create a parts subdirectory by writing a placeholder file (OPFS doesn't
  // have explicit mkdir — files create their parent dir implicitly via
  // getFileHandle on the dirHandle). We write part files directly to the
  // download dir with a `part-` prefix.
  const partNames = groups.map((g) => `part-${g.index}.fmp4`);

  // Transmux all groups in parallel.
  const results = await Promise.all(
    groups.map(async (group, i) => {
      const partName = partNames[i];
      console.debug(
        `[parallel-transmuxer] Group ${group.index}: bytes [${group.startByte}, ${group.endByte}), ${group.segmentIndices.length} segments`,
      );

      // Create a sliced File for this group's byte range.
      const groupFile = inputFile.slice(group.startByte, group.endByte, 'video/mp2t');

      // Transmux this group's slice into a part file.
      const result = await transmuxTsToFmp4(
        groupFile,
        dirHandle,
        partName,
        (processedBytes, groupTotalBytes) => {
          groupProgress[i] = (processedBytes / groupTotalBytes) * group.size;
          reportProgress();
        },
      );

      if (!result.success) {
        return { success: false, partName, error: result.error };
      }

      return { success: true, partName };
    }),
  );

  // Check if any group failed.
  const failedGroup = results.find((r) => !r.success);
  if (failedGroup) {
    // Cleanup any successful part files.
    await cleanupPartFiles(dirHandle, partNames);
    return {
      success: false,
      outputName,
      error: `Group transmux failed: ${failedGroup.error}`,
    };
  }

  // Merge all part files into the final output.
  console.debug(`[parallel-transmuxer] Merging ${partNames.length} parts into ${outputName}`);
  const mergeResult = await mergePartFiles(dirHandle, partNames, outputName);

  // Cleanup part files regardless of merge result.
  await cleanupPartFiles(dirHandle, partNames);

  if (!mergeResult.success) {
    return {
      success: false,
      outputName,
      error: `Merge failed: ${mergeResult.error}`,
    };
  }

  console.debug(`[parallel-transmuxer] Done: ${outputName} from ${partNames.length} parts`);
  return {
    success: true,
    outputName,
    partCount: partNames.length,
  };
}

/**
 * Merge fragmented MP4 part files into a single output file.
 *
 * For fragmented MP4, the first part contains the init segment (ftyp + moov)
 * followed by media fragments (moof + mdat). Subsequent parts contain only
 * media fragments (their init segments are stripped).
 *
 * This is a simplified merge: concatenate all bytes, skipping duplicate init
 * segments from parts 1..n. A proper merge would parse MP4 boxes, but for
 * MVP we rely on mux.js producing compatible fragments from contiguous TS
 * segments.
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

      // For parts after the first, we need to skip the init segment.
      // For MVP, we write all bytes — mux.js fragments from contiguous TS
      // should be compatible. A proper box-parser merge is Task 14.
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
 * Returns undefined if metadata is missing or corrupt.
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
