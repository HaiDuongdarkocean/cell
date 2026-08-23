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
import { transmuxTsToFmp4 } from '@/features/transmux';
import { executeParallelConversion } from '@/features/transmux';
import { readSegmentRanges } from '@/features/transmux';
import {
  ensureDownloadSubdir,
  readFile as opfsReadFile,
} from '@/shared/lib/storage/opfsStorage';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import { ocrMessageListener } from './ocrRunner';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import { encodeBase64 } from '@/shared/lib/base64';
import type {
  ConvertTsToMp4V2Payload,
  ConvertTsToMp4V2ResultPayload,
  ConversionProgressUpdatePayload,
  CreateOpfsBlobUrlPayload,
  CreateOpfsBlobUrlResultPayload,
  RevokeOpfsBlobUrlPayload,
  FetchRequestPayload,
  FetchResponsePayload,
  MessageRequest,
  MessageResponse,
} from '@/entities/message';
import type { Settings, ConversionPhase } from '@/entities/media';

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
  void sendMessage(request).catch(() => {
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

  const dirHandle = await ensureDownloadSubdir(downloadId);
  const inputFile = await opfsReadFile(dirHandle, 'input.ts');
  const fileSize = inputFile.size;

  // Try parallel conversion if enabled
  if (parallelSettings.parallelConversion !== 'off') {
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

          
        },
      );

      // Update the worker count for any final progress broadcasts.
      currentWorkerCount = parallelResult.workerCount ?? 0;

      const totalMs = Math.round(performance.now() - startedAt);
      

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
      
    },
  );
  const transmuxMs = Math.round(performance.now() - transmuxStartedAt);
  

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

    // Debug: log every message received by the offscreen listener.
    console.log('[OFFSCREEN-LISTENER] received:', type);
    try {
      chrome.storage.local.set({ __offscreenListenerMsg: type + '@' + Date.now() }).catch((e: unknown) => {
        console.error('[OFFSCREEN] chrome.storage.local.set rejected:', e);
      });
    } catch (e) {
      console.error('[OFFSCREEN] chrome.storage.local.set threw:', e);
    }

    if (
      type === MESSAGE_TYPES.OCR_INIT ||
      type === MESSAGE_TYPES.OCR_RECOGNIZE ||
      type === MESSAGE_TYPES.OCR_DISPOSE ||
      type === '_OFFSCREEN_OCR_INIT' ||
      type === '_OFFSCREEN_OCR_RECOGNIZE' ||
      type === '_OFFSCREEN_OCR_DISPOSE'
    ) {
      // Normalize _OFFSCREEN_ prefixed types back to the base type for ocrRunner.
      const normalized = type.startsWith('_OFFSCREEN_')
        ? { ...message, type: type.replace('_OFFSCREEN_', '') }
        : message;
      return ocrMessageListener(normalized, _sender, sendResponse);
    }

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

    if (type === MESSAGE_TYPES.FETCH_REQUEST) {
      // M15: delegate fetch() from SW to offscreen (SW idle eviction safety).
      // Offscreen persists for the fetch duration — no silent abort.
      const payload = request.payload as FetchRequestPayload;
      void (async () => {
        try {
          const response = await fetchWithTimeout(payload.url, {
            method: payload.options?.method ?? 'GET',
            headers: payload.options?.headers,
            credentials: payload.options?.credentials ?? 'same-origin',
          });
          let content: string;
          if (payload.options?.responseType === 'arraybuffer') {
            content = encodeBase64(await response.arrayBuffer());
          } else {
            content = await response.text();
          }
          const result: FetchResponsePayload = {
            ok: response.ok,
            status: response.status,
            content,
            finalUrl: response.url || payload.url,
          };
          sendResponse({ success: true, data: result } satisfies MessageResponse<FetchResponsePayload>);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          const result: FetchResponsePayload = {
            ok: false,
            status: 0,
            content: '',
            finalUrl: payload.url,
            error: msg,
          };
          sendResponse({ success: true, data: result } satisfies MessageResponse<FetchResponsePayload>);
        }
      })();
      return true;
    }

    // Not a message we handle.
    return false;
  };

  messageListener = listener;
  onMessage(listener);
}

/**
 * Stop listening for messages and revoke all active Blob URLs.
 */
export function stopMessageListener(): void {
  if (messageListener) {
    removeOnMessageListener(messageListener);
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
  console.log('[OFFSCREEN] bootstrapOffscreenListener start');
  try { chrome.storage.local.set({ __ffmpegBootstrap: 'start@' + Date.now() }).catch(() => {}); } catch {}
  void startMessageListener().then(() => {
    console.log('[OFFSCREEN] startMessageListener done');
    try { chrome.storage.local.set({ __ffmpegBootstrap: 'done@' + Date.now() }).catch(() => {}); } catch {}
  }).catch((e) => {
    console.error('[OFFSCREEN] startMessageListener error:', e);
    try { chrome.storage.local.set({ __ffmpegBootstrap: 'error:' + String(e)?.slice(0, 200) }).catch(() => {}); } catch {}
  });
}

bootstrapOffscreenListener();
// Debug: log script load to chrome.storage.local.
console.log('[OFFSCREEN] ffmpegRunner.ts script loaded');
try { chrome.storage.local.set({ __ffmpegScriptLoaded: true, __ffmpegLoadTime: Date.now() }).catch((e: unknown) => {
  console.error('[OFFSCREEN] __ffmpegScriptLoaded storage.set rejected:', e);
}); } catch (e) {
  console.error('[OFFSCREEN] __ffmpegScriptLoaded storage.set threw:', e);
}

