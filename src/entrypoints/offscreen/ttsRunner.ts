// ttsRunner — offscreen document TTS worker.
//
// MV3 service workers cannot use AudioContext, so the local Supertonic TTS
// engine runs here and is driven by messages from the background script.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import { registerOffscreenListener, sendMessage } from '@/shared/lib/chrome-apis';
import { TtsSpeakLocalPayloadSchema, TtsDownloadVoicePayloadSchema } from '@/entities/message/dictionarySchemas';
import { createSupertonicTtsEngine } from '@/features/tts/services/supertonicTtsEngine';
import { downloadVoicePack, isVoicePackDownloaded } from '@/features/tts/services/ttsDownloadManager';
import type { MessageResponse } from '@/entities/message';

const engine = createSupertonicTtsEngine();

interface MessageLike {
  readonly type?: string;
  readonly payload?: unknown;
}

registerOffscreenListener((message, sender, sendResponse) => {
  const msg = message as MessageLike;
  // Offscreen is driven by the service worker only; ignore direct fan-out from
  // options/popup/sidepanel pages to avoid duplicate (interrupted) TTS runs.
  const isFromBackground = !sender?.tab;

  if (msg.type === MESSAGE_TYPES.TTS_SPEAK_LOCAL) {
    if (!isFromBackground) {
      return false;
    }
    const parsed = TtsSpeakLocalPayloadSchema.safeParse(msg.payload);
    if (!parsed.success) {
      sendResponse({ success: false, error: `Invalid TTS_SPEAK_LOCAL payload: ${parsed.error.message}` } as MessageResponse<null>);
      return false;
    }

    const { text, langCode, voiceName, rate, pitch } = parsed.data;

    void (async () => {
      try {
        await engine.speak(text, { langCode, voiceName, rate, pitch });
        sendResponse({ success: true, data: null } as MessageResponse<null>);
      } catch (err) {
        const msgText = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: t('tts.local.speakFailed', [msgText]) } as MessageResponse<null>);
      }
    })();

    return true;
  }

  if (msg.type === MESSAGE_TYPES.TTS_DOWNLOAD_VOICE) {
    if (!isFromBackground) {
      return false;
    }
    const parsed = TtsDownloadVoicePayloadSchema.safeParse(msg.payload);
    if (!parsed.success) {
      sendResponse({ success: false, error: `Invalid TTS_DOWNLOAD_VOICE payload: ${parsed.error.message}` } as MessageResponse<null>);
      return false;
    }

    void (async () => {
      try {
        const { language, jobId } = parsed.data;
        await downloadVoicePack(language, ({ loaded, total }) => {
          void sendMessage({
            type: MESSAGE_TYPES.TTS_DOWNLOAD_PROGRESS,
            payload: { language, loaded, total, jobId },
          });
        });
        const installed = await isVoicePackDownloaded();
        sendResponse({ success: true, data: installed } as MessageResponse<boolean>);
      } catch (err) {
        const msgText = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: t('tts.local.downloadError', [msgText]) } as MessageResponse<null>);
      }
    })();

    return true;
  }

  return false;
});
