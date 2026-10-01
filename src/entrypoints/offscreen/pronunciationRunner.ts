// pronunciationRunner — offscreen document pronunciation worker.
//
// MV3 service workers cannot spawn AudioContexts or Web Workers easily, and
// the eSpeak-ng Emscripten port needs a document context, so it runs here.

import { registerOffscreenListener } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { encodeBase64 } from '@/shared/lib/base64';
import { t } from '@/shared/i18n';
import { PronunciationEspeakTtsPayloadSchema } from '@/entities/message/dictionarySchemas';
import { synthesizeEspeakToWav } from '@/features/pronunciation/services/espeakOffscreenEngine';
import type { MessageResponse } from '@/entities/message';
import type { PronunciationEspeakTtsResult } from '@/entities/message/types';

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

    const { text, langCode } = parsed.data;

    void (async () => {
      try {
        const audioBytes = await synthesizeEspeakToWav(text, langCode);
        sendResponse({ success: true, data: { audioBytesB64: encodeBase64(audioBytes) } } as MessageResponse<PronunciationEspeakTtsResult>);
      } catch (err) {
        const msgText = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: t('audio.error.espeakFailed', [msgText]) } as MessageResponse<null>);
      }
    })();

    return true;
  }

  return false;
});
