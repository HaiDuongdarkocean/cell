/**
 * Streaming MPEG-TS → fragmented MP4 transmuxer using mux.js.
 *
 * Reads the input `.ts` file in fixed-size chunks and feeds each chunk to the
 * mux.js `Transmuxer`. Output fragments are written directly to OPFS via a
 * single open writable stream, using a serialized promise chain to avoid the
 * sync/async race condition (mux.js emits `data` events synchronously and does
 * not await the handler). Memory stays at ~1-2 fragments regardless of total
 * video size — no full-output `outputChunks[]` accumulation.
 */

// mux.js ships as CommonJS; import the default export and destructure.
import muxjs from 'mux.js';
import { createOpfsWriter } from '@/lib/storage/opfsStorage';

const { Transmuxer } = muxjs.mp4;

/** Chunk size for reading the input file (4 MB — larger chunks reduce loop
 * overhead and arrayBuffer() calls; 430MB = 108 iterations instead of 430). */
const READ_CHUNK_SIZE = 4 * 1024 * 1024;

export interface TransmuxResult {
  readonly success: boolean;
  readonly outputName: string;
  readonly error?: string;
}

/**
 * Transmux a `.ts` `File` (read from OPFS) into a fragmented MP4 file written
 * to the same OPFS directory.
 *
 * @param inputFile  - The input `.ts` file (from OPFS `readFile`).
 * @param dirHandle  - OPFS directory handle to write `output.mp4` into.
 * @param outputName - Name of the output file (default `output.mp4`).
 * @param onProgress - Optional callback `(processedBytes, totalBytes)`.
 * @returns `{ success, outputName, error? }`.
 */
export async function transmuxTsToFmp4(
  inputFile: Blob,
  dirHandle: FileSystemDirectoryHandle,
  outputName: string = 'output.mp4',
  onProgress?: (processedBytes: number, totalBytes: number) => void,
): Promise<TransmuxResult> {
  const totalBytes = inputFile.size;
  if (totalBytes === 0) {
    return { success: false, outputName, error: 'Input file is empty' };
  }

  console.debug(
    `[tsTransmuxer] Starting transmux: ${totalBytes} bytes → ${outputName}`,
  );

  const transmuxer = new Transmuxer();
  let processedBytes = 0;
  let initSegmentWritten = false;
  let bytesWritten = 0;

  // Open a single OPFS writable stream for all output fragments.
  const writer = await createOpfsWriter(dirHandle, outputName);

  // Serialized write chain: mux.js emits `data` events synchronously and does
  // NOT await the handler. If we called `await writer.write(...)` directly
  // inside the handler, the next `data` event could fire before the previous
  // write completed, causing concurrent writes to the same stream → corrupt
  // output. Instead, we append each write to a promise chain so writes are
  // strictly serialized.
  let writeChain: Promise<void> = Promise.resolve();

  transmuxer.on(
    'data',
    (segment: { type: string; data: Uint8Array; initSegment?: Uint8Array }) => {
      const chunks: Uint8Array[] = [];

      if (segment.initSegment && segment.initSegment.length > 0) {
        chunks.push(segment.initSegment);
        initSegmentWritten = true;
        console.debug(
          `[tsTransmuxer] initSegment: ${segment.initSegment.length} bytes`,
        );
      }
      if (segment.data && segment.data.length > 0) {
        chunks.push(segment.data);
      }

      if (chunks.length > 0) {
        // Append to the serialized write chain — do NOT await here.
        writeChain = writeChain.then(async () => {
          for (const chunk of chunks) {
            await writer.write(chunk);
            bytesWritten += chunk.byteLength;
          }
        });
      }
    },
  );

  try {
    // CRITICAL: Register the 'done' listener BEFORE calling flush().
    // mux.js fires 'done' synchronously during flush() — if the listener
    // is registered after flush(), the event is missed and the promise
    // never resolves (timeout).
    const donePromise = waitForDone(transmuxer, totalBytes);

    // Pipeline reads: prefetch the next chunk's ArrayBuffer while the
    // current chunk is being transmuxed. This overlaps I/O (OPFS read) with
    // CPU work (mux.js parsing), which is the main bottleneck for large files.
    //
    // Pattern: start reading chunk[i+1] immediately, then push chunk[i] to
    // the transmuxer (synchronous CPU work). By the time push() returns,
    // chunk[i+1] is likely already read — no I/O wait.
    let nextChunkPromise: Promise<ArrayBuffer> | null = null;

    for (let offset = 0; offset < totalBytes; offset += READ_CHUNK_SIZE) {
      const end = Math.min(offset + READ_CHUNK_SIZE, totalBytes);

      // Use the prefetched chunk (if any) or read now.
      const chunkBuffer = nextChunkPromise
        ? await nextChunkPromise
        : await inputFile.slice(offset, end).arrayBuffer();

      // Prefetch the next chunk NOW, before the synchronous transmuxer.push()
      // — so I/O overlaps with CPU work.
      const nextOffset = offset + READ_CHUNK_SIZE;
      if (nextOffset < totalBytes) {
        const nextEnd = Math.min(nextOffset + READ_CHUNK_SIZE, totalBytes);
        nextChunkPromise = inputFile.slice(nextOffset, nextEnd).arrayBuffer();
      } else {
        nextChunkPromise = null;
      }

      transmuxer.push(new Uint8Array(chunkBuffer));
      processedBytes = end;
      onProgress?.(processedBytes, totalBytes);
    }

    // Signal end-of-stream — this synchronously fires the 'done' event
    // registered above via waitForDone.
    transmuxer.flush();

    // Wait for the 'done' event (or timeout). The listener was registered
    // before flush(), so this resolves immediately if done already fired.
    await donePromise;

    // Wait for all queued writes to complete before closing the writer.
    await writeChain;

    if (bytesWritten === 0 || !initSegmentWritten) {
      return {
        success: false,
        outputName,
        error:
          'Transmuxer produced no output (unsupported codec or corrupt input). ' +
          'No init segment was emitted — the input may not be valid MPEG-TS ' +
          'or the codec is not supported by mux.js.',
      };
    }

    console.debug(`[tsTransmuxer] Done: ${outputName} (${bytesWritten} bytes)`);
    return { success: true, outputName };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[tsTransmuxer] Transmux failed:', message);
    return { success: false, outputName, error: message };
  } finally {
    await writer.close();
    transmuxer.dispose();
  }
}

/**
 * Wait for the transmuxer's `done` event, which fires after `flush()` completes
 * and all buffered fragments have been emitted via `data`.
 *
 * The timeout is proportional to the input size (~1 second per MB, minimum
 * 30 seconds) to accommodate large files on slow machines. On timeout, the
 * promise REJECTS so the caller falls back to `.ts` instead of producing a
 * truncated/corrupt MP4.
 */
function waitForDone(
  transmuxer: InstanceType<typeof Transmuxer>,
  totalBytes: number,
): Promise<void> {
  const timeoutMs = Math.max(30_000, Math.floor(totalBytes / (1024 * 1024) * 1000));
  return new Promise<void>((resolve, reject) => {
    transmuxer.on('done', () => resolve());
    setTimeout(
      () => reject(new Error(`Transmux timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
}
