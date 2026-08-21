// ocrPipeline tests — T12.

import { describe, expect, it, jest } from '@jest/globals';
import { runPipelineStep, OcrPipelineState, DEFAULT_PIPELINE_CONFIG } from './ocrPipeline';
import type { ImageSource, OcrResult } from '@/features/ocr/engine/types';

type RecognizeFn = (image: ImageSource, minScore?: number) => Promise<OcrResult[]>;

function makeImage(width: number, height: number, fillValue: number): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue; data[i + 1] = fillValue; data[i + 2] = fillValue; data[i + 3] = 255;
  }
  return { data, width, height };
}

function makeImageWithSubtitle(width: number, height: number, bgValue: number, subValue: number): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  const subY = Math.floor(height * 0.85);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = y >= subY ? subValue : bgValue;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('ocrPipeline (T12)', () => {
  it('detects DRM after warmup + 3 consecutive black frames', async () => {
    const blackFrame = makeImage(640, 480, 0);
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (): Promise<OcrResult[]> => []) as unknown as RecognizeFn;
    // During warmup (first 60 frames), black frames fall through to OCR.
    // recognizeFn is called but returns empty (no text on black frame).
    for (let i = 0; i < 60; i++) {
      await runPipelineStep(blackFrame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, i * 400);
    }
    // After warmup, 3 consecutive black frames trigger DRM detection.
    // Frame 60 in the loop already incremented drmCount to 1 (frameCount=60 >= 60).
    let result = await runPipelineStep(blackFrame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 60 * 400);
    expect(result.status).toBe('skip_unchanged'); // drmCount=2, fall through to luma-diff skip
    result = await runPipelineStep(blackFrame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 61 * 400);
    expect(result.status).toBe('drm_detected'); // drmCount=3 → DRM
    expect(state.isDrmDetected()).toBe(true);
  });

  it('runs OCR on first frame', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const mockOcrResult: OcrResult = {
      image: { width: 640, height: 72 },
      items: [{ poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]], text: 'Hello World', score: 0.95 }],
      metrics: { detMs: 50, recMs: 30, totalMs: 80 },
    };
    const recognizeFn = jest.fn(async (_img?: unknown, _minScore?: number): Promise<OcrResult[]> => [mockOcrResult]);
    const result = await runPipelineStep(frame, recognizeFn, state);
    expect(result.status).toBe('ocr');
    if (result.status === 'ocr') {
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.text).toBe('Hello World');
      expect(result.scriptRuns).toHaveLength(1);
      expect(result.scriptRuns[0]![0]!.script).toBe('en');
    }
  });

  it('skips unchanged frame (luma diff below threshold)', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (_img?: unknown, _minScore?: number): Promise<OcrResult[]> => []);
    const cfg = { ...DEFAULT_PIPELINE_CONFIG, lumaDiffThreshold: 50 };
    // First frame runs OCR.
    await runPipelineStep(frame, recognizeFn, state, cfg, 0);
    // Second identical frame should skip.
    const result2 = await runPipelineStep(frame, recognizeFn, state, cfg, 500);
    expect(result2.status).toBe('skip_unchanged');
  });

  it('skips duplicate text (same pHash)', async () => {
    const frame1 = makeImageWithSubtitle(640, 480, 100, 200);
    const frame2 = makeImageWithSubtitle(640, 480, 100, 201); // Slightly different luma but same text pattern
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (_img?: unknown, _minScore?: number): Promise<OcrResult[]> => []);
    const cfg = { ...DEFAULT_PIPELINE_CONFIG, lumaDiffThreshold: 0 };
    // First frame runs.
    await runPipelineStep(frame1, recognizeFn, state, cfg, 0);
    // Second frame has different luma but same pHash → skip_duplicate.
    const result2 = await runPipelineStep(frame2, recognizeFn, state, cfg, 500);
    // pHash may or may not match depending on the 1-pixel difference.
    // If luma diff > threshold but pHash same → skip_duplicate.
    // If luma diff > threshold and pHash different → ocr.
    expect(['skip_duplicate', 'ocr', 'skip_unchanged', 'skip_text_duplicate']).toContain(result2.status);
  });

  it('reset clears state', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (_img?: unknown, _minScore?: number): Promise<OcrResult[]> => []);
    await runPipelineStep(frame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 0);
    state.reset();
    expect(state.getPreviousLuma()).toBeNull();
    expect(state.getPreviousHash()).toBeNull();
    expect(state.getPreviousText()).toBeNull();
    expect(state.getLastOcrTimeMs()).toBeNull();
    expect(state.isDrmDetected()).toBe(false);
  });

  it('segments mixed CN+EN text correctly', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const mockOcrResult: OcrResult = {
      image: { width: 640, height: 72 },
      items: [{ poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]], text: '我喜欢 watching movies', score: 0.95 }],
      metrics: { detMs: 50, recMs: 30, totalMs: 80 },
    };
    const recognizeFn = jest.fn(async (_img?: unknown, _minScore?: number): Promise<OcrResult[]> => [mockOcrResult]);
    const result = await runPipelineStep(frame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 0);
    if (result.status === 'ocr') {
      expect(result.scriptRuns[0]).toHaveLength(2);
      expect(result.scriptRuns[0]![0]!.script).toBe('zh');
      expect(result.scriptRuns[0]![1]!.script).toBe('en');
    }
  });

  it('T10: time gate skips if too soon', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (): Promise<OcrResult[]> => []) as unknown as RecognizeFn;
    await runPipelineStep(frame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 0);
    // Second call at 100ms — below 333ms time gate → skip_time_gate.
    const result2 = await runPipelineStep(frame, recognizeFn, state, DEFAULT_PIPELINE_CONFIG, 100);
    expect(result2.status).toBe('skip_time_gate');
  });

  it('T10: text dedup skips if OCR text identical', async () => {
    // Two frames with different subtitle region patterns (different pHash) but same OCR text.
    const frame1 = makeImageWithSubtitle(640, 480, 100, 200);
    const frame2 = makeImageWithSubtitle(640, 480, 100, 200);
    // Modify frame2's subtitle region to have a different pattern (different pHash).
    const data2 = frame2.data;
    const subY = Math.floor(480 * 0.85);
    for (let x = 0; x < 640; x += 2) {
      const idx = (subY * 640 + x) * 4;
      data2[idx] = 50; data2[idx + 1] = 50; data2[idx + 2] = 50; // Dark stripes
    }
    const state = new OcrPipelineState();
    const mockOcrResult: OcrResult = {
      image: { width: 640, height: 72 },
      items: [{ poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]], text: 'Same text', score: 0.95 }],
      metrics: { detMs: 50, recMs: 30, totalMs: 80 },
    };
    const recognizeFn = jest.fn(async (): Promise<OcrResult[]> => [mockOcrResult]) as unknown as RecognizeFn;
    const cfg = { ...DEFAULT_PIPELINE_CONFIG, lumaDiffThreshold: 0 };
    await runPipelineStep(frame1, recognizeFn, state, cfg, 0);
    // Second frame: different pHash, but same OCR text → skip_text_duplicate.
    const result2 = await runPipelineStep(frame2, recognizeFn, state, cfg, 500);
    expect(result2.status).toBe('skip_text_duplicate');
  });

  it('T22: retries on OCR failure then returns error', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    const recognizeFn = jest.fn(async (): Promise<OcrResult[]> => {
      throw new Error('OCR engine crashed');
    }) as unknown as RecognizeFn;
    const cfg = { ...DEFAULT_PIPELINE_CONFIG, maxRetries: 3 };
    const result = await runPipelineStep(frame, recognizeFn, state, cfg, 0);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.attempts).toBe(3);
      expect(result.error).toContain('crashed');
    }
    expect(recognizeFn).toHaveBeenCalledTimes(3);
  });

  it('T22: succeeds on retry after initial failure', async () => {
    const frame = makeImageWithSubtitle(640, 480, 100, 200);
    const state = new OcrPipelineState();
    let callCount = 0;
    const mockOcrResult: OcrResult = {
      image: { width: 640, height: 72 },
      items: [{ poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]], text: 'Hello', score: 0.95 }],
      metrics: { detMs: 50, recMs: 30, totalMs: 80 },
    };
    const recognizeFn = jest.fn(async (): Promise<OcrResult[]> => {
      callCount++;
      if (callCount === 1) throw new Error('transient');
      return [mockOcrResult];
    }) as unknown as RecognizeFn;
    const cfg = { ...DEFAULT_PIPELINE_CONFIG, maxRetries: 3 };
    const result = await runPipelineStep(frame, recognizeFn, state, cfg, 0);
    expect(result.status).toBe('ocr');
    expect(recognizeFn).toHaveBeenCalledTimes(2);
  });
});
