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
import type { SegmentGroup } from '@/features/transmux/planning/segmentGrouping';
import { transmuxTsToFmp4 } from './tsTransmuxer';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
  createOpfsWriter,
  deleteFile,
  writeJsonFile,
  readJsonFile,
} from '@/shared/lib/storage/opfsStorage';

// Web Worker creation is isolated in workerFactory.ts (which uses
// `import.meta.url`) so that Jest's CommonJS transform never parses
// that syntax. The factory is loaded via dynamic import() only when
// workers are actually available at runtime.

/**
 * Find the byte offset of the first `moof` box in a fragmented MP4 buffer.
 *
 * A valid fMP4 part from mux.js has the structure:
 *   ftyp + moov + moof + mdat [+ moof + mdat ...]
 *
 * When merging parallel parts, parts 1+ must skip their ftyp+moov boxes
 * to avoid producing an invalid file with multiple initialization boxes.
 * This function finds where the first moof starts so the caller can
 * subarray from that offset.
 *
 * @returns The byte offset of the first moof box, or -1 if not found.
 */
export function findFirstMoofOffset(buffer: Uint8Array): number {
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    // Read box size (big-endian uint32)
    const size =
      (buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3];
    // Read box type (4 ASCII chars)
    const type = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7],
    );

    if (type === 'moof') {
      return offset;
    }

    // Box size must be at least 8 (header size). If invalid, stop parsing.
    if (size < 8 || offset + size > buffer.length) {
      break;
    }
    offset += size;
  }
  return -1;
}

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

  console.log(
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
        console.log(
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

        console.log(
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
        console.log(
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
  console.log(`[parallel-transmuxer] Merging ${partNames.length} parts into ${outputName}`);
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

  console.log(`[parallel-transmuxer] Done: ${outputName} from ${partNames.length} parts`);
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
 *
 * Two fixes applied:
 * 1. **ftyp+moov stripping**: Parts 1+ have their ftyp+moov boxes stripped
 *    via `findFirstMoofOffset` so the merged output has exactly one init pair.
 * 2. **tfdt offset fix**: mux.js rebases PTS to 0 for each Transmuxer instance,
 *    so parts 1+ have tfdt values starting from ~0 instead of their absolute
 *    position in the timeline. This function computes cumulative per-track
 *    offsets and patches tfdt values in parts 1+ so fragments don't overlap.
 * 3. **mvhd duration fix**: The moov's mvhd duration is updated to the total
 *    duration across all parts (it was previously only part 0's duration).
 */
async function mergePartFiles(
  dirHandle: FileSystemDirectoryHandle,
  partNames: string[],
  outputName: string,
): Promise<{ success: boolean; error?: string }> {
  if (partNames.length === 0) {
    return { success: false, error: 'No parts to merge' };
  }

  // --- Phase 1: Read all parts into memory and extract per-track info ---
  const partBuffers: Uint8Array[] = [];
  for (let i = 0; i < partNames.length; i++) {
    const partFile = await opfsReadFile(dirHandle, partNames[i]);
    if (partFile.size === 0) {
      return { success: false, error: `Part ${partNames[i]} is empty` };
    }
    partBuffers.push(new Uint8Array(await partFile.arrayBuffer()));
  }

  // --- Phase 2: Read timescales from part 0's moov ---
  const timescales = readTimescalesFromMoov(partBuffers[0]);

  // --- Phase 3: Extract per-track tfdt + duration from each part ---
  // For each part, compute the end time per track = tfdt + trun total_duration.
  // This tells us how long each part's timeline is per track.
  const partInfos: Map<number, { tfdt: number; endTfdt: number }>[] = [];
  for (let i = 0; i < partBuffers.length; i++) {
    partInfos.push(extractPartTrackInfo(partBuffers[i]));
  }

  // --- Phase 4: Compute cumulative offsets and patch tfdt in parts 1+ ---
  // cumulativeOffset[trackId] = sum of all previous parts' durations for that track.
  // Each part's offset = cumulative offset at the time we reach it.
  const cumulativeOffset: Map<number, number> = new Map();
  for (let i = 0; i < partBuffers.length; i++) {
    const info = partInfos[i];
    const partOffset = new Map<number, number>();

    for (const [trackId, ti] of info) {
      partOffset.set(trackId, cumulativeOffset.get(trackId) ?? 0);
      // Update cumulative: add this part's own duration (endTfdt - tfdt)
      const partDuration = ti.endTfdt - ti.tfdt;
      cumulativeOffset.set(trackId, (cumulativeOffset.get(trackId) ?? 0) + partDuration);
    }

    // Patch tfdt values in parts 1+ (part 0 keeps original timestamps)
    if (i > 0) {
      offsetTfdtInPlace(partBuffers[i], partOffset);
    }
  }

  // --- Phase 5: Update mvhd duration in part 0's moov ---
  // mvhd duration was only part 0's duration; update to total across all parts.
  const maxEndSec = computeMaxEndSeconds(cumulativeOffset, timescales);
  updateMvhdDuration(partBuffers[0], maxEndSec);

  // --- Phase 6: Write merged output ---
  const writer = await createOpfsWriter(dirHandle, outputName);
  let totalWritten = 0;

  try {
    for (let i = 0; i < partBuffers.length; i++) {
      const buffer = partBuffers[i];

      // Part 0: write everything (ftyp + moov + moof + mdat + ...).
      // Parts 1+: skip ftyp + moov, write only moof + mdat + ...
      let writeOffset = 0;
      if (i > 0) {
        const moofOffset = findFirstMoofOffset(buffer);
        if (moofOffset === -1) {
          return {
            success: false,
            error: `Part ${partNames[i]} has no moof box — cannot strip ftyp/moov`,
          };
        }
        writeOffset = moofOffset;
      }

      const toWrite = buffer.subarray(writeOffset);
      await writer.write(toWrite);
      totalWritten += toWrite.length;

      console.log(
        `[parallel-transmuxer] Merged ${partNames[i]}: ${toWrite.length} bytes` +
          (i > 0 ? ` (stripped ${writeOffset} bytes ftyp/moov, tfdt offset applied)` : '') +
          ` (total: ${totalWritten})`,
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

// === fMP4 box parsing utilities for tfdt offset fix ===

/** Read a big-endian uint32 from a buffer at the given offset. */
function readU32(buf: Uint8Array, off: number): number {
  return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

/** Read a big-endian uint64 (as JS number, may lose precision for very large values). */
function readU64(buf: Uint8Array, off: number): number {
  const hi = readU32(buf, off);
  const lo = readU32(buf, off + 4);
  return hi * 0x100000000 + lo;
}

/** Write a big-endian uint32 to a buffer at the given offset. */
function writeU32(buf: Uint8Array, off: number, val: number): void {
  buf[off] = (val >>> 24) & 0xff;
  buf[off + 1] = (val >>> 16) & 0xff;
  buf[off + 2] = (val >>> 8) & 0xff;
  buf[off + 3] = val & 0xff;
}

/** Write a big-endian uint64 to a buffer at the given offset. */
function writeU64(buf: Uint8Array, off: number, val: number): void {
  writeU32(buf, off, Math.floor(val / 0x100000000));
  writeU32(buf, off + 4, val & 0xffffffff);
}

/** Parse top-level MP4 boxes from a buffer. Returns array of { type, offset, size, body }. */
function parseBoxes(buf: Uint8Array): Array<{ type: string; offset: number; size: number; body: Uint8Array }> {
  const boxes: Array<{ type: string; offset: number; size: number; body: Uint8Array }> = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = readU32(buf, offset);
    const type = String.fromCharCode(
      buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7],
    );
    if (size < 8 || offset + size > buf.length) break;
    boxes.push({ type, offset, size, body: buf.subarray(offset + 8, offset + size) });
    offset += size;
  }
  return boxes;
}

/**
 * Read timescales from a part's moov box.
 * Returns a Map<trackId, timescale> by parsing moov → trak → mdia → mdhd.
 */
function readTimescalesFromMoov(partBuf: Uint8Array): Map<number, number> {
  const timescales = new Map<number, number>();
  const topBoxes = parseBoxes(partBuf);
  const moov = topBoxes.find((b) => b.type === 'moov');
  if (!moov) return timescales;

  const moovBoxes = parseBoxes(moov.body);
  for (const trak of moovBoxes.filter((b) => b.type === 'trak')) {
    const trakBoxes = parseBoxes(trak.body);
    const tkhd = trakBoxes.find((b) => b.type === 'tkhd');
    const mdia = trakBoxes.find((b) => b.type === 'mdia');
    if (!tkhd || !mdia) continue;

    // track_id is at tkhd body offset 12 (version+flags(4) + creation(4) + modification(4) + track_id(4))
    const trackId = readU32(tkhd.body, 12);

    const mdiaBoxes = parseBoxes(mdia.body);
    const mdhd = mdiaBoxes.find((b) => b.type === 'mdhd');
    if (!mdhd) continue;

    const version = mdhd.body[0];
    // version 0: creation(4) + modification(4) + timescale(4) + duration(4)
    // version 1: creation(8) + modification(8) + timescale(4) + duration(8)
    const timescale = version === 1 ? readU32(mdhd.body, 20) : readU32(mdhd.body, 12);
    timescales.set(trackId, timescale);
  }
  return timescales;
}

/**
 * Extract per-track tfdt and end time from a part's moof boxes.
 * Returns a Map<trackId, { tfdt, endTfdt }> where endTfdt = tfdt + trun total_duration.
 */
function extractPartTrackInfo(partBuf: Uint8Array): Map<number, { tfdt: number; endTfdt: number }> {
  const result = new Map<number, { tfdt: number; endTfdt: number }>();
  const topBoxes = parseBoxes(partBuf);

  for (const box of topBoxes) {
    if (box.type !== 'moof') continue;
    const moofBoxes = parseBoxes(box.body);
    const traf = moofBoxes.find((b) => b.type === 'traf');
    if (!traf) continue;

    const trafBoxes = parseBoxes(traf.body);
    const tfhd = trafBoxes.find((b) => b.type === 'tfhd');
    const tfdt = trafBoxes.find((b) => b.type === 'tfdt');
    const trun = trafBoxes.find((b) => b.type === 'trun');
    if (!tfhd || !tfdt) continue;

    const trackId = readU32(tfhd.body, 4);
    const tfdtVersion = tfdt.body[0];
    const tfdtValue = tfdtVersion === 1 ? readU64(tfdt.body, 4) : readU32(tfdt.body, 4);

    // Parse trun for total sample duration
    let totalDuration = 0;
    if (trun) {
      const trunFlags = readU32(trun.body, 0) & 0xffffff;
      const sampleCount = readU32(trun.body, 4);
      let trunOff = 8;
      if (trunFlags & 0x1) trunOff += 4; // data_offset
      if (trunFlags & 0x100) {
        for (let i = 0; i < sampleCount && trunOff + 4 <= trun.body.length; i++) {
          totalDuration += readU32(trun.body, trunOff);
          trunOff += 4;
          if (trunFlags & 0x200) trunOff += 4; // sample_size
          if (trunFlags & 0x400) trunOff += 4; // sample_flags
          if (trunFlags & 0x800) trunOff += 4; // composition_time
        }
      }
    }

    result.set(trackId, { tfdt: tfdtValue, endTfdt: tfdtValue + totalDuration });
  }
  return result;
}

/**
 * Offset tfdt values in all moof boxes of a part buffer (in-place).
 * This fixes the timeline overlap caused by mux.js rebasing PTS to 0 per group.
 *
 * @param buf     The part buffer to modify in-place.
 * @param offsets A Map<trackId, offset> where offset is added to each track's tfdt.
 */
function offsetTfdtInPlace(buf: Uint8Array, offsets: Map<number, number>): void {
  const topBoxes = parseBoxes(buf);

  for (const box of topBoxes) {
    if (box.type !== 'moof') continue;
    const moofBoxes = parseBoxes(box.body);
    const traf = moofBoxes.find((b) => b.type === 'traf');
    if (!traf) continue;

    const trafBoxes = parseBoxes(traf.body);
    const tfhd = trafBoxes.find((b) => b.type === 'tfhd');
    const tfdt = trafBoxes.find((b) => b.type === 'tfdt');
    if (!tfhd || !tfdt) continue;

    const trackId = readU32(tfhd.body, 4);
    const offset = offsets.get(trackId);
    if (offset === undefined || offset === 0) continue;

    // Compute absolute offset of tfdt body in the original buffer:
    // moof.offset + 8 (moof header) + traf.offset + 8 (traf header) + tfdt.offset + 8 (tfdt header)
    const tfdtBodyAbs = box.offset + 8 + traf.offset + 8 + tfdt.offset + 8;
    const version = tfdt.body[0];

    if (version === 1) {
      const oldVal = readU64(buf, tfdtBodyAbs + 4);
      writeU64(buf, tfdtBodyAbs + 4, oldVal + offset);
    } else {
      const oldVal = readU32(buf, tfdtBodyAbs + 4);
      writeU32(buf, tfdtBodyAbs + 4, oldVal + offset);
    }
  }
}

/**
 * Compute the maximum end time in seconds across all tracks.
 * Used to update mvhd duration in the moov box.
 */
function computeMaxEndSeconds(
  cumulativeOffset: Map<number, number>,
  timescales: Map<number, number>,
): number {
  let maxEndSec = 0;
  for (const [trackId, totalDuration] of cumulativeOffset) {
    const ts = timescales.get(trackId) ?? 90000;
    const endSec = totalDuration / ts;
    if (endSec > maxEndSec) maxEndSec = endSec;
  }
  return maxEndSec;
}

/**
 * Update the mvhd (Movie Header) duration in a part's moov box.
 * The original duration only reflects part 0's timeline; this updates it
 * to the total duration across all parts.
 */
function updateMvhdDuration(partBuf: Uint8Array, totalEndSec: number): void {
  const topBoxes = parseBoxes(partBuf);
  const moov = topBoxes.find((b) => b.type === 'moov');
  if (!moov) return;

  const moovBoxes = parseBoxes(moov.body);
  const mvhd = moovBoxes.find((b) => b.type === 'mvhd');
  if (!mvhd) return;

  const version = mvhd.body[0];
  // version 0: creation(4) + modification(4) + timescale(4) + duration(4) → duration at offset 16
  // version 1: creation(8) + modification(8) + timescale(4) + duration(8) → duration at offset 24
  const timescale = version === 1 ? readU32(mvhd.body, 20) : readU32(mvhd.body, 12);
  const newDuration = Math.floor(totalEndSec * timescale);

  // Absolute offset of mvhd body in the part buffer
  const mvhdBodyAbs = moov.offset + 8 + mvhd.offset + 8;

  if (version === 1) {
    writeU64(partBuf, mvhdBodyAbs + 24, newDuration);
  } else {
    writeU32(partBuf, mvhdBodyAbs + 16, newDuration);
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

