import type { SrtCue } from '@/entities/media';

/**
 * Translate service — Google Translate unofficial endpoint helpers (ADR-021 D2).
 *
 * Pure functions for building the request URL + parsing the response.
 * Network fetch lives in the background service worker (CORS bypass).
 */

/** Google Translate unofficial endpoint base (ADR-021 D2).
 *  Dùng translate.googleapis.com thay vì translate.google.com —
 *  translate.google.com bị Chrome SW block fetch trong một số môi trường
 *  (temp profile, Secure DNS). googleapis.com endpoint tương đương và
 *  response shape identical. */
export const GOOGLE_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

/**
 * Restore g-dropping contractions (`leavin'` → `leaving`, `LEAVIN'` →
 * `LEAVING`) before sending text to a provider — unnormalized slang comes
 * back echoed or mistranslated, especially in ALL-CAPS subtitle tracks.
 * The letter lookahead protects possessives like `Martin's`.
 */
export function normalizeTranslationInput(text: string): string {
  return text.replace(/(in)'(?![a-z])/gi, (_m, stem: string) =>
    stem === stem.toUpperCase() ? `${stem}G` : `${stem}g`,
  );
}

/**
 * Build the Google Translate unofficial POST request.
 *
 * `q` goes in the body so payloads are not bounded by GET URL length — larger
 * chunks mean fewer requests, which is what keeps us under the per-IP
 * rate-limit (bursts of ~50 req/min trigger a 429 "unusual traffic" block).
 *
 * @param text - Text to translate (multi-line joined cues, ≤ 4500 chars per chunk).
 * @param sl - Source language ISO 639-1 code (e.g. 'en'). Use 'auto' for detection.
 * @param tl - Target language ISO 639-1 code (e.g. 'vi').
 * @returns `{ url, body }` — POST `url` with `application/x-www-form-urlencoded` body.
 */
export function buildTranslateRequest(
  text: string,
  sl: string,
  tl: string,
): { url: string; body: string } {
  const params = new URLSearchParams({ client: 'gtx', sl, tl, dt: 't' });
  const body = new URLSearchParams({ q: normalizeTranslationInput(text) });
  return { url: `${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`, body: body.toString() };
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
  // Newline between markers is load-bearing (same lesson as joinTermTexts):
  // glued `⟦C0⟧a⟦/C0⟧⟦C1⟧b⟦/C1⟧` reads as one opaque token to Google and
  // comes back ASCII-ified (`[[C0]]`), echoed, or word-level bilingual mash.
  return cues
    .map((c, i) => `⟦C${i}⟧${c.text.replace(/\n/g, ' ')}⟦/C${i}⟧`)
    .join('\n');
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
/**
 * Google non-deterministically ASCII-ifies the `⟦ ⟧` bracket pair into
 * `[[ ]]`, `【 】`, or single `[ ]` (e.g. `⟦/C60⟧` → `[[/C60]]`). Normalize
 * every observed variant back to `⟦C…⟧`/`⟦/C…⟧` so the marker regex still
 * aligns — closes must normalize before opens since `/` disambiguates them.
 */
function normalizeCueMarkers(text: string): string {
  return text
    .replace(/\[\[\/C(\d+)\]\]|【\/C(\d+)】|\[\/C(\d+)\]/g, '⟦/C$1$2$3⟧')
    .replace(/\[\[C(\d+)\]\]|【C(\d+)】|\[C(\d+)\]/g, '⟦C$1$2$3⟧');
}

/** Residual marker fragments that can still leak inside an extracted cue. */
const MARKER_RESIDUE_RE = /⟦\/?C\d+⟧|\[\[\/?C\d+\]\]|【\/?C\d+】|\[\/?C\d+\]/g;

export function alignTranslatedSegments(
  translated: readonly string[],
  expectedCount: number,
): string[] {
  const joined = normalizeCueMarkers(translated.join(''));
  const markerRegex = /⟦C(\d+)⟧(.*?)⟦\/C\1⟧/gs;
  const map = new Map<number, string>();
  for (const match of joined.matchAll(markerRegex)) {
    const idx = Number(match[1]);
    const text = match[2] ?? '';
    map.set(idx, text.replace(MARKER_RESIDUE_RE, ' ').replace(/\s{2,}/g, ' ').trim());
  }

  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(map.get(i) ?? '');
  }
  return result;
}

/**
 * Join terms into a single marker-tagged string for one Google request.
 * Same contract as `joinCueTexts` but with `⟦T{i}⟧...⟦/T{i}⟧` tags so each
 * translated term can be aligned back by index (spec word-translation REQ-1).
 */
export function joinTermTexts(terms: readonly string[]): string {
  // Newline between markers is load-bearing: glued `⟦T0⟧a⟦/T0⟧⟦T1⟧b⟦/T1⟧`
  // reads as one opaque token to Google and comes back untranslated — with
  // '\n' separators the markers survive AND each term is translated.
  return terms
    .map((term, i) => `⟦T${i}⟧${term.replace(/\n/g, ' ')}⟦/T${i}⟧`)
    .join('\n');
}

/**
 * Align translated segments back to per-term glosses using term markers.
 * Mirrors `alignTranslatedSegments`; absent markers yield `''`.
 */
export function alignTermGlosses(
  translated: readonly string[],
  expectedCount: number,
): string[] {
  const joined = translated.join('');
  const markerRegex = /⟦T(\d+)⟧(.*?)⟦\/T\1⟧/gs;
  const map = new Map<number, string>();
  for (const match of joined.matchAll(markerRegex)) {
    const idx = Number(match[1]);
    map.set(idx, (match[2] ?? '').trim());
  }

  const result: string[] = [];
  for (let i = 0; i < expectedCount; i++) {
    result.push(map.get(i) ?? '');
  }
  return result;
}

/**
 * Group terms into marker-joined request bodies, each ≤ `maxChars`.
 * Indices inside each chunk restart at 0 — the caller aligns per chunk.
 */
export function chunkTermMarkerTexts(
  terms: readonly string[],
  maxChars: number = 1500,
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const term of terms) {
    const marked = `⟦T${current.length}⟧${term.replace(/\n/g, ' ')}⟦/T${current.length}⟧\n`;
    if (current.length > 0 && chars + marked.length > maxChars) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(term);
    chars += marked.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
