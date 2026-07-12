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
 * Build the Google Translate unofficial request URL.
 *
 * @param text - Text to translate (multi-line joined cues, ≤ 1500 chars per chunk).
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
 * @returns Array of translated text segments (1 per input line when unsplit).
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
 *
 * Sentence-terminal punctuation is sent verbatim — `alignTranslatedSegments`
 * rejoins any segments Google splits, so cue markers alone maintain alignment.
 * (Previously punctuation was encoded into placeholders, but Google
 * non-deterministically reorders/strips the placeholder → leaked tokens in
 * output. See ADR-021 D3 revision.)
 *
 * @param cues - Cues to join (will be wrapped in markers).
 * @returns Single string with cue markers for parsing after translate.
 */
export function joinCueTexts(cues: readonly SrtCue[]): string {
  return cues
    .map((c, i) => `⟦C${i}⟧${c.text.replace(/\n/g, ' ')}⟦/C${i}⟧`)
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
    map.set(idx, text.trim());
  }

  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(map.get(i) ?? '');
  }
  return result;
}
