/**
 * Local TTS message handler — TTS_SPEAK_LOCAL.
 *
 * Forwards the request to the offscreen document where AudioContext + the
 * Supertonic TTS engine run. Falls back to the regular chrome.tts path on
 * offscreen failure if the caller supports it.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { OffscreenManager } from '../offscreenManager';
import { TtsSpeakPayloadSchema } from '@/features/dictionaryPopup/schema';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';

const offscreen = new OffscreenManager();

export function registerLocalTtsHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TTS_SPEAK_LOCAL, async (request): Promise<MessageResponse<null>> => {
    const parsed = TtsSpeakPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_SPEAK_LOCAL payload: ${parsed.error.message}` };
    }

    try {
      await offscreen.ensureOffscreenDocument();
      const response = await sendMessage<MessageResponse<null>>({
        type: MESSAGE_TYPES.TTS_SPEAK_LOCAL,
        payload: parsed.data,
      });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Local TTS offscreen failed: ${msg}` };
    }
  });
}
