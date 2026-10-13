// pronunciationRunner — offscreen document pronunciation worker.
//
// MV3 service workers cannot spawn AudioContexts or Web Workers easily, and
// the eSpeak-ng Emscripten port needs a document context, so it runs here.

import { registerOffscreenListener } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { encodeBase64 } from '@/shared/lib/base64';
import { t } from '@/shared/i18n';
import {
  PronunciationEspeakTtsPayloadSchema,
  PronunciationSupertonicTtsPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import { synthesizeEspeakToWav } from '@/features/pronunciation/services/espeakOffscreenEngine';
import { synthesizeSupertonic } from '@/features/tts/services/supertonicInference';
import type { MessageResponse } from '@/entities/message';
import type {
  PronunciationEspeakTtsResult,
  PronunciationSupertonicTtsResult,
} from '@/entities/message/types';

interface MessageLike {
  readonly type?: string;
  readonly payload?: unknown;
}

registerOffscreenListener((message, sender, sendResponse) => {
  const msg = message as MessageLike;
  const isFromBackground = !sender?.tab;

  if (msg.type === MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS) {
    if (!isFromBackground) {
      return false;
    }

    const parsed = PronunciationEspeakTtsPayloadSchema.safeParse(msg.payload);
    if (!parsed.success) {
      sendResponse({
        success: false,
        error: `Invalid PRONUNCIATION_ESPEAK_TTS payload: ${parsed.error.message}`,
      } as MessageResponse<null>);
      return false;
    }

    const { text, langCode, rate } = parsed.data;

    void (async () => {
      try {
        const audioBytes = await synthesizeEspeakToWav(text, langCode, rate);
        sendResponse({ success: true, data: { audioBytesB64: encodeBase64(audioBytes) } } as MessageResponse<PronunciationEspeakTtsResult>);
      } catch (err) {
        const msgText = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: t('audio.error.espeakFailed', [msgText]) } as MessageResponse<null>);
      }
    })();

    return true;
  }

  if (msg.type === MESSAGE_TYPES.PRONUNCIATION_SUPERTONIC_TTS) {
    if (!isFromBackground) {
      return false;
    }

    const parsed = PronunciationSupertonicTtsPayloadSchema.safeParse(msg.payload);
    if (!parsed.success) {
      sendResponse({
        success: false,
        error: `Invalid PRONUNCIATION_SUPERTONIC_TTS payload: ${parsed.error.message}`,
      } as MessageResponse<null>);
      return false;
    }

    const { text, langCode, voices } = parsed.data;

    void (async () => {
      try {
        const items: { voice: string; audioBytesB64: string }[] = [];
        let lastErr: Error | undefined;
        for (const voice of voices?.length ? voices : ['M1']) {
          try {
            const wav = await synthesizeSupertonic(text, langCode, voice);
            items.push({ voice, audioBytesB64: encodeBase64(wav) });
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
          }
        }
        if (items.length === 0) {
          throw lastErr ?? new Error('No Supertonic voice available');
        }
        sendResponse({ success: true, data: { items } } as MessageResponse<PronunciationSupertonicTtsResult>);
      } catch (err) {
        const msgText = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: t('audio.error.supertonicFailed', [msgText]) } as MessageResponse<null>);
      }
    })();

    return true;
  }

  return false;
});
