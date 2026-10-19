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
import { TranslatePayloadSchema } from '@/entities/message/dictionarySchemas';
import { fetchWithTimeout } from '@/shared/lib/fetchWithTimeout';
import { t } from '@/shared/i18n';
import {
  buildTranslateRequest,
  parseGoogleResponse,
} from '@/features/translate/service/translateService';
import { googleTranslatePaced } from '@/features/translate/service/googleRateLimiter';

const GOOGLE_TRANSLATE_TIMEOUT_MS = 8000;

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

    try {
      const { url, body } = buildTranslateRequest(text, sl, tl);
      const paced = await googleTranslatePaced(async () => {
        try {
          const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
          }, GOOGLE_TRANSLATE_TIMEOUT_MS);
          if (response.ok) {
            const translated = parseGoogleResponse(await response.json());
            return { status: 200, value: translated };
          }
          return { status: response.status, value: null };
        } catch {
          return { status: 0, value: null };
        }
      });
      if (paced.status === 200 && paced.value) {
        if (paced.value.length > 0) {
          return { success: true, data: { translated: paced.value } };
        }
        return { success: false, error: t('translate.error.empty') };
      }
      return { success: false, error: t('translate.error.http', [paced.status]) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: t('translate.error.fetch', [msg]) };
    }
  });
}
