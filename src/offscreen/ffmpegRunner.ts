/**
 * Offscreen document runner: MPEG-TS → fragmented MP4 transmuxer.
 *
 * MV3 service workers cannot run WebAssembly or do heavy processing, so all
 * transmuxing work is delegated to this offscreen document. The background
 * script streams downloaded `.ts` segments into OPFS (`downloads/{id}/input.ts`),
 * then sends a `CONVERT_TS_TO_MP4_V2` message containing only the download id.
 *
 * This module reads `input.ts` from OPFS, transmuxes it to `output.mp4` using
 * mux.js (chunk-by-chunk, ~10MB memory regardless of video size), writes the
 * result back to OPFS, and responds with the output file name.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import { executeParallelConversion } from '@/features/transmux/execution/parallelCoordinator';
import { readSegmentRanges } from '@/lib/converters/parallelTransmuxer';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
} from '@/shared/lib/storage/opfsStorage';
import type {
  ConvertTsToMp4V2Payload,
  ConvertTsToMp4V2ResultPayload,
  ConversionProgressUpdatePayload,
  CreateOpfsBlobUrlPayload,
  CreateOpfsBlobUrlResultPayload,
  RevokeOpfsBlobUrlPayload,
  MessageRequest,
  MessageResponse,
} from '@/types/message';
import type { Settings, ConversionPhase } from '@/types/media';

/** Currently-registered message listener (kept so it can be removed). */
let messageListener:
  | ((
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | undefined)
  | null = null;

/**
 * Active Blob URLs created by this offscreen document, keyed by URL string.
 *
 * Blob URLs are tied to the document that created them. The offscreen document
 * must stay alive while any Blob URL is active, and must revoke them when the
 * background signals that `chrome.downloads.download` has consumed the URL.
 */
const activeBlobUrls = new Map<string, true>();

/**
 * Current parallel conversion settings. Updated via setParallelSettings().
 * Default to 'off' so the sequential path remains active until the user
 * or auto-enablement gates turn on parallel.
 */
let parallelSettings: Pick<Settings, 'parallelConversion' | 'manualWorkerCount' | 'parallelFallback'> = {
  parallelConversion: 'off',
  manualWorkerCount: 4,
  parallelFallback: 'sequential',
};

/**
 * Update parallel conversion settings. Called when the background script
 * receives updated settings from the popup.
 */
export function setParallelSettings(
  settings: Pick<Settings, 'parallelConversion' | 'manualWorkerCount' | 'parallelFallback'>,
): void {
  parallelSettings = settings;
  console.log(`[offscreen-runner] Parallel settings updated: mode=${settings.parallelConversion}, workers=${settings.manualWorkerCount}`);
}

/**
 * Broadcast conversion progress to the background script so it can relay
 * the update to the popup.
 *
 * Uses `chrome.runtime.sendMessage` (fire-and-forget). The background
 * listener handles `CONVERSION_PROGRESS_UPDATE` and re-broadcasts it as a
 * progress update to the popup.
 */
function broadcastConversionProgress(
  downloadId: string,
  percent: number,
  phase: ConversionPhase,
  fileSize: number,
  processedBytes: number,
  workerCount: number,
  usedWorkers: boolean,
): void {
  const payload: ConversionProgressUpdatePayload = {
    downloadId,
    percent,
    phase,
    fileSize,
    processedBytes,
    workerCount,
    usedWorkers,
  };
  const request: MessageRequest = {
    type: MESSAGE_TYPES.CONVERSION_PROGRESS_UPDATE,
    payload,
  };
  // Fire-and-forget — the popup may not be open, and that's fine.
  void chrome.runtime.sendMessage(request).catch(() => {
    // Popup/background may not be listening — ignore.
  });
}

/**
 * Convert a `.ts` file stored in OPFS (`downloads/{downloadId}/input.ts`) into
 * a fragmented MP4 file (`output.mp4`) in the same OPFS directory.
 *
 * Uses the parallel conversion coordinator when parallel mode is enabled.
 * Falls back to the sequential transmuxer when parallel is 'off' or when
 * the safety analyzer determines the input is not eligible.
 *
 * @returns The result payload `{ downloadId, outputName, mimeType, success }`.
 */
export async function convertTsToMp4V2(
  downloadId: string,
): Promise<ConvertTsToMp4V2ResultPayload> {
  const startedAt = performance.now();
  console.log(`[offscreen-runner] Starting V2 conversion for ${downloadId}`);

  const dirHandle = await ensureDownloadSubdir(downloadId);
  const inputFile = await opfsReadFile(dirHandle, 'input.ts');
  const fileSize = inputFile.size;
  const readMs = Math.round(performance.now() - startedAt);
  console.log(
    `[offscreen-runner] Read input.ts (${fileSize} bytes) for ${downloadId} in ${readMs}ms`,
  );

  // Try parallel conversion if enabled
  if (parallelSettings.parallelConversion !== 'off') {
    console.log(`[offscreen-runner] Parallel mode: ${parallelSettings.parallelConversion}`);

    // Read segment ranges from OPFS
    const segmentRanges = await readSegmentRanges(downloadId);
    if (segmentRanges && segmentRanges.length > 0) {
      const hardwareConcurrency = typeof navigator !== 'undefined'
        ? navigator.hardwareConcurrency
        : undefined;

      // Track the worker count outside the callback so it can be updated
      // after the plan is created. Using `parallelResult?.workerCount` inside
      // the callback would be a TDZ violation — `parallelResult` is not yet
      // initialized while `executeParallelConversion` is still running.
      let currentWorkerCount = 0;

      const parallelResult = await executeParallelConversion(
        parallelSettings,
        downloadId,
        segmentRanges,
        fileSize,
        hardwareConcurrency,
        0,
        (percent, phase) => {
          // Estimate processed bytes from percent (transmuxing phase is 86–95%)
          const processedBytes = Math.floor((percent / 100) * fileSize);

          broadcastConversionProgress(
            downloadId,
            percent,
            phase,
            fileSize,
            processedBytes,
            currentWorkerCount,
            true,
          );

          console.log(
            `[offscreen-runner] Parallel progress for ${downloadId}: ${phase} ${percent}%`,
          );
        },
      );

      // Update the worker count for any final progress broadcasts.
      currentWorkerCount = parallelResult.workerCount ?? 0;

      const totalMs = Math.round(performance.now() - startedAt);
      console.log(
        `[offscreen-runner] Conversion ${parallelResult.success ? 'completed' : 'failed'} for ${downloadId} in ${totalMs}ms (parallel=${parallelResult.usedParallel}, workers=${parallelResult.workerCount ?? 0})`,
      );

      if (!parallelResult.success) {
        console.error(
          `[offscreen-runner] Conversion failed for ${downloadId}: ${parallelResult.error}`,
        );
        return {
          downloadId,
          outputName: parallelResult.outputName,
          mimeType: 'video/mp4',
          success: false,
          error: parallelResult.error,
          workerCount: parallelResult.workerCount,
          usedWorkers: parallelResult.usedParallel,
          durationMs: totalMs,
        };
      }

      return {
        downloadId,
        outputName: parallelResult.outputName,
        mimeType: 'video/mp4',
        success: true,
        workerCount: parallelResult.workerCount,
        usedWorkers: parallelResult.usedParallel,
        durationMs: totalMs,
      };
    }

    // No segment ranges — fall back to sequential
    console.log(`[offscreen-runner] No segment ranges, falling back to sequential for ${downloadId}`);
  }

  // Sequential conversion (default or fallback)
  const transmuxStartedAt = performance.now();
  const result = await transmuxTsToFmp4(
    inputFile,
    dirHandle,
    'output.mp4',
    (processedBytes, totalBytes) => {
      const pct = Math.floor((processedBytes / totalBytes) * 100);
      broadcastConversionProgress(
        downloadId,
        pct,
        'transmuxing',
        fileSize,
        processedBytes,
        0,
        false,
      );
      console.log(
        `[offscreen-runner] Convert progress for ${downloadId}: ${pct}% (${processedBytes}/${totalBytes})`,
      );
    },
  );
  const transmuxMs = Math.round(performance.now() - transmuxStartedAt);
  console.log(
    `[offscreen-runner] Sequential transmux ${result.success ? 'completed' : 'failed'} for ${downloadId} in ${transmuxMs}ms`,
  );

  if (!result.success) {
    console.error(
      `[offscreen-runner] Transmux failed for ${downloadId}: ${result.error}`,
    );
    return {
      downloadId,
      outputName: result.outputName,
      mimeType: 'video/mp4',
      success: false,
      error: result.error,
      workerCount: 0,
      usedWorkers: false,
      durationMs: transmuxMs,
    };
  }

  console.log(`[offscreen-runner] Transmux succeeded for ${downloadId}`);
  return {
    downloadId,
    outputName: result.outputName,
    mimeType: 'video/mp4',
    success: true,
    workerCount: 0,
    usedWorkers: false,
    durationMs: transmuxMs,
  };
}

/**
 * Read an OPFS file and create a Blob URL for it.
 *
 * The Blob URL is owned by this offscreen document (Blob URLs are tied to the
 * document that created them). The caller must later send a
 * `REVOKE_OPFS_BLOB_URL` message to release the URL once
 * `chrome.downloads.download` has consumed it.
 *
 * This avoids materializing large video files into `data:` URLs or
 * `ArrayBuffer`s in the service worker.
 */
export async function createOpfsBlobUrl(
  downloadId: string,
  opfsFilename: string,
  mimeType: string,
): Promise<CreateOpfsBlobUrlResultPayload> {
  const dirHandle = await ensureDownloadSubdir(downloadId);
  const file = await opfsReadFile(dirHandle, opfsFilename);

  // If the File already has the right type, use it directly; otherwise slice
  // to override the mime type (slicing a File returns a Blob backed by the
  // same data — no copy).
  const blob =
    file.type === mimeType
      ? file
      : file.slice(0, file.size, mimeType);

  const url = URL.createObjectURL(blob);
  activeBlobUrls.set(url, true);
  console.log(
    `[offscreen-runner] Created Blob URL for ${downloadId}/${opfsFilename} (${file.size} bytes)`,
  );
  return { url };
}

/**
 * Revoke a previously-created Blob URL and remove it from the active set.
 * Safe to call multiple times; no-op if the URL was already revoked.
 */
export function revokeOpfsBlobUrl(url: string): void {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
    console.log('[offscreen-runner] Revoked Blob URL');
  }
}

