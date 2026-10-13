/**
 * Pronunciation message handlers — PRONUNCIATION_ESPEAK_TTS and
 * PRONUNCIATION_SUPERTONIC_TTS.
 *
 * Forwards the request to the offscreen document where the eSpeak TTS engine
 * can load its Emscripten worker and synthesize audio, or where the Supertonic
 * ONNX engine runs inference.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import {
  PronunciationEspeakTtsPayloadSchema,
  PronunciationSupertonicTtsPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import { isSupertonicVoiceId, SUPERTONIC_MAX_SELECTED_VOICES } from '@/features/tts/services/ttsDownloadManager';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type {
  PronunciationEspeakTtsResult,
  PronunciationSupertonicTtsResult,
} from '@/entities/message/types';

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
      return { success: false, error: t('audio.error.espeakFailed', [msg]) };
    }
  });

  ctx.on(MESSAGE_TYPES.PRONUNCIATION_SUPERTONIC_TTS, async (request): Promise<MessageResponse<PronunciationSupertonicTtsResult>> => {
    const parsed = PronunciationSupertonicTtsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PRONUNCIATION_SUPERTONIC_TTS payload: ${parsed.error.message}` };
    }

    try {
      const settings = await ctx.loadSettings();
      const tts = settings.dictionaryPopup?.tts;
      const selected = tts?.supertonicVoices?.length ? tts.supertonicVoices : ['M1'];
      const requested = parsed.data.voices?.length ? parsed.data.voices : selected;
      const voices = requested.filter(isSupertonicVoiceId).slice(0, SUPERTONIC_MAX_SELECTED_VOICES);
      const response = await ctx.offscreenManager.sendToOffscreen<MessageResponse<PronunciationSupertonicTtsResult>>({
        type: MESSAGE_TYPES.PRONUNCIATION_SUPERTONIC_TTS,
        payload: { ...parsed.data, voices },
      });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: t('audio.error.supertonicFailed', [msg]) };
    }
  });
}
