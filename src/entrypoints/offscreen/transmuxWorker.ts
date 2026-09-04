/**
 * Web Worker: transmux a segment group's TS byte range into fragmented MP4.
 *
 * Receives a Uint8Array (the group's byte range from input.ts) via
 * postMessage, transmuxes it using mux.js, and sends back the output
 * as a Uint8Array (using Transferable Objects for zero-copy transfer).
 *
 * This runs on a separate CPU core — true parallelism, not just
 * Promise.all concurrency.
 */

import muxjs from 'mux.js';

const { Transmuxer } = muxjs.mp4;

interface WorkerRequest {
  groupIndex: number;
  groupData: Uint8Array;
}

interface WorkerResponse {
  groupIndex: number;
  success: boolean;
  output?: Uint8Array;
  error?: string;
  durationMs: number;
  outputSize: number;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { groupIndex, groupData } = event.data;
  const start = performance.now();

  try {
    const transmuxer = new Transmuxer();
    const chunks: Uint8Array[] = [];
    let bytesWritten = 0;
    let initSegmentWritten = false;
    let doneFired = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    transmuxer.on('data', (segment: { type: string; data: Uint8Array; initSegment?: Uint8Array }) => {
      if (segment.initSegment && segment.initSegment.length > 0) {
        chunks.push(segment.initSegment);
        initSegmentWritten = true;
        bytesWritten += segment.initSegment.length;
      }
      if (segment.data && segment.data.length > 0) {
        chunks.push(segment.data);
        bytesWritten += segment.data.length;
      }
    });

    // CRITICAL: Register 'done' listener BEFORE calling flush().
    // mux.js fires 'done' synchronously during flush() — if the listener
    // is registered after flush(), the event is missed and the worker
    // times out.
    transmuxer.on('done', () => {
      doneFired = true;
      if (timeoutId) clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - start);
      transmuxer.dispose();

      if (bytesWritten === 0 || !initSegmentWritten) {
        const response: WorkerResponse = {
          groupIndex,
          success: false,
          error: 'Transmuxer produced no output (unsupported codec or corrupt input)',
          durationMs,
          outputSize: 0,
        };
        (self as unknown as Worker).postMessage(response);
        return;
      }

      const output = new Uint8Array(bytesWritten);
      let writeOffset = 0;
      for (const chunk of chunks) {
        output.set(chunk, writeOffset);
        writeOffset += chunk.length;
      }

      const response: WorkerResponse = {
        groupIndex,
        success: true,
        output,
        durationMs,
        outputSize: output.length,
      };

      // Transfer the output buffer (zero-copy)
      (self as unknown as Worker).postMessage(response, [output.buffer]);
    });

    // Push data in 4MB chunks (same as sequential transmuxer)
    const CHUNK_SIZE = 4 * 1024 * 1024;
    for (let offset = 0; offset < groupData.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, groupData.length);
      transmuxer.push(groupData.subarray(offset, end));
    }

    // Signal end-of-stream — this synchronously fires the 'done' event
    // registered above.
    transmuxer.flush();

    // Timeout: proportional to input size. Only fires if 'done' was never
    // emitted (should not happen with the fix above, but kept as safety net).
    const timeoutMs = Math.max(30_000, Math.floor(groupData.length / (1024 * 1024) * 1000));
    timeoutId = setTimeout(() => {
      if (doneFired) return;
      transmuxer.dispose();
      const response: WorkerResponse = {
        groupIndex,
        success: false,
        error: `Transmux timed out after ${timeoutMs}ms`,
        durationMs: Math.round(performance.now() - start),
        outputSize: 0,
      };
      (self as unknown as Worker).postMessage(response);
    }, timeoutMs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = {
      groupIndex,
      success: false,
      error: message,
      durationMs: Math.round(performance.now() - start),
      outputSize: 0,
    };
    (self as unknown as Worker).postMessage(response);
  }
};
