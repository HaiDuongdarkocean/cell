import type { SrtCue } from '@/entities/media';

/**
 * Translate service — Google Translate unofficial endpoint helpers (ADR-021 D2).
 *
 * Pure functions for building the request URL + parsing the response.
 * Network fetch lives in the background service worker (CORS bypass).
 */

/** Google Translate unofficial endpoint base (ADR-021 D2). */
export const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.google.com/translate_a/single';

/**
 * Sentence-terminal punctuation that Google Translate splits on (ADR-021 D3).
 *
 * Benchmark findings (tested on en/vi/ja/zh/ko/ar/hi):
 *  - Latin STerm (`.`, `?`, `!`, `;`) → Google splits into multiple segments
 *  - Comma `,`, colon `:` → Google does NOT split (time format safe)
 *  - CJK/Arabic/Hindi STerm (`。？！؟।`) → Google does NOT split
 *
 * Only Latin STerm needs encoding. We replace each with a rare placeholder
 * before sending to Google, then restore after. This prevents Google from
 * seeing sentence boundaries → 1 segment per cue → 100% alignment.
 */
const PLACEHOLDER = '\u298A\u298B'; // ⟦⟧ — rare bracket pair, unlikely in subtitle text

const ENCODE_MAP: ReadonlyArray<readonly [string, string]> = [
  ['.', ` ${PLACEHOLDER}DOT`],
  ['?', ` ${PLACEHOLDER}Q`],
  ['!', ` ${PLACEHOLDER}EXCL`],
  [';', ` ${PLACEHOLDER}SEMI`],
];

const DECODE_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [new RegExp(`(\\s*)${escapeRegex(PLACEHOLDER)}DOT(\\s*)`, 'g'), '.$2'],
  [new RegExp(`(\\s*)${escapeRegex(PLACEHOLDER)}Q(\\s*)`, 'g'), '?$2'],
  [new RegExp(`(\\s*)${escapeRegex(PLACEHOLDER)}EXCL(\\s*)`, 'g'), '!$2'],
  [new RegExp(`(\\s*)${escapeRegex(PLACEHOLDER)}SEMI(\\s*)`, 'g'), ';$2'],
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Encode sentence-terminal punctuation into placeholders before translate.
 *
 * Replaces `. ? ! ;` with `⟦⟧DOT ⟦⟧Q ⟦⟧EXCL ⟦⟧SEMI` so Google does not
 * split on sentence boundaries. Comma and colon are preserved (Google does
 * not split on them; time format `00:00:26,440` stays intact).
 *
 * @param text - Original cue text.
 * @returns Encoded text safe to send to Google (no sentence boundaries).
 */
export function encodePunctuation(text: string): string {
  let result = text;
  for (const [from, to] of ENCODE_MAP) {
    result = result.split(from).join(to);
  }
  return result;
}

/**
 * Decode placeholders back to original punctuation after translate.
 *
 * Restores `⟦⟧DOT ⟦⟧Q ⟦⟧EXCL ⟦⟧SEMI` → `. ? ! ;` in translated text.
 *
 * @param text - Translated text from Google (may contain placeholders).
 * @returns Decoded text with original punctuation restored.
 */
export function decodePunctuation(text: string): string {
  let result = text;
  for (const [re, to] of DECODE_MAP) {
    result = result.replace(re, to);
  }
  return result;
}

/**
 * Build the Google Translate unofficial request URL.
 *
 * @param text - Text to translate (encoded, multi-line joined cues, ≤ 1500 chars per chunk).
 * @param sl - Source language ISO 639-1 code (e.g. 'en'). Use 'auto' for detection.
 * @param tl - Target language ISO 639-1 code (e.g. 'vi').
 * @returns Full URL with query params (client=gtx, dt=t, sl, tl, q).
 */
export function buildTranslateUrl(text: string, sl: string, tl: string): string {
  const params = new URLSearchParams({
    client: 'gtx',
    sl,
    tl,
    dt: 't',
    q: text,
  });
  return `${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`;
}

/**
 * Parse the Google Translate unofficial response into translated text segments.
 *
 * Response shape: `[[[<translated>, <original>], ...], ...]` — the first nested
 * array contains segment pairs. We extract `seg[0]` (translated text) from each.
 *
 * @param response - Parsed JSON from Google Translate.
 * @returns Array of translated text segments (1 per input line when encoded).
 *          Empty array on malformed/empty response (never throws).
 */
export function parseGoogleResponse(response: unknown): string[] {
  if (!Array.isArray(response)) return [];
  const segments = response[0];
  if (!Array.isArray(segments)) return [];
  return segments
    .filter((seg: unknown): seg is unknown[] => Array.isArray(seg))
    .map((seg: unknown[]) => (typeof seg[0] === 'string' ? seg[0] : ''));
}

/**
 * Join cue texts into a single string for one Google request.
 *
 * Each cue is wrapped in marker tags `⟦C{idx}⟧...⟦/C{idx}⟧` so Google cannot
 * merge or split across cue boundaries. Internal `\n` is normalized to a single
 * space to prevent Google from splitting a cue into multiple segments.
 * Sentence-terminal punctuation is encoded before wrapping.
 *
 * @param cues - Cues to join (will be encoded and wrapped).
 * @returns Single encoded string with cue markers for parsing after translate.
 */
export function joinCueTexts(cues: readonly SrtCue[]): string {
  return cues
    .map((c, i) => `⟦C${i}⟧${encodePunctuation(c.text.replace(/\n/g, ' '))}⟦/C${i}⟧`)
    .join('');
}

/**
 * Align translated segments back to per-cue texts using cue markers.
 *
 * Cues were wrapped with `⟦C{idx}⟧...⟦/C{idx}⟧` before sending. After translate,
 * Google may return one or many segments; we join them and extract each cue
 * text by its marker. Missing cues are padded with empty strings.
 *
 * @param translated - Translated text segments from `parseGoogleResponse`.
 * @param expectedCount - Number of input cues.
 * @returns Array of decoded translated texts, length = expectedCount.
 */
export function alignTranslatedSegments(
  translated: readonly string[],
  expectedCount: number,
): string[] {
  const joined = translated.join('');
  const markerRegex = /⟦C(\d+)⟧(.*?)⟦\/C\1⟧/gs;
  const map = new Map<number, string>();
  for (const match of joined.matchAll(markerRegex)) {
    const idx = Number(match[1]);
    const text = match[2] ?? '';
    map.set(idx, decodePunctuation(text.trim()));
  }

  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(map.get(i) ?? '');
  }
  return result;
}
