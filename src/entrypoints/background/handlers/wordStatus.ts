/**
 * Word status message handlers — WORD_STATUS_GET / WORD_STATUS_SET.
 *
 * Content scripts ask the background to read/write word status because
 * IndexedDB is origin-isolated: the extension's IDB lives in the extension
 * origin, not the web page. Background keeps the single source of truth.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  WordStatusGetPayloadSchema,
  WordStatusesGetPayloadSchema,
  WordStatusSetPayloadSchema,
} from '@/features/dictionaryPopup/schema';
import {
  getWordStatus,
  getWordStatuses,
  setWordStatus,
} from '@/features/dictionaryPopup/services/wordStatusStore';
import type { WordStatus } from '@/features/dictionaryPopup/types';

/** Register word status GET/SET handlers. */
export function registerWordStatusHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.WORD_STATUS_SET, async (request): Promise<MessageResponse> => {
    const parsed = WordStatusSetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_SET payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode, status } = parsed.data;
    try {
      await setWordStatus(langCode, term, status);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUS_GET, async (request): Promise<MessageResponse<{ status: WordStatus }>> => {
    const parsed = WordStatusGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUS_GET payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode } = parsed.data;
    try {
      const status = await getWordStatus(langCode, term);
      return { success: true, data: { status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ctx.on(MESSAGE_TYPES.WORD_STATUSES_GET, async (request): Promise<MessageResponse<{ statuses: Record<string, WordStatus> }>> => {
    const parsed = WordStatusesGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid WORD_STATUSES_GET payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms } = parsed.data;
    try {
      const map = await getWordStatuses(langCode, terms);
      const statuses: Record<string, WordStatus> = {};
      for (const [term, status] of map.entries()) {
        statuses[term] = status;
      }
      return { success: true, data: { statuses } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
