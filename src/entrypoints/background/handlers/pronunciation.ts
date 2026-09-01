/**
 * Pronunciation message handler — PRONUNCIATION_ESPEAK_TTS.
 *
 * Forwards the request to the offscreen document where the eSpeak TTS engine
 * can load its Emscripten worker and synthesize audio.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { OffscreenManager } from '../offscreenManager';
import { PronunciationEspeakTtsPayloadSchema } from '@/features/dictionaryPopup/schema';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { PronunciationEspeakTtsResult } from '@/entities/message/types';

const offscreen = new OffscreenManager();

export function registerPronunciationHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS, async (request): Promise<MessageResponse<PronunciationEspeakTtsResult>> => {
    const parsed = PronunciationEspeakTtsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PRONUNCIATION_ESPEAK_TTS payload: ${parsed.error.message}` };
    }

    try {
      await offscreen.ensureOffscreenDocument();
      const response = await sendMessage<MessageResponse<PronunciationEspeakTtsResult>>({
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
