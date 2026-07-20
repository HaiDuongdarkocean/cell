/**
 * Frequency message handler — FREQUENCY_GET.
 *
 * Content scripts ask the background to read frequency entries because
 * IndexedDB is origin-isolated: the extension's IDB lives in the extension
 * origin, not the web page. Background keeps the single source of truth.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { FrequencyGetPayloadSchema } from '@/features/dictionaryPopup/schema';
import { findFrequencyByTerms } from '@/features/dictionary/repositories/frequencyRepository';
import type { FrequencyEntry } from '@/entities/dictionary';

/** Register frequency GET handler. */
export function registerFrequencyHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.FREQUENCY_GET, async (request): Promise<MessageResponse<{ entries: Record<string, FrequencyEntry[]> }>> => {
    const parsed = FrequencyGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid FREQUENCY_GET payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms } = parsed.data;
    try {
      const map = await findFrequencyByTerms(langCode, terms);
      const entries: Record<string, FrequencyEntry[]> = {};
      for (const [term, value] of map.entries()) {
        entries[term] = value;
      }
      return { success: true, data: { entries } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
