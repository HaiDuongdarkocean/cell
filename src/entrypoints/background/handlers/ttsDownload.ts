/**
 * TTS voice pack download handler — TTS_DOWNLOAD_VOICE.
 *
 * Forwards to the offscreen document where OPFS + fetch can run. The offscreen
 * runner streams progress via TTS_DOWNLOAD_PROGRESS and responds when done.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { OffscreenManager } from '../offscreenManager';
import { TtsDownloadVoicePayloadSchema } from '@/features/dictionaryPopup/schema';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';

const offscreen = new OffscreenManager();

export function registerTtsDownloadHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TTS_DOWNLOAD_VOICE, async (request): Promise<MessageResponse<boolean>> => {
    const parsed = TtsDownloadVoicePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_DOWNLOAD_VOICE payload: ${parsed.error.message}` } as MessageResponse<boolean>;
    }

    try {
      await offscreen.ensureOffscreenDocument();
      const response = await sendMessage<MessageResponse<boolean>>({
        type: MESSAGE_TYPES.TTS_DOWNLOAD_VOICE,
        payload: parsed.data,
      });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `TTS voice download offscreen failed: ${msg}` } as MessageResponse<boolean>;
    }
  });

  // Progress fan-out from offscreen → any listening popups.
  ctx.on(MESSAGE_TYPES.TTS_DOWNLOAD_PROGRESS, async (request): Promise<MessageResponse<null>> => {
    return { success: true, data: null };
  });
}
