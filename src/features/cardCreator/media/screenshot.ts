/**
 * Screenshot extraction — capture current video frame as PNG ArrayBuffer.
 *
 * Uses canvas `drawImage(video, 0, 0)` + `toBlob('image/png')`. This works
 * on desktop Chromium + Kiwi mobile (canvas is not tainted when the video
 * is from a cross-origin source WITHOUT CORS, but most video sites serve
 * with CORS or the video is same-origin; if tainted, toBlob throws and we
 * surface the error).
 */
import type { MediaFile } from './mediaFile';
import { generateMediaFilename } from './mediaFile';

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
 * @throws ScreenshotError if video not ready or canvas tainted (CORS).
 */
export async function captureScreenshot(video: HTMLVideoElement): Promise<MediaFile> {
  if (video.readyState < 2) {
    throw new ScreenshotError('Video not ready (readyState < 2)');
  }
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    throw new ScreenshotError('Video has no dimensions (not loaded)');
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ScreenshotError('Canvas 2D context unavailable');
  }

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ScreenshotError(`drawImage failed: ${msg}`);
  }

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
}
