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
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { TtsFetchAudioResponse } from '@/entities/dictionary';
import { TtsFetchAudioPayloadSchema } from '@/entities/message/dictionarySchemas';
import { bytesToDataUrl } from '@/shared/lib/base64';

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
const UNSPOKEN_CODE_POINT_RANGES: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x200b, 0x200b],
  [0x200d, 0x200f],
  [0x2060, 0x2069],
  [0x20e3, 0x20e3],
  [0x2190, 0x21ff],
  [0x2300, 0x23ff],
  [0x2460, 0x24ff],
  [0x2500, 0x25ff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf],
  [0x27f0, 0x27ff],
  [0x2800, 0x28ff],
  [0x2900, 0x297f],
  [0x2b00, 0x2bff],
  [0x3030, 0x3030],
  [0x303d, 0x303d],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xfffc, 0xfffd],
  [0x1d100, 0x1d1ff],
  [0x1f000, 0x1faff],
  [0x1fb00, 0x1fbff],
  [0xe0000, 0xe007f],
];

function isUnspokenCodePoint(codePoint: number): boolean {
  return UNSPOKEN_CODE_POINT_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

const EMPTIED_BRACKETS_RE = /\(\s*\)|\[\s*\]|\{\s*\}|（\s*）|【\s*】|「\s*」|『\s*』|〈\s*〉|《\s*》/g;

/** Strip unspoken glyphs, drop brackets emptied by the strip, collapse whitespace. */
export function sanitizeTtsText(text: string): string {
  let out = Array.from(text, (char) =>
    isUnspokenCodePoint(char.codePointAt(0) ?? 0) ? ' ' : char,
  ).join('');
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
      return { success: false, error: t('tts.error.noSpeakableText') };
    }

    const url = buildTtsUrl(speakable, langCode);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'audio/mpeg, audio/*, */*' },
      });
      if (!response.ok) {
        return { success: false, error: t('tts.error.http', [response.status]) };
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return { success: false, error: t('tts.error.emptyAudio') };
      }
      const dataUrl = bytesToDataUrl(arrayBuffer, 'audio/mpeg');
      return { success: true, data: { url: dataUrl } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: t('tts.error.fetchFailed', [msg]) };
    }
  });
}
