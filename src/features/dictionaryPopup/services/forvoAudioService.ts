/**
 * Forvo audio service — pure HTML parsing + accent scoring (spec §9.4 B).
 *
 * Network fetch lives in the background handler; this module is pure logic,
 * tolerant of malformed input (returns `[]`, never throws).
 *
 * Ponytail: Forvo HTML structure có thể break bất kỳ lúc nào — selector + regex
 * parse tolerant, fallback empty array. No DOMParser (MV3 service worker lacks
 * it); regex is intentionally permissive about attribute order/whitespace.
 *
 * Reference: project-reference/theocean-extension-dictionary/scripts/audioManager.js
 * (parseContainer + readSpeakerMeta) and background.js fetchForvo handler.
 */
import type { AudioItem } from '../types';

/** Base URL for Forvo audio CDN (decoded base64 path appended). */
export const FORVO_AUDIO_CDN = 'https://audio00.forvo.com/mp3/';

/** Build the Forvo word page URL for a term. */
export function buildForvoUrl(term: string): string {
  return `https://forvo.com/word/${encodeURIComponent(term)}/#en`;
}

/** Normalize whitespace (matches reference `normalize`). */
function normalize(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Decode a Forvo base64 path into the full audio CDN URL. */
function decodeForvoUrl(base64: string): string | null {
  try {
    const decoded = atob(base64);
    return `${FORVO_AUDIO_CDN}${decoded}`;
  } catch {
    return null;
  }
}

/**
 * Extract the inner HTML of a `#pronunciations-list-<id>` section.
 *
 * Slices from the `id="..."` marker up to the next `pronunciations-list`
 * marker (or end of string). Tolerant of nested tags — we only need the
 * substring that contains the `<li>` rows for this accent.
 */
function extractSection(html: string, sectionId: string): string {
  const marker = `id="${sectionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const rest = html.slice(start + marker.length);
  const next = rest.search(/id="pronunciations-list-/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

/**
 * Read speaker + region metadata from a single `<li>` row's raw HTML.
 *
 * Tries several anchor patterns (ofLink class on `<a>` or wrapper, profile
 * href) and the `.from` span; falls back to placeholders when absent.
 */
function readSpeakerMetaRegex(
  liHtml: string,
  fallbackRegion: string,
): { speaker: string; region: string } {
  const anchorMatch =
    liHtml.match(/<a[^>]*class="[^"]*ofLink[^"]*"[^>]*>([^<]+)<\/a>/i) ??
    liHtml.match(/class="[^"]*ofLink[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ??
    liHtml.match(/<a[^>]*href="[^"]*\/profiles\/[^"]*"[^>]*>([^<]+)<\/a>/i);
  const speaker = normalize(anchorMatch?.[1]) || 'Unknown speaker';

  const fromMatch = liHtml.match(/<[^>]*class="[^"]*from[^"]*"[^>]*>([^<]+)<\/[^>]+>/i);
  const fromText = normalize(fromMatch?.[1]);
  const regionText = fromText.replace(/^from\s+/i, '');
  const region = regionText || fallbackRegion || 'Unknown region';

  return { speaker, region };
}

/**
 * Parse play buttons inside one pronunciation section's raw HTML.
 *
 * Splits on `<li>` rows; for each row matches
 * `Play(id,'base64')` (tolerant of quoted/unquoted first arg), decodes the
 * base64 path to a CDN URL, and reads speaker/region metadata.
 */
function parseSection(
  sectionHtml: string,
  accentId: 'UK' | 'US',
  fallbackRegion: string,
  startIndex: number,
): AudioItem[] {
  if (!sectionHtml) return [];
  const items: AudioItem[] = [];
  // Split on `<li` opening tag; first chunk is preamble, skip it.
  const liBlocks = sectionHtml.split(/<li[\s>]/i).slice(1);
  let idx = startIndex;
  for (const block of liBlocks) {
    const endIdx = block.search(/<\/li>/i);
    const li = endIdx >= 0 ? block.slice(0, endIdx) : block;
    const playMatch = li.match(/Play\([^,]+,\s*['"]([A-Za-z0-9+/=]+)['"]\)/i);
    if (!playMatch?.[1]) continue;
    const url = decodeForvoUrl(playMatch[1]);
    if (!url) continue;
    const { speaker, region } = readSpeakerMetaRegex(li, fallbackRegion);
    items.push({
      id: `forvo-${accentId}-${idx}`,
      kind: 'word',
      source: 'community',
      label: `${speaker} · ${region}`,
      accentId,
      state: 'idle',
      url,
      defaultSelected: false,
    });
    idx += 1;
  }
  return items;
}

/**
 * Parse Forvo word-page HTML into {@link AudioItem}[].
 *
 * Looks for `#pronunciations-list-en_uk` (UK) and `#pronunciations-list-en_usa`
 * (US) containers; each `.play` button's `onclick="Play(id,'base64')"` is
 * decoded into a CDN URL. Tolerant — returns `[]` on malformed/empty input.
 *
 * @param html - Raw HTML from the Forvo word page.
 * @param _langCode - Language code (reserved for future non-English support).
 * @returns Audio items (UK first, then US), unsorted.
 */
export function parseForvoHtml(html: string, _langCode: string): AudioItem[] {
  if (!html) return [];
  try {
    const uk = parseSection(
      extractSection(html, 'pronunciations-list-en_uk'),
      'UK',
      'United Kingdom',
      0,
    );
    const us = parseSection(
      extractSection(html, 'pronunciations-list-en_usa'),
      'US',
      'United States',
      uk.length,
    );
    return [...uk, ...us];
  } catch {
    return [];
  }
}

/**
 * Score audio items by accent preference and sort descending.
 *
 * Preferred accent → 2 points, other → 1 point, no accent → 0. Stable sort
 * preserves original order within equal scores.
 *
 * @param items - Audio items (e.g. from {@link parseForvoHtml}).
 * @param preferredAccent - 'US' or 'UK' (default 'US').
 * @returns New sorted array (input not mutated).
 */
export function scoreAudioByAccent(
  items: readonly AudioItem[],
  preferredAccent: 'US' | 'UK' = 'US',
): AudioItem[] {
  const preferred = preferredAccent;
  const other = preferred === 'US' ? 'UK' : 'US';
  return [...items]
    .map((item) => ({
      item,
      score: item.accentId === preferred ? 2 : item.accentId === other ? 1 : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
