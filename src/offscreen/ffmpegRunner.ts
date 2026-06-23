/**
 * ffmpeg.wasm runner that executes inside an MV3 offscreen document.
 *
 * MV3 service workers cannot run WebAssembly, so all ffmpeg.wasm work is
 * delegated to this offscreen document. The background script creates the
 * offscreen document and communicates with it via `chrome.runtime` messages
 * of type `CONVERT_TS_TO_MP4`.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { MESSAGE_TYPES } from '@/constants/messages';
import type {
  ConvertTsToMp4Payload,
  ConvertTsToMp4ResultPayload,
  MessageRequest,
  MessageResponse,
} from '@/types/message';

/** Singleton ffmpeg.wasm instance. */
let ffmpeg: FFmpeg | null = null;

/** Currently-registered message listener (kept so it can be removed). */
let messageListener:
  | ((
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | undefined)
  | null = null;

/**
 * Initialize the ffmpeg.wasm core (idempotent / singleton).
 *
 * On first call a new {@link FFmpeg} instance is created and the core is
 * loaded from the bundled `ffmpeg/ffmpeg-core.js` resource. Subsequent calls
 * return the existing instance without reloading.
 *
 * @returns The ready-to-use {@link FFmpeg} instance.
 */
export async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  const instance = new FFmpeg();
  const coreURL = chrome.runtime.getURL('ffmpeg/ffmpeg-core.js');
  await instance.load({ coreURL });
  ffmpeg = instance;
  return instance;
}

/**
 * Convert an ordered list of `.ts` segment buffers into a single MP4 file
 * using ffmpeg.wasm.
 *
 * Steps:
 *  1. Ensure ffmpeg is initialized.
 *  2. Write each segment to the virtual FS as `segment_<i>.ts`.
 *  3. Concat + transcode to `output.mp4` with stream copy (`-c copy`).
 *  4. Read `output.mp4` back from the virtual FS.
 *  5. Delete all temporary files (segments + output).
 *  6. Return the MP4 data as an `ArrayBuffer`.
 *
 * @param segments - Ordered `.ts` segment buffers (segments[0] first).
 * @param downloadId - Identifier for the originating download (for logging).
 * @returns MP4 file content as an `ArrayBuffer`.
 */
export async function convertTsToMp4(
  segments: ArrayBuffer[],
  downloadId: string,
): Promise<ArrayBuffer> {
  const instance = await initFFmpeg();

  const segmentNames: string[] = [];

  // 1. Write each segment to the virtual FS.
  for (let i = 0; i < segments.length; i++) {
    const name = `segment_${i}.ts`;
    segmentNames.push(name);
    const data = await fetchFile(new Blob([segments[i]]));
    await instance.writeFile(name, data as FileData);
  }

  // 2. Concat + transcode.
  const concatInput = `concat:${segmentNames.join('|')}`;
  await instance.exec(['-i', concatInput, '-c', 'copy', 'output.mp4']);

  // 3. Read the resulting mp4.
  const output = await instance.readFile('output.mp4');

  // 4. Clean up temp files.
  for (const name of segmentNames) {
    await instance.deleteFile(name);
  }
  await instance.deleteFile('output.mp4');

  console.debug(`[ffmpegRunner] Converted ${segments.length} segments for ${downloadId}`);

  return fileDataToArrayBuffer(output);
}

/**
 * Start listening for `CONVERT_TS_TO_MP4` messages from the background script.
 *
 * On receipt, runs {@link convertTsToMp4} with the payload's segments and
 * responds with a {@link MessageResponse} containing the
 * {@link ConvertTsToMp4ResultPayload}. The listener returns `true` so the
 * message channel stays open for the asynchronous response.
 */
export function startMessageListener(): void {
  if (messageListener) {
    return;
  }

  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | undefined => {
    const request = message as MessageRequest;
    if (request?.type !== MESSAGE_TYPES.CONVERT_TS_TO_MP4) {
      return false;
    }

    const payload = request.payload as ConvertTsToMp4Payload;

    convertTsToMp4(payload.segments, payload.downloadId)
      .then((mp4Data: ArrayBuffer): void => {
        const result: ConvertTsToMp4ResultPayload = {
          downloadId: payload.downloadId,
          mp4Data,
          success: true,
        };
        const response: MessageResponse<ConvertTsToMp4ResultPayload> = {
          success: true,
          data: result,
        };
        sendResponse(response);
      })
      .catch((error: unknown): void => {
        const messageText =
          error instanceof Error ? error.message : 'Unknown conversion error';
        const response: MessageResponse<ConvertTsToMp4ResultPayload> = {
          success: false,
          error: messageText,
        };
        sendResponse(response);
      });

    // Keep the message channel open for the async response.
    return true;
  };

  messageListener = listener;
  chrome.runtime.onMessage.addListener(listener);
}

/**
 * Stop listening for conversion messages and clear the registered listener.
 */
export function stopMessageListener(): void {
  if (!messageListener) {
    return;
  }
  chrome.runtime.onMessage.removeListener(messageListener);
  messageListener = null;
}

/**
 * Reset the ffmpeg singleton and message listener.
 *
 * Intended for unit-test isolation; not part of the public runtime API.
 */
export function resetFFmpeg(): void {
  stopMessageListener();
  ffmpeg = null;
}

/**
 * Convert an ffmpeg.wasm {@link FileData} result (Uint8Array | string) into
 * an `ArrayBuffer`.
 */
function fileDataToArrayBuffer(data: FileData): ArrayBuffer {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data).buffer as ArrayBuffer;
  }
  // Copy the Uint8Array's underlying bytes into a standalone ArrayBuffer so
  // the returned buffer is not backed by the (transient) wasm memory view.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer as ArrayBuffer;
}
