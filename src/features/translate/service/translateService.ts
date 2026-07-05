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
 * @returns Array of translated text segments (1 per input line). Empty array on
 *          malformed/empty response (never throws).
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
 * Join cue texts into a single multi-line string for one Google request.
 *
 * Google Translate preserves line breaks in the response — each line maps to
 * one input cue. We join with `\n` so `parseGoogleResponse` returns one segment
 * per cue (ADR-021 D3 chunk strategy).
 *
 * @param texts - Cue texts to join.
 * @returns Multi-line string (texts joined by `\n`).
 */
export function joinCueTexts(texts: readonly string[]): string {
  return texts.join('\n');
}

/**
 * Split a translated multi-line response back into per-cue texts.
 *
 * Google may merge/split lines in edge cases — we align by count first, then
 * fall back to splitting by `\n` (ADR-021 D3: best-effort alignment).
 *
 * @param translated - Translated text segments from `parseGoogleResponse`.
 * @param expectedCount - Number of input cues (for alignment check).
 * @returns Array of translated texts, length = expectedCount (padded/truncated).
 */
export function alignTranslatedSegments(
  translated: readonly string[],
  expectedCount: number,
): string[] {
  if (translated.length === expectedCount) return [...translated];
  // Mismatch — Google merged/split. Best-effort: pad/truncate to expected count.
  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(translated[i] ?? '');
  }
  return result;
}
