/**
 * TTS message handler — TTS_SPEAK (spec §9.4 B).
 *
 * Content-script asks background to speak text via chrome.tts (or Web Speech
 * fallback). The engine is created once at module scope and cached for the
 * service-worker lifetime.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { TtsSpeakPayloadSchema } from '@/features/dictionaryPopup/schema';
import { createTtsEngine, type TtsEngine } from '@/features/dictionaryPopup/services/ttsEngineService';

/** Cached engine — created lazily on first TTS_SPEAK. */
let cachedEngine: TtsEngine | undefined;

/** Lazily create + cache the TTS engine. */
function getEngine(): TtsEngine {
  if (!cachedEngine) {
    cachedEngine = createTtsEngine();
  }
  return cachedEngine;
}

/** Register the TTS speak message handler. */
export function registerTtsHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TTS_SPEAK, async (request): Promise<MessageResponse<null>> => {
    const parsed = TtsSpeakPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_SPEAK payload: ${parsed.error.message}` };
    }
    const { text, langCode, rate, pitch, voiceName } = parsed.data;

    let engine: TtsEngine;
    try {
      engine = getEngine();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `TTS engine unavailable: ${msg}` };
    }

    try {
      await engine.speak(text, { voiceName, langCode, rate, pitch });
      return { success: true, data: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `TTS speak failed: ${msg}` };
    }
  });
}
