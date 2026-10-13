import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import type { MessageResponse } from '@/entities/message/types';
import type { PronunciationEspeakTtsResult } from '@/entities/message/types';
import type { PronunciationAudio } from '../types';
import { decodeAudioUrl } from './audioDecoder';

/**
 * Synthesize text through the offscreen eSpeak NG engine
 * (PRONUNCIATION_ESPEAK_TTS — the only path that can run the vendored worker
 * under MV3 CSP; content pages cannot load `espeakng/` scripts) and decode
 * the returned WAV into a `PronunciationAudio` buffer. `text` may be a word
 * or an eSpeak `[[mnemonic]]` phoneme-input expression.
 * Returns null when synthesis is unavailable.
 */
export async function synthesizeEspeakAudio(
  text: string,
  langCode: string,
  rate?: number,
): Promise<PronunciationAudio | null> {
  const res = await sendMessage<MessageResponse<PronunciationEspeakTtsResult>>({
    type: MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS,
    payload: { text, langCode, rate },
  });
  const b64 = res?.success ? res.data?.audioBytesB64 : undefined;
  if (!b64) return null;

  const url = URL.createObjectURL(
    new Blob([decodeBase64ToArrayBuffer(b64)], { type: 'audio/wav' }),
  );
  try {
    return await decodeAudioUrl(url, 'espeak');
  } finally {
    URL.revokeObjectURL(url);
  }
}
