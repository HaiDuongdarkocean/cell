/**
 * Screenshot extraction — capture current video frame as PNG ArrayBuffer.
 *
 * Primary: canvas `drawImage(video, 0, 0)` + `toBlob('image/png')`. This works
 * on desktop Chromium + Kiwi mobile when the video is same-origin or has CORS.
 *
 * Fallback: when canvas is tainted (cross-origin video without CORS, e.g.
 * kisskh.co CDN), `toBlob` returns null. We then fall back to
 * `chrome.tabs.captureVisibleTab` via the background script, which captures
 * the visible tab without canvas taint. The fallback captures the full tab,
 * not just the video frame, but this is better than no screenshot.
 */
import type { MediaFile } from './mediaFile';
import { generateMediaFilename } from './mediaFile';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';

/** Error thrown when screenshot capture fails. */
export class ScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

/**
 * Capture the current frame of a `<video>` element as a PNG MediaFile.
 *
 * @param video - The video element to capture from. Must have
 *                `readyState ≥ 2` (HAVE_CURRENT_DATA).
 * @returns MediaFile with kind='image', mimeType='image/png'.
 * @throws ScreenshotError if video not ready or both canvas + API fallback fail.
 */
export async function captureScreenshot(video: HTMLVideoElement): Promise<MediaFile> {
  // When video is paused, readyState may be < 2 or videoWidth may be 0.
  // Try the API fallback (captureVisibleTab) first in that case — it captures
  // the visible tab regardless of video state.
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    const apiResult = await captureScreenshotViaApi();
    if (apiResult) return apiResult;
    throw new ScreenshotError('Video not ready and captureVisibleTab failed');
  }

  // --- Primary: canvas drawImage + toBlob ---
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ScreenshotError('Canvas 2D context unavailable');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) {
      throw new ScreenshotError('toBlob returned null (canvas may be tainted)');
    }

    const data = await blob.arrayBuffer();
    return {
      kind: 'image',
      filename: generateMediaFilename('screenshot', 'png'),
      mimeType: 'image/png',
      data,
    };
  } catch (canvasErr) {
    // Canvas failed (taint / CORS / drawImage error) — try API fallback.
    const apiResult = await captureScreenshotViaApi();
    if (apiResult) return apiResult;
    // Both paths failed — rethrow the original canvas error.
    throw canvasErr instanceof Error ? canvasErr : new ScreenshotError(String(canvasErr));
  }
}

/**
 * Fallback: capture the visible tab via `chrome.tabs.captureVisibleTab`.
 * Returns a full-tab PNG (not just the video frame). Returns null if the
 * API is unavailable or fails (e.g. tab not focused, permission denied).
 */
async function captureScreenshotViaApi(): Promise<MediaFile | null> {
  try {
    const response = await sendMessage<{
      success: boolean;
      data?: { dataUrl: string };
      error?: string;
    }>({ type: MESSAGE_TYPES.CAPTURE_TAB_SCREENSHOT });
    if (!response?.success || !response.data?.dataUrl) return null;

    const dataUrl = response.data.dataUrl;
    // data URL → Blob → ArrayBuffer
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const data = await blob.arrayBuffer();
    return {
      kind: 'image',
      filename: generateMediaFilename('screenshot', 'png'),
      mimeType: 'image/png',
      data,
    };
  } catch {
    return null;
  }
}
