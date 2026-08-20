// OCR background handler — routes OCR messages to offscreen document (spec §AD2, §AD5).
// OCR_RECOGNIZE uses chrome.runtime.connect Port for ImageData transfer (structured clone).
// OCR_DISPOSE frees engine, does NOT close offscreen document.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { OcrBackend, OcrLanguageMode, ImageSource, OcrResult } from '@/features/ocr/engine/types';
import { sendMessage } from '@/shared/lib/chrome-apis';

/** OCR init result from offscreen. */
export interface OcrInitResult {
  readonly status: 'ready' | 'error';
  readonly backend: OcrBackend;
  readonly error?: string;
}

/** OCR recognize result from offscreen. */
export interface OcrRecognizeResult {
  readonly results: OcrResult[];
}

/** OCR init payload. */
export interface OcrInitPayload {
  readonly languageMode: OcrLanguageMode;
  readonly backend: OcrBackend;
}

/** Register OCR handlers on the background message bus. */
export function registerOcrHandlers(ctx: BackgroundContext): void {
  // OCR_INIT — route to offscreen document via sendMessage.
  ctx.on(MESSAGE_TYPES.OCR_INIT, async (request): Promise<MessageResponse<OcrInitResult>> => {
    try {
      await ctx.offscreenManager.ensureOffscreenReady();
      const payload = request.payload as OcrInitPayload;
      const response = await sendMessage<{ status: string; backend: OcrBackend; error?: string }>({
        type: MESSAGE_TYPES.OCR_INIT,
        payload,
      });
      if (response?.status === 'ready') {
        return { success: true, data: { status: 'ready', backend: response.backend } };
      }
      return { success: false, error: response?.error ?? 'OCR init failed' };
    } catch (e) {
      return { success: false, error: `OCR_INIT failed: ${String(e)}` };
    }
  });

  // OCR_DISPOSE — route to offscreen. Frees engine, does NOT close offscreen.
  ctx.on(MESSAGE_TYPES.OCR_DISPOSE, async (): Promise<MessageResponse<{ ok: true }>> => {
    try {
      await ctx.offscreenManager.ensureOffscreenReady();
      await sendMessage({ type: MESSAGE_TYPES.OCR_DISPOSE });
      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: `OCR_DISPOSE failed: ${String(e)}` };
    }
  });

  // OCR_RECOGNIZE — route to offscreen. ImageData via structured clone (verified T0b).
  ctx.on(
    MESSAGE_TYPES.OCR_RECOGNIZE,
    async (request): Promise<MessageResponse<OcrRecognizeResult>> => {
      try {
        await ctx.offscreenManager.ensureOffscreenReady();
        const payload = request.payload as { image: ImageSource; minScore?: number };
        const response = await sendMessage<{ results: OcrResult[]; error?: string }>({
          type: MESSAGE_TYPES.OCR_RECOGNIZE,
          payload,
        });
        if (response?.error) {
          return { success: false, error: response.error };
        }
        return { success: true, data: { results: response?.results ?? [] } };
      } catch (e) {
        return { success: false, error: `OCR_RECOGNIZE failed: ${String(e)}` };
      }
    },
  );

  // OCR_GET_STATE / OCR_SET_STATE handled by content-script directly via ocrStateStore.
  // Background does not need to mediate — content-script reads/writes chrome.storage.local.
}
