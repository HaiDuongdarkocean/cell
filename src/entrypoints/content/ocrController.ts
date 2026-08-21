// ocrController — content-script OCR client (spec §AD5, §AD7).
// Thin client: sends OCR_INIT/RECOGNIZE/DISPOSE to background via chrome.runtime.
// ImageData transfer: chrome.runtime.sendMessage uses JSON serialization (not structured clone),
// so Uint8ClampedArray → {} (data lost). Convert to regular Array before sending.
// No OCR logic here — engine lives in offscreen document.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import type { MessageResponse } from '@/entities/message';
import type { OcrBackend, OcrLanguageMode, ImageSource, OcrResult } from '@/features/ocr/engine/types';

/** OCR init result. */
export interface OcrInitResult {
  readonly status: 'ready' | 'error';
  readonly backend: OcrBackend;
  readonly error?: string;
}

/** OCR controller — thin client for content-script to talk to background/offscreen. */
export class OcrController {
  private initialized = false;
  private backend: OcrBackend | null = null;

  /** Initialize OCR engine in offscreen document. */
  async init(languageMode: OcrLanguageMode = 'auto', backend: OcrBackend = 'webgpu'): Promise<OcrInitResult> {
    try {
      document.body.dataset.ocrInitStep = 'a-before-send';
      const msg = { type: MESSAGE_TYPES.OCR_INIT, payload: { languageMode, backend } };
      document.body.dataset.ocrInitStep = 'b-msg-built';
      const sendPromise = sendMessage<MessageResponse<OcrInitResult> | OcrInitResult>(msg);
      document.body.dataset.ocrInitStep = 'c-send-returned-' + (typeof sendPromise?.then === 'function' ? 'promise' : 'non-promise');
      const response = await Promise.race([
        sendPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR_INIT timeout (180s) — model download from Baidu CDN may be slow')), 180000)),
      ]);
      document.body.dataset.ocrInitStep = 'd-race-resolved';
      document.body.dataset.ocrBgResponse = JSON.stringify(response) ?? 'undefined_response';
      // Handle both response formats:
      // - Background wrapper: { success: true, data: { status: 'ready', backend: 'wasm' } }
      // - Direct offscreen: { status: 'ready', backend: 'wasm' }
      // (Both listeners receive chrome.runtime.sendMessage; offscreen may respond first.)
      const isWrapper = response && 'success' in response;
      const data = isWrapper ? response.data : response;
      if (data?.status === 'ready') {
        this.initialized = true;
        this.backend = data.backend;
        return { status: 'ready', backend: this.backend };
      }
      this.initialized = false;
      const error = isWrapper ? (response.error ?? data?.error ?? 'Init failed') : (data?.error ?? 'Init failed');
      return { status: 'error', backend: 'wasm', error };
    } catch (e) {
      document.body.dataset.ocrBgException = String(e);
      this.initialized = false;
      return { status: 'error', backend: 'wasm', error: String(e) };
    }
  }

  /** Run OCR on an image. Returns detected text boxes. */
  async recognize(image: ImageSource, minScore?: number): Promise<OcrResult[]> {
    if (!this.initialized) throw new Error('OCR not initialized — call init() first.');
    try {
      // chrome.runtime.sendMessage uses JSON serialization — Uint8ClampedArray becomes {}.
      // Convert to regular Array to preserve pixel data through the message channel.
      const serializableImage = {
        data: Array.from(image.data),
        width: image.width,
        height: image.height,
      };
      const response = await Promise.race([
        sendMessage<{ success: boolean; data?: { results: OcrResult[] }; error?: string; results?: OcrResult[] }>({
          type: MESSAGE_TYPES.OCR_RECOGNIZE,
          payload: { image: serializableImage, minScore },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR_RECOGNIZE timeout (30s)')), 30000)),
      ]);
      // Handle both response formats (background wrapper vs direct offscreen).
      if (!response?.success && response?.error) throw new Error(response.error);
      return response?.data?.results ?? response?.results ?? [];
    } catch (e) {
      document.body.dataset.ocrRecognizeError = String(e)?.slice(0, 200);
      throw e;
    }
  }

  /** Dispose OCR engine (frees session, does NOT close offscreen document). */
  async dispose(): Promise<void> {
    if (!this.initialized) return;
    await sendMessage({ type: MESSAGE_TYPES.OCR_DISPOSE });
    this.initialized = false;
    this.backend = null;
  }

  /** Whether engine is initialized. */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Current backend (for status display). */
  getBackend(): OcrBackend | null {
    return this.backend;
  }
}
