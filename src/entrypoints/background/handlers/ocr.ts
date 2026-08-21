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
  // Guard against loopback: chrome.runtime.sendMessage broadcasts to ALL contexts
  // including background itself. We use a distinct message type (_OFFSCREEN_ prefix)
  // for background→offscreen forwarding so the background handler never re-handles it.
  ctx.on(MESSAGE_TYPES.OCR_INIT, async (request): Promise<MessageResponse<OcrInitResult>> => {
    try {
      console.log('[OCR_BG] OCR_INIT received, ensuring offscreen...');
      try { chrome.storage.local.set({ __ocrBgStep: '1-ensuring-offscreen@' + Date.now() }); } catch {}
      await Promise.race([
        ctx.offscreenManager.ensureOffscreenReady(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ensureOffscreenReady timeout (10s)')), 10000)),
      ]);
      console.log('[OCR_BG] offscreen ready, sending OCR_INIT');
      try { chrome.storage.local.set({ __ocrBgStep: '2-offscreen-ready@' + Date.now() }); } catch {}
      const payload = request.payload as OcrInitPayload;
      console.log('[OCR_BG] sending OCR_INIT to offscreen', payload);
      // Use _OFFSCREEN_OCR_INIT type to avoid loopback — background handler only
      // listens for OCR_INIT, not _OFFSCREEN_OCR_INIT. The offscreen listener
      // (ffmpegRunner.ts) handles both types.
      // Add 180s timeout — model download from Baidu CDN can be slow on first run.
      try { chrome.storage.local.set({ __ocrBgStep: '3-sending-offscreen-init@' + Date.now() }); } catch {}
      const response = await Promise.race([
        sendMessage<{ status: string; backend: OcrBackend; error?: string }>({
          type: '_OFFSCREEN_OCR_INIT' as unknown as typeof MESSAGE_TYPES.OCR_INIT,
          payload,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR_INIT timeout (30s) — offscreen did not respond, possible CSP/WASM init failure')), 30000)),
      ]);
      console.log('[OCR_BG] offscreen response:', JSON.stringify(response));
      // Store debug info in chrome.storage.local for content script to read.
      try {
        chrome.storage.local.set({ __ocrBgDebug: { response, timestamp: Date.now() } });
      } catch {}
      if (response?.status === 'ready') {
        return { success: true, data: { status: 'ready', backend: response.backend } };
      }
      return { success: false, error: response?.error ?? 'OCR init failed' };
    } catch (e) {
      console.error('[OCR_BG] OCR_INIT error:', e);
      try { chrome.storage.local.set({ __ocrBgDebug: { error: String(e), timestamp: Date.now() } }); } catch {}
      return { success: false, error: `OCR_INIT failed: ${String(e)}` };
    }
  });

  // OCR_DISPOSE — route to offscreen. Frees engine, does NOT close offscreen.
  ctx.on(MESSAGE_TYPES.OCR_DISPOSE, async (): Promise<MessageResponse<{ ok: true }>> => {
    try {
      await ctx.offscreenManager.ensureOffscreenReady();
      await sendMessage({ type: '_OFFSCREEN_OCR_DISPOSE' as unknown as typeof MESSAGE_TYPES.OCR_DISPOSE });
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
          type: '_OFFSCREEN_OCR_RECOGNIZE' as unknown as typeof MESSAGE_TYPES.OCR_RECOGNIZE,
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
