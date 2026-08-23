// ttsRunner — offscreen document TTS worker.
//
// MV3 service workers cannot use AudioContext, so the local Supertonic TTS
// engine runs here and is driven by messages from the background script.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { onMessage } from '@/shared/lib/chrome-apis';
import { TtsSpeakPayloadSchema } from '@/features/dictionaryPopup/schema';
import { createSupertonicTtsEngine } from '@/features/tts/services/supertonicTtsEngine';
import type { MessageResponse } from '@/entities/message';

const engine = createSupertonicTtsEngine();

onMessage((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || (message as { type?: string }).type !== MESSAGE_TYPES.TTS_SPEAK_LOCAL) {
    return false;
  }

  const parsed = TtsSpeakPayloadSchema.safeParse((message as { payload?: unknown }).payload);
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
      const msg = err instanceof Error ? err.message : String(err);
      sendResponse({ success: false, error: `Local TTS speak failed: ${msg}` } as MessageResponse<null>);
    }
  })();

  return true;
});