/** Returns the number of currently-active (un-revoked) Blob URLs. */
export function activeBlobUrlCount(): number {
  return activeBlobUrls.size;
}

/**
 * Start listening for offscreen messages from the background script.
 *
 * Handles three message types:
 *  - `CONVERT_TS_TO_MP4_V2`: transmux `input.ts` → `output.mp4` in OPFS.
 *  - `CREATE_OPFS_BLOB_URL`: read an OPFS file and return a Blob URL.
 *  - `REVOKE_OPFS_BLOB_URL`: revoke a previously-created Blob URL.
 *
 * The listener returns `true` for handled messages so the message channel
 * stays open for the asynchronous response.
 */
export async function startMessageListener(): Promise<void> {
  if (messageListener) {
    return;
  }

  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | undefined => {
    const request = message as MessageRequest;
    const type = request?.type;

    if (type === MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2) {
      const payload = request.payload as ConvertTsToMp4V2Payload;
      // Update parallel settings from the payload before conversion
      if (payload.parallelConversion !== undefined) {
        setParallelSettings({
          parallelConversion: payload.parallelConversion,
          manualWorkerCount: payload.manualWorkerCount ?? 4,
          parallelFallback: payload.parallelFallback ?? 'sequential',
        });
      }
      convertTsToMp4V2(payload.downloadId)
        .then((result: ConvertTsToMp4V2ResultPayload): void => {
          const response: MessageResponse<ConvertTsToMp4V2ResultPayload> = {
            success: result.success,
            data: result,
          };
          sendResponse(response);
        })
        .catch((error: unknown): void => {
          console.error(
            `[offscreen-runner] Conversion failed for ${payload.downloadId}:`,
            error,
          );
          const messageText = error instanceof Error ? error.message : String(error);
          const response: MessageResponse<ConvertTsToMp4V2ResultPayload> = {
            success: false,
            error: messageText || 'Unknown conversion error',
          };
          sendResponse(response);
        });
      return true;
    }

    if (type === MESSAGE_TYPES.CREATE_OPFS_BLOB_URL) {
      const payload = request.payload as CreateOpfsBlobUrlPayload;
      createOpfsBlobUrl(payload.downloadId, payload.opfsFilename, payload.mimeType)
        .then((result: CreateOpfsBlobUrlResultPayload): void => {
          const response: MessageResponse<CreateOpfsBlobUrlResultPayload> = {
            success: true,
            data: result,
          };
          sendResponse(response);
        })
        .catch((error: unknown): void => {
          console.error(
            `[offscreen-runner] createOpfsBlobUrl failed for ${payload.downloadId}:`,
            error,
          );
          const messageText = error instanceof Error ? error.message : String(error);
          const response: MessageResponse<CreateOpfsBlobUrlResultPayload> = {
            success: false,
            error: messageText || 'Failed to create Blob URL',
          };
          sendResponse(response);
        });
      return true;
    }

    if (type === MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL) {
      const payload = request.payload as RevokeOpfsBlobUrlPayload;
      revokeOpfsBlobUrl(payload.url);
      const response: MessageResponse = { success: true };
      sendResponse(response);
      return true;
    }

    if (type === MESSAGE_TYPES.OFFSCREEN_PING) {
      // Synchronous handshake — respond immediately so the background knows
      // the offscreen document's listener is registered and ready.
      const response: MessageResponse = { success: true };
      sendResponse(response);
      return true;
    }

    // Not a message we handle.
    return false;
  };

  messageListener = listener;
  chrome.runtime.onMessage.addListener(listener);
}

