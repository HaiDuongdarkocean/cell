// frameCapture tests — T8.

import { describe, expect, it, jest } from '@jest/globals';
import { captureFrame } from './frameCapture';

// Stub OffscreenCanvas for jsdom.
class MockCanvas {
  width = 0;
  height = 0;
  private ctx: { drawImage: jest.Mock; getImageData: jest.Mock };
  constructor(w: number, h: number) {
    this.width = w; this.height = h;
    this.ctx = {
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    };
  }
  getContext() { return this.ctx; }
}
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockCanvas;

describe('captureFrame (T8)', () => {
  it('captures frame from video with valid dimensions', () => {
    const video = { videoWidth: 640, videoHeight: 480 } as unknown as HTMLVideoElement;
    const frame = captureFrame(video);
    expect(frame.width).toBe(640);
    expect(frame.height).toBe(480);
    expect(frame.data.length).toBe(640 * 480 * 4);
  });

  it('throws if video not ready', () => {
    const video = { videoWidth: 0, videoHeight: 0 } as unknown as HTMLVideoElement;
    expect(() => captureFrame(video)).toThrow('not ready');
  });

  it('reuses provided canvas', () => {
    const video = { videoWidth: 320, videoHeight: 240 } as unknown as HTMLVideoElement;
    const canvas = new MockCanvas(100, 100);
    const frame = captureFrame(video, canvas as unknown as OffscreenCanvas);
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(frame.width).toBe(320);
  });
});
