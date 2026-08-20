// ocrController — content-script OCR client (spec §AD5, §AD7).
// Thin client: sends OCR_INIT/RECOGNIZE/DISPOSE to background via chrome.runtime.
// ImageData transfer via sendMessage (structured clone — verified T0b).
// No OCR logic here — engine lives in offscreen document.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
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
    const response = await sendMessage<{ success: boolean; data?: OcrInitResult; error?: string }>({
      type: MESSAGE_TYPES.OCR_INIT,
      payload: { languageMode, backend },
    });
    if (response?.success && response.data?.status === 'ready') {
      this.initialized = true;
      this.backend = response.data.backend;
      return { status: 'ready', backend: response.data.backend };
    }
    this.initialized = false;
    return { status: 'error', backend: 'wasm', error: response?.error ?? 'Init failed' };
  }

  /** Run OCR on an image. Returns detected text boxes. */
  async recognize(image: ImageSource, minScore?: number): Promise<OcrResult[]> {
    if (!this.initialized) throw new Error('OCR not initialized — call init() first.');
    const response = await sendMessage<{ success: boolean; data?: { results: OcrResult[] }; error?: string }>({
      type: MESSAGE_TYPES.OCR_RECOGNIZE,
      payload: { image, minScore },
    });
    if (!response?.success) throw new Error(response?.error ?? 'OCR recognize failed');
    return response.data?.results ?? [];
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