/**
 * Stop listening for messages and revoke all active Blob URLs.
 */
export function stopMessageListener(): void {
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }
  // Revoke any Blob URLs that were never explicitly revoked.
  for (const url of activeBlobUrls.keys()) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();
}

/**
 * Reset the message listener.
 *
 * Intended for unit-test isolation; not part of the public runtime API.
 */
export function resetFFmpeg(): void {
  stopMessageListener();
}

// ---------------------------------------------------------------------------
// Runtime bootstrap
//
// When this module is loaded by `ffmpeg.html` as the offscreen document's
// entry point, it must self-register the message listener. Without this,
// `chrome.runtime.sendMessage` from the background returns `undefined`
// (no listener handled the message), and the background crashes with
// "Cannot read properties of undefined (reading 'success')".
//
// Unit tests import this module directly and call `startMessageListener()`
// / `resetFFmpeg()` themselves, so we must NOT double-register. We guard
// with a module-level flag AND only auto-register when running in a real
// extension context (chrome.runtime.onMessage exists and we're not in a
// Jest test environment).
// ---------------------------------------------------------------------------

let bootstrapped = false;

/**
 * Auto-register the message listener when loaded in an offscreen document.
 * Safe to call multiple times — only registers once. Skipped in test
 * environments (Jest sets `process.env.JEST_WORKER_ID`).
 */
function bootstrapOffscreenListener(): void {
  if (bootstrapped) return;
  // Skip in Jest/test environments where tests control listener lifecycle.
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return;
  // Skip if chrome.runtime.onMessage is unavailable (not an extension context).
  if (typeof chrome === 'undefined' || !chrome?.runtime?.onMessage) return;

  bootstrapped = true;
  void startMessageListener().then(() => {
    console.log('[offscreen-runner] Message listener bootstrapped');
  });
}

bootstrapOffscreenListener();

