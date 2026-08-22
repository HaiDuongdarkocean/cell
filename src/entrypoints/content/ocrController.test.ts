// ocrController tests — T7. Mock chrome.runtime.sendMessage.

import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import { OcrController } from './ocrController';
import type { ImageSource } from '@/features/ocr/engine/types';

const sendMessageMock = jest.fn((_msg?: unknown) => Promise.resolve(undefined as unknown));

beforeAll(() => {
  const g = global as unknown as { __cellSendMessage?: unknown };
  g.__cellSendMessage = sendMessageMock;
});

beforeEach(() => {
  sendMessageMock.mockReset();
});

describe('OcrController (T7)', () => {
  it('init sends OCR_INIT and returns ready status', async () => {
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: { status: 'ready', backend: 'webgpu' },
    });
    const ctrl = new OcrController();
    const result = await ctrl.init('auto', 'webgpu');
    expect(result.status).toBe('ready');
    expect(result.backend).toBe('webgpu');
    expect(ctrl.isInitialized()).toBe(true);
    expect(ctrl.getBackend()).toBe('webgpu');
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'OCR_INIT',
      payload: { languageMode: 'auto', backend: 'webgpu' },
    });
  });

  it('init returns error on failure', async () => {
    sendMessageMock.mockResolvedValueOnce({
      success: false,
      error: 'WebGPU unavailable',
    });
    const ctrl = new OcrController();
    const result = await ctrl.init('auto', 'webgpu');
    expect(result.status).toBe('error');
    expect(ctrl.isInitialized()).toBe(false);
  });

  it('recognize throws if not initialized', async () => {
    const ctrl = new OcrController();
    const image: ImageSource = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    await expect(ctrl.recognize(image)).rejects.toThrow('not initialized');
  });

  it('recognize sends OCR_RECOGNIZE and returns results', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'webgpu' } });
    const ctrl = new OcrController();
    await ctrl.init();

    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: {
        results: [{
          image: { width: 800, height: 200 },
          items: [{ poly: [[0, 0], [100, 0], [100, 50], [0, 50]], text: 'test', score: 0.95 }],
          metrics: { detMs: 100, recMs: 50, totalMs: 150 },
        }],
      },
    });

    const image: ImageSource = {
      data: new Uint8ClampedArray(800 * 200 * 4),
      width: 800,
      height: 200,
    };
    const results = await ctrl.recognize(image, 0.5);
    expect(results).toHaveLength(1);
    expect(results[0]!.items[0]!.text).toBe('test');
    // chrome.runtime.sendMessage uses JSON serialization — Uint8ClampedArray
    // becomes {}, so OcrController converts to a regular Array before sending.
    expect(sendMessageMock).toHaveBeenLastCalledWith({
      type: 'OCR_RECOGNIZE',
      payload: { image: { data: Array.from(image.data), width: image.width, height: image.height }, minScore: 0.5 },
    });
  });

  it('recognize throws on error response', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'webgpu' } });
    const ctrl = new OcrController();
    await ctrl.init();

    sendMessageMock.mockResolvedValueOnce({ success: false, error: 'Engine disposed' });
    const image: ImageSource = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    await expect(ctrl.recognize(image)).rejects.toThrow('Engine disposed');
  });

  it('dispose sends OCR_DISPOSE and resets state', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'webgpu' } });
    const ctrl = new OcrController();
    await ctrl.init();
    expect(ctrl.isInitialized()).toBe(true);

    sendMessageMock.mockResolvedValueOnce({ success: true, data: { ok: true } });
    await ctrl.dispose();
    expect(ctrl.isInitialized()).toBe(false);
    expect(ctrl.getBackend()).toBeNull();
  });

  it('dispose is no-op if not initialized', async () => {
    const ctrl = new OcrController();
    await ctrl.dispose();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

describe('OcrController engineKey routing (Task 5)', () => {
  it('init plumbs engineKey into payload and tracks the key', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'wasm' } });
    const ctrl = new OcrController();
    await ctrl.init('fr', 'wasm', 'latin');
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'OCR_INIT',
      payload: { languageMode: 'fr', backend: 'wasm', engineKey: 'latin' },
    });
    expect(ctrl.isInitialized()).toBe(true);
  });

  it('init without engineKey omits the field (backward compat → default model offscreen)', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'wasm' } });
    const ctrl = new OcrController();
    await ctrl.init('auto', 'webgpu');
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'OCR_INIT',
      payload: { languageMode: 'auto', backend: 'webgpu' },
    });
  });

  it('recognize plumbs engineKey into payload', async () => {
    sendMessageMock.mockResolvedValueOnce({ success: true, data: { status: 'ready', backend: 'wasm' } });
    const ctrl = new OcrController();
    await ctrl.init('ru', 'wasm', 'eslav');

    sendMessageMock.mockResolvedValueOnce({ success: true, data: { results: [] } });
    const image: ImageSource = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    await ctrl.recognize(image, 0.5, 'eslav');
    expect(sendMessageMock).toHaveBeenLastCalledWith({
      type: 'OCR_RECOGNIZE',
      payload: { image: { data: Array.from(image.data), width: 2, height: 2 }, minScore: 0.5, engineKey: 'eslav' },
    });
  });

  it('dispose with engineKey disposes only that key — other keys stay initialized', async () => {
    sendMessageMock.mockResolvedValue({ success: true, data: { status: 'ready', backend: 'wasm' } });
    const ctrl = new OcrController();
    await ctrl.init('fr', 'wasm', 'latin');
    await ctrl.init('ru', 'wasm', 'eslav');
    expect(ctrl.isInitialized()).toBe(true);

    await ctrl.dispose('latin');
    expect(sendMessageMock).toHaveBeenLastCalledWith({
      type: 'OCR_DISPOSE',
      payload: { engineKey: 'latin' },
    });
    expect(ctrl.isInitialized()).toBe(true); // eslav still resident

    await ctrl.dispose('eslav');
    expect(ctrl.isInitialized()).toBe(false);
    expect(ctrl.getBackend()).toBeNull();
  });

  it('dispose without engineKey clears all keys (legacy behavior)', async () => {
    sendMessageMock.mockResolvedValue({ success: true, data: { status: 'ready', backend: 'wasm' } });
    const ctrl = new OcrController();
    await ctrl.init('fr', 'wasm', 'latin');
    await ctrl.init('ru', 'wasm', 'eslav');

    await ctrl.dispose();
    expect(sendMessageMock).toHaveBeenLastCalledWith({ type: 'OCR_DISPOSE' });
    expect(ctrl.isInitialized()).toBe(false);
  });
});
