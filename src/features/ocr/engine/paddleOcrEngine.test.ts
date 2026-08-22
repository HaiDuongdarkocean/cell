// PaddleOcrEngine tests — T4. Uses mock PaddleOCR.js module.
// Real OCR integration tested in T4 browser test + T25 full browser test.

import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Mock @paddleocr/paddleocr-js before importing PaddleOcrEngine.
const mockPredict = jest.fn((_input?: unknown) => Promise.resolve(undefined as unknown));
const mockInitialize = jest.fn(() => Promise.resolve(undefined as unknown));
const mockCreate = jest.fn((_config?: unknown) => Promise.resolve(undefined as unknown));

jest.mock('@paddleocr/paddleocr-js', () => ({
  PaddleOCR: { create: mockCreate },
}), { virtual: true });

// Mock @techstark/opencv-js — dynamically imported inside initialize().
// __esModule: true ensures (await import(...)).default returns the mock object.
// calledRun=true → pre-init logic skips await (cv-already-ready path).
jest.mock('@techstark/opencv-js', () => ({
  __esModule: true,
  default: {
    Mat: jest.fn(() => ({ delete: jest.fn() })),
    CV_8UC1: 0,
    imread: jest.fn(() => ({ delete: jest.fn() })),
    calledRun: true,
  },
}));

// Mock chrome-apis getURL — chrome.runtime.getURL not available in jsdom.
jest.mock('@/shared/lib/chrome-apis', () => ({
  getURL: (path: string) => `chrome-extension://mock/${path}`,
}));

import { PaddleOcrEngine } from './paddleOcrEngine';
import type { ImageSource, OcrConfig } from './types';

beforeEach(() => {
  jest.clearAllMocks();
  mockPredict.mockReset();
  mockInitialize.mockReset();
  mockCreate.mockReset();
  // Default mock: create returns instance with predict + initialize.
  mockCreate.mockResolvedValue({
    predict: mockPredict,
    initialize: mockInitialize,
  });
  mockInitialize.mockResolvedValue({ backend: 'webgpu', webgpuAvailable: true });
});

// Stub OffscreenCanvas + ImageData for jsdom (not available in test env).
// ponytail: real browser has these natively — stub is test-only.
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() {
    return {
      putImageData: jest.fn(),
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
    };
  }
}
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockOffscreenCanvas;

describe('PaddleOcrEngine (T4)', () => {
  const config: OcrConfig = {
    languageMode: 'auto',
    backend: 'webgpu',
    wasmPaths: 'chrome-extension://mock/wasm/',
  };

  it('implements OcrEngine interface', () => {
    const engine = new PaddleOcrEngine();
    expect(typeof engine.initialize).toBe('function');
    expect(typeof engine.recognize).toBe('function');
    expect(typeof engine.dispose).toBe('function');
  });

  it('initialize calls PaddleOCR.create with correct params', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'ch',
        ocrVersion: 'PP-OCRv5',
        textDetectionModelName: 'PP-OCRv5_mobile_det',
        textRecognitionModelName: 'PP-OCRv5_mobile_rec',
        ortOptions: expect.objectContaining({
          backend: 'webgpu',
          numThreads: 1,
          simd: true,
        }),
      }),
    );
  });

  it('initialize is idempotent — second call does not re-create', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config);
    await engine.initialize(config);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('recognize throws if not initialized', async () => {
    const engine = new PaddleOcrEngine();
    const image: ImageSource = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    await expect(engine.recognize(image)).rejects.toThrow('not initialized');
  });

  it('recognize returns adapted OcrResult[]', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config);

    mockPredict.mockResolvedValueOnce([{
      image: { width: 800, height: 200 },
      items: [
        { poly: [[277, 64], [524, 67], [524, 125], [277, 123]], text: '我喜欢北京', score: 1.0 },
      ],
      metrics: { detMs: 167, recMs: 94, totalMs: 261 },
    }]);

    const image: ImageSource = {
      data: new Uint8ClampedArray(800 * 200 * 4),
      width: 800,
      height: 200,
    };
    const results = await engine.recognize(image);
    expect(results).toHaveLength(1);
    expect(results[0]!.items).toHaveLength(1);
    expect(results[0]!.items[0]!.text).toBe('我喜欢北京');
    expect(results[0]!.items[0]!.score).toBe(1.0);
    expect(results[0]!.image.width).toBe(800);
    expect(results[0]!.image.height).toBe(200);
  });

  it('recognize applies minScore filter', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config);

    mockPredict.mockResolvedValueOnce([{
      image: { width: 800, height: 200 },
      items: [
        { poly: [[0, 0], [100, 0], [100, 50], [0, 50]], text: 'high', score: 0.95 },
        { poly: [[0, 0], [100, 0], [100, 50], [0, 50]], text: 'low', score: 0.3 },
      ],
      metrics: { detMs: 100, recMs: 50, totalMs: 150 },
    }]);

    const image: ImageSource = {
      data: new Uint8ClampedArray(800 * 200 * 4),
      width: 800,
      height: 200,
    };
    const results = await engine.recognize(image, { minScore: 0.5 });
    expect(results[0]!.items).toHaveLength(1);
    expect(results[0]!.items[0]!.text).toBe('high');
  });

  it('dispose releases instance', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config);
    expect(engine.getBackend()).toBe('webgpu');
    await engine.dispose();
    expect(engine.getBackend()).toBeNull();
    // After dispose, recognize should throw.
    const image: ImageSource = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    await expect(engine.recognize(image)).rejects.toThrow('not initialized');
  });

  it('maps language modes to PaddleOCR lang param', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize({ ...config, languageMode: 'ch' });
    expect(mockCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ lang: 'ch' }),
    );
  });

  // ─── Model resolution (spec ocr-split-dual-stream, ADR-082) ───

  it('default model (auto) keeps bundled recognition asset', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize(config); // languageMode 'auto'
    expect(mockCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lang: 'ch',
        textRecognitionModelAsset: { url: expect.stringContaining('PP-OCRv5_mobile_rec_onnx_infer.tar') },
      }),
    );
  });

  it('japan (catalog: shares default model) keeps bundled asset, lang ch', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize({ ...config, languageMode: 'japan' });
    expect(mockCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lang: 'ch',
        textRecognitionModelAsset: { url: expect.stringContaining('PP-OCRv5_mobile_rec_onnx_infer.tar') },
      }),
    );
  });

  it('non-default model (vi → latin) omits recognition asset — CDN resolves by lang', async () => {
    const engine = new PaddleOcrEngine();
    await engine.initialize({ ...config, languageMode: 'vi' });
    const createOptions = mockCreate.mock.lastCall?.[0] as Record<string, unknown> | undefined;
    expect(createOptions).toMatchObject({
      lang: 'vi',
      ocrVersion: 'PP-OCRv5',
      textRecognitionModelName: 'PP-OCRv5_mobile_rec',
      // Detection model stays bundled for every lang.
      textDetectionModelAsset: { url: expect.stringContaining('PP-OCRv5_mobile_det_onnx_infer.tar') },
    });
    expect(createOptions?.textRecognitionModelAsset).toBeUndefined();
  });

  it('wasmPaths passed to ortOptions (MV3 bundle requirement)', async () => {
    const engine = new PaddleOcrEngine();
    const customPaths = 'chrome-extension://abc/dist/wasm/';
    await engine.initialize({ ...config, wasmPaths: customPaths });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        ortOptions: expect.objectContaining({
          wasmPaths: customPaths,
        }),
      }),
    );
  });
});
