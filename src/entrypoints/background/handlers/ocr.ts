// OCR background handler — routes OCR messages to offscreen document (spec §AD2, §AD5).
// OCR_RECOGNIZE uses chrome.runtime.connect Port for ImageData transfer (structured clone).
// OCR_DISPOSE frees engine, does NOT close offscreen document.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  OcrInitPayloadSchema,
  OcrRecognizePayloadSchema,
  OcrDisposePayloadSchema,
  OcrRegionCommandPayloadSchema,
} from '@/entities/message/schema';
import type { OcrBackend, OcrResult } from '@/features/ocr/engine/types';
import { logger } from '@/shared/lib/logger';

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

/** Register OCR handlers on the background message bus. */
export function registerOcrHandlers(ctx: BackgroundContext): void {
  // OCR_INIT — route to offscreen document via sendMessage.
  // Guard against loopback: chrome.runtime.sendMessage broadcasts to ALL contexts
  // including background itself. We use a distinct message type (_OFFSCREEN_ prefix)
  // for background→offscreen forwarding so the background handler never re-handles it.
  ctx.on(MESSAGE_TYPES.OCR_INIT, async (request): Promise<MessageResponse<OcrInitResult>> => {
    const parsed = OcrInitPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid OCR_INIT payload: ${parsed.error.message}` };
    }
    try {
      logger.debug('[OCR_BG] OCR_INIT received, ensuring offscreen...');
      await Promise.race([
        ctx.offscreenManager.ensureOffscreenReady(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ensureOffscreenReady timeout (10s)')), 10000)),
      ]);
      logger.debug('[OCR_BG] offscreen ready, sending OCR_INIT');
      const payload = parsed.data;
      logger.debug('[OCR_BG] sending OCR_INIT to offscreen', payload);
      // Use _OFFSCREEN_OCR_INIT type to avoid loopback — background handler only
      // listens for OCR_INIT, not _OFFSCREEN_OCR_INIT. The offscreen listener
      // (ffmpegRunner.ts) handles both types.
      // Add 180s timeout — model download from Baidu CDN can be slow on first run.
      const response = await Promise.race([
        ctx.offscreenManager.sendToOffscreen<{ status: string; backend: OcrBackend; error?: string }>({
          type: '_OFFSCREEN_OCR_INIT' as unknown as typeof MESSAGE_TYPES.OCR_INIT,
          payload,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR_INIT timeout (30s) — offscreen did not respond, possible CSP/WASM init failure')), 30000)),
      ]);
      logger.debug('[OCR_BG] offscreen response:', JSON.stringify(response));
      if (response?.status === 'ready') {
        return { success: true, data: { status: 'ready', backend: response.backend } };
      }
      return { success: false, error: response?.error ?? t('ocr.error.init') };
    } catch (e) {
      console.error('[OCR_BG] OCR_INIT error:', e);
      return { success: false, error: t('ocr.error.initDetail', [String(e)]) };
    }
  });

  // OCR_DISPOSE — route to offscreen. Frees engine, does NOT close offscreen.
  // Payload forwarded verbatim: engineKey disposes one engine, missing disposes all.
  ctx.on(MESSAGE_TYPES.OCR_DISPOSE, async (request): Promise<MessageResponse<{ ok: true }>> => {
    const parsed = OcrDisposePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid OCR_DISPOSE payload: ${parsed.error.message}` };
    }
    try {
      await ctx.offscreenManager.sendToOffscreen({
        type: '_OFFSCREEN_OCR_DISPOSE' as unknown as typeof MESSAGE_TYPES.OCR_DISPOSE,
        payload: parsed.data,
      });
      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: t('ocr.error.dispose', [String(e)]) };
    }
  });

  // OCR_RECOGNIZE — route to offscreen. ImageData via structured clone (verified T0b).
  ctx.on(
    MESSAGE_TYPES.OCR_RECOGNIZE,
    async (request): Promise<MessageResponse<OcrRecognizeResult>> => {
      const parsed = OcrRecognizePayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid OCR_RECOGNIZE payload: ${parsed.error.message}` };
      }
      try {
        const payload = parsed.data;
        const response = await ctx.offscreenManager.sendToOffscreen<{ results: OcrResult[]; error?: string }>({
          type: '_OFFSCREEN_OCR_RECOGNIZE' as unknown as typeof MESSAGE_TYPES.OCR_RECOGNIZE,
          payload,
        });
        if (response?.error) {
          return { success: false, error: response.error };
        }
        return { success: true, data: { results: response?.results ?? [] } };
      } catch (e) {
        return { success: false, error: t('ocr.error.recognize', [String(e)]) };
      }
    },
  );

  // OCR state get/set is handled by content-script directly via ocrStateStore.
  // Background does not need to mediate — content-script reads/writes chrome.storage.local.

  // OCR_REGION_COMMAND — forward to active tab's content script.
  ctx.on(MESSAGE_TYPES.OCR_REGION_COMMAND, async (request): Promise<MessageResponse<{ ok: true }>> => {
    const parsed = OcrRegionCommandPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid OCR_REGION_COMMAND payload: ${parsed.error.message}` };
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { success: false, error: t('ui.error.noActiveTab') };
      await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OCR_REGION_COMMAND, payload: parsed.data });
      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: t('ocr.error.region', [String(e)]) };
    }
  });
}
