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
  TranslateResult,
} from '@/entities/message';
import { TranslatePayloadSchema } from '@/features/dictionaryPopup/schema';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import {
  buildTranslateUrl,
  buildMyMemoryUrl,
  parseGoogleResponse,
  parseMyMemoryResponse,
} from '@/features/translate/service/translateService';

/** Primary fetch timeout (ms) — Google Translate endpoint. */
const GOOGLE_TRANSLATE_TIMEOUT_MS = 4000;

/** Fallback fetch timeout (ms) — MyMemory Translate endpoint. */
const MYMEMORY_TRANSLATE_TIMEOUT_MS = 6000;

/** Register translate message handler. */
export function registerTranslateHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TRANSLATE, async (request): Promise<MessageResponse<TranslateResult>> => {
    const parsed = TranslatePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TRANSLATE payload: ${parsed.error.message}` };
    }
    const { text, sl, tl } = parsed.data;
    if (!text || !sl || !tl) {
      return { success: false, error: 'Missing text, sl, or tl in TRANSLATE' };
    }

    // Try Google first; if it fails or returns empty, fall back to MyMemory.
    let lastError = 'No translation available';
    try {
      const url = buildTranslateUrl(text, sl, tl);
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
      }, GOOGLE_TRANSLATE_TIMEOUT_MS);
      if (response.ok) {
        const data = await response.json();
        const translated = parseGoogleResponse(data);
        if (translated.length > 0) {
          return { success: true, data: { translated } };
        }
        lastError = 'Google Translate returned empty response (possible rate-limit)';
      } else {
        lastError = `Google Translate HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? `Google: ${error.message}` : 'Google Translate failed';
    }

    try {
      const url = buildMyMemoryUrl(text, sl, tl);
      const response = await fetchWithTimeout(url, { method: 'GET' }, MYMEMORY_TRANSLATE_TIMEOUT_MS);
      if (!response.ok) {
        return { success: false, error: `MyMemory Translate HTTP ${response.status}` };
      }
      const data = (await response.json()) as unknown;
      const translated = parseMyMemoryResponse(data);
      if (translated.length === 0) {
        return { success: false, error: 'MyMemory returned empty translation or quota finished' };
      }
      return { success: true, data: { translated } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Translate fetch failed: ${msg} (${lastError})` };
    }
  });
}
