/**
 * TTS audio fetch handler — TTS_FETCH_AUDIO.
 *
 * Fetches spoken audio as an MP3 from Google Translate's unofficial TTS
 * endpoint. Background SW fetch bypasses CORS (host_permissions <all_urls>).
 * Same pattern as the TRANSLATE handler (ADR-021 D2).
 *
 * Returns a data: URL (base64) so the content script can consume it
 * directly — blob: URLs are SW-scoped and not shareable across contexts.
 *
 * Text length limit: Google Translate TTS accepts ~200 chars per request.
 * Longer text is truncated to avoid HTTP 400.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { TtsFetchAudioResponse } from '@/features/dictionaryPopup/types';
import { TtsFetchAudioPayloadSchema } from '@/features/dictionaryPopup/schema';

/** Google Translate unofficial TTS endpoint. */
const GOOGLE_TTS_ENDPOINT = 'https://translate.google.com/translate_tts';

/** Max text length for a single TTS request (Google's limit). */
const MAX_TTS_TEXT_LEN = 200;

/** Build the Google Translate TTS request URL. */
function buildTtsUrl(text: string, langCode: string): string {
  const truncated = text.slice(0, MAX_TTS_TEXT_LEN);
  const params = new URLSearchParams({
    ie: 'UTF-8',
    q: truncated,
    tl: langCode,
    client: 'tw-ob',
  });
  return `${GOOGLE_TTS_ENDPOINT}?${params.toString()}`;
}

/** Convert an ArrayBuffer to a base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Register the TTS_FETCH_AUDIO message handler. */
export function registerTtsFetchAudioHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TTS_FETCH_AUDIO, async (request): Promise<MessageResponse<TtsFetchAudioResponse>> => {
    const parsed = TtsFetchAudioPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_FETCH_AUDIO payload: ${parsed.error.message}` };
    }
    const { text, langCode } = parsed.data;

    const url = buildTtsUrl(text, langCode);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'audio/mpeg, audio/*, */*' },
      });
      if (!response.ok) {
        return { success: false, error: `Google TTS HTTP ${response.status}` };
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return { success: false, error: 'Google TTS returned empty audio' };
      }
      const base64 = arrayBufferToBase64(arrayBuffer);
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      return { success: true, data: { url: dataUrl } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `TTS audio fetch failed: ${msg}` };
    }
  });
}
