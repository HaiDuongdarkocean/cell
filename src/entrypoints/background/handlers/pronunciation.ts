/**
 * Pronunciation message handler — PRONUNCIATION_ESPEAK_TTS.
 *
 * Forwards the request to the offscreen document where the eSpeak TTS engine
 * can load its Emscripten worker and synthesize audio.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { PronunciationEspeakTtsPayloadSchema } from '@/entities/message/dictionarySchemas';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { PronunciationEspeakTtsResult } from '@/entities/message/types';

export function registerPronunciationHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS, async (request): Promise<MessageResponse<PronunciationEspeakTtsResult>> => {
    const parsed = PronunciationEspeakTtsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PRONUNCIATION_ESPEAK_TTS payload: ${parsed.error.message}` };
    }

    try {
      const response = await ctx.offscreenManager.sendToOffscreen<MessageResponse<PronunciationEspeakTtsResult>>({
        type: MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS,
        payload: parsed.data,
      });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `eSpeak offscreen failed: ${msg}` };
    }
  });
}
