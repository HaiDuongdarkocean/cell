// PaddleOcrEngine tests — T1 skeleton. Real OCR tests in T4 with mock PaddleOCR.

import { describe, expect, it } from '@jest/globals';
import { PaddleOcrEngine } from './paddleOcrEngine';
import type { ImageSource, OcrConfig } from './types';

describe('PaddleOcrEngine (T1 skeleton)', () => {
  it('implements OcrEngine interface', () => {
    const engine = new PaddleOcrEngine();
    expect(typeof engine.initialize).toBe('function');
    expect(typeof engine.recognize).toBe('function');
    expect(typeof engine.dispose).toBe('function');
  });

  it('initialize throws NOT_IMPLEMENTED', async () => {
    const engine = new PaddleOcrEngine();
    const config: OcrConfig = {
      languageMode: 'auto',
      backend: 'webgpu',
      wasmPaths: 'chrome-extension://mock/wasm/',
    };
    await expect(engine.initialize(config)).rejects.toThrow('NOT_IMPLEMENTED');
  });

  it('recognize throws NOT_IMPLEMENTED', async () => {
    const engine = new PaddleOcrEngine();
    const image: ImageSource = {
      data: new Uint8ClampedArray(16),
      width: 2,
      height: 2,
    };
    await expect(engine.recognize(image)).rejects.toThrow('NOT_IMPLEMENTED');
  });

  it('dispose throws NOT_IMPLEMENTED', async () => {
    const engine = new PaddleOcrEngine();
    await expect(engine.dispose()).rejects.toThrow('NOT_IMPLEMENTED');
  });
});
