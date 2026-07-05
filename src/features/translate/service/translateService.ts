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
 * Join cue texts into a single string for one Google request.
 *
 * ADR-021 D3 fix: Google Translate unofficial endpoint does NOT preserve `\n`
 * boundaries — it returns sentence-level segments, not line-level. Sending
 * multiple cues joined by `\n` causes misalignment (segments don't map 1:1 to
 * input lines). Fix: send 1 cue per request, join all returned segments for
 * that cue.
 *
 * @param texts - Cue texts to join (typically 1 text for single-cue request).
 * @returns Single string (texts joined by `\n` for Google request).
 */
export function joinCueTexts(texts: readonly string[]): string {
  return texts.join('\n');
}

/**
 * Align translated segments back to per-cue texts.
 *
 * ADR-021 D3 fix: when expectedCount === 1 (single-cue request), join ALL
 * segments into one string — Google may split one cue into multiple sentence-
 * level segments. When expectedCount > 1, pad/truncate best-effort (legacy
 * multi-cue path, kept for backward compat but not used in production).
 *
 * @param translated - Translated text segments from `parseGoogleResponse`.
 * @param expectedCount - Number of input cues (1 for single-cue request).
 * @returns Array of translated texts, length = expectedCount.
 */
export function alignTranslatedSegments(
  translated: readonly string[],
  expectedCount: number,
): string[] {
  // Single-cue request: join all segments (Google splits sentences)
  if (expectedCount === 1) {
    return [translated.join(' ').trim()];
  }
  // Multi-cue (legacy): best-effort pad/truncate
  if (translated.length === expectedCount) return [...translated];
  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(translated[i] ?? '');
  }
  return result;
}
