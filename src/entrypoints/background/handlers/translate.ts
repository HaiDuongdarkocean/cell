/**
 * Translate message handler — TRANSLATE (ADR-021 D2).
 *
 * Content-script asks background to translate text via Google Translate unofficial
 * endpoint. Background SW fetch bypasses CORS (host_permissions <all_urls>).
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  TranslatePayload,
  TranslateResult,
} from '@/entities/message';
import { TranslatePayloadSchema } from '@/features/dictionaryPopup/schema';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import {
  buildTranslateUrl,
  parseGoogleResponse,
} from '@/features/translate/service/translateService';

/** Register translate message handler. */
export function registerTranslateHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TRANSLATE, async (request): Promise<MessageResponse<TranslateResult>> => {
    const parsed = TranslatePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TRANSLATE payload: ${parsed.error.message}` };
    }
    const payload = parsed.data as TranslatePayload;
    if (!payload.text || !payload.sl || !payload.tl) {
      return { success: false, error: 'Missing text, sl, or tl in TRANSLATE' };
    }

    const url = buildTranslateUrl(payload.text, payload.sl, payload.tl);
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
      });
      if (!response.ok) {
        return { success: false, error: `Google Translate HTTP ${response.status}` };
      }
      const data = await response.json();
      const translated = parseGoogleResponse(data);
      if (translated.length === 0) {
        return { success: false, error: 'Google Translate returned empty response (possible rate-limit)' };
      }
      return { success: true, data: { translated } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Translate fetch failed: ${msg}` };
    }
  });
}
