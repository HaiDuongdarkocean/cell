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
import type { TtsFetchAudioResponse } from '@/entities/dictionary';
import { TtsFetchAudioPayloadSchema } from '@/entities/message/dictionarySchemas';

/** Google Translate unofficial TTS endpoint. */
const GOOGLE_TTS_ENDPOINT = 'https://translate.google.com/translate_tts';

/** Max text length for a single TTS request (Google's limit). */
const MAX_TTS_TEXT_LEN = 200;

/**
 * Decorative glyphs that carry no spoken form — common in lyric/karaoke
 * subtitles and fansub styling. Display keeps them, but a TTS engine would
 * vocalize them as noise ("eighth note", "black circle") or stall on them:
 * arrows (karaoke pitch marks), geometric shapes (●○ karaoke dots), box
 * drawing/blocks (ASCII-art credits), misc symbols (★♥), dingbats (✿❀✨),
 * misc technical (⌛⏳), enclosed alphanumerics (①Ⓐ episode markers),
 * braille art, musical symbols (♪𝄞), all emoji blocks, CJK music marks
 * (〰 wavy dash, 〽 part-alternation mark), invisible format chars (ZWSP,
 * ZWJ, LRM/RLM, soft hyphen, variation selectors, tag chars), U+FFFC/U+FFFD.
 * Kept: letters/numbers of every script, standard + CJK punctuation,
 * meaningful marks (+ = % © ※ • † ‡ 〜), and bracketed text (may be speech).
 */
const UNSPOKEN_GLYPHS_RE = new RegExp(
  [
    '[\\u00AD\\u200B\\u200D-\\u200F\\u2060-\\u2069\\uFE00-\\uFE0F\\uFEFF\\uFFFC\\uFFFD]',
    '[\\u20E3\\u2190-\\u21FF\\u2300-\\u23FF\\u2460-\\u24FF\\u2500-\\u25FF]',
    '[\\u2600-\\u26FF\\u2700-\\u27BF\\u27F0-\\u27FF\\u2800-\\u28FF\\u2900-\\u297F\\u2B00-\\u2BFF]',
    '[\\u3030\\u303D]',
    '[\\u{1D100}-\\u{1D1FF}\\u{1F000}-\\u{1FAFF}\\u{1FB00}-\\u{1FBFF}]',
    '[\\u{E0000}-\\u{E007F}]',
  ].join('|'),
  'gu',
);

const EMPTIED_BRACKETS_RE = /\(\s*\)|\[\s*\]|\{\s*\}|（\s*）|【\s*】|「\s*」|『\s*』|〈\s*〉|《\s*》/g;

/** Strip unspoken glyphs, drop brackets emptied by the strip, collapse whitespace. */
export function sanitizeTtsText(text: string): string {
  let out = text.replace(UNSPOKEN_GLYPHS_RE, ' ');
  for (let i = 0; i < 4; i++) {
    const next = out.replace(EMPTIED_BRACKETS_RE, ' ');
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+/g, ' ').trim();
}

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
    const speakable = sanitizeTtsText(text);
    if (!speakable) {
      return { success: false, error: 'TTS text has no speakable content' };
    }

    const url = buildTtsUrl(speakable, langCode);
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
