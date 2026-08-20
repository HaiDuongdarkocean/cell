// frameCapture — T8. Capture video frame → ImageSource via rVFC + canvas.
// spec §AD5: ImageData (Uint8ClampedArray) via structured clone, NOT ImageBitmap.

import type { ImageSource } from '@/features/ocr/engine/types';

/** Capture a single video frame as ImageSource (RGBA Uint8ClampedArray). */
export function captureFrame(
  video: HTMLVideoElement,
  canvas?: OffscreenCanvas | HTMLCanvasElement,
): ImageSource {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error('Video not ready — no videoWidth/Height.');

  // Reuse canvas if provided (avoids allocation per frame).
  const c = canvas ?? new OffscreenCanvas(width, height);
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;

  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get 2d context for frame capture.');

  ctx.drawImage(video, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    data: imageData.data,
    width,
    height,
  };
}

/** Schedule a callback on the next video frame via rVFC (with rAF fallback). */
export function scheduleNextFrame(
  video: HTMLVideoElement,
  callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
): void {
  // ponytail: 'in' check narrows to never in TS — cast to record.
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameCallbackMetadata) => void) => void };
  if (typeof v.requestVideoFrameCallback === 'function') {
    v.requestVideoFrameCallback(callback);
  } else {
    requestAnimationFrame(() => callback(performance.now(), {
      mediaTime: video.currentTime,
      presentedFrames: 0,
      expectedDisplayTime: 0,
      width: video.videoWidth,
      height: video.videoHeight,
    } as unknown as VideoFrameCallbackMetadata));
  }
}

/** VideoFrameCallbackMetadata — minimal type for browsers without rVFC. */
export interface VideoFrameCallbackMetadata {
  readonly mediaTime: number;
  readonly presentedFrames: number;
  readonly expectedDisplayTime: number;
  readonly width: number;
  readonly height: number;
}
