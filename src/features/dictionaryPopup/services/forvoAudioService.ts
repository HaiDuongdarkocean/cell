/**
 * Forvo audio service — pure HTML parsing + accent scoring (spec §9.4 B).
 *
 * Network fetch lives in the background handler; this module is pure logic,
 * tolerant of malformed input (returns `[]`, never throws).
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

/** Read speaker + region metadata from a play button's row. */
function readSpeakerMeta(
  button: Element,
  fallbackRegion: string,
): { speaker: string; region: string } {
  const row = button.closest('li') ?? button.closest('.pronunciations') ?? button.parentElement;
  const profileAnchor =
    row?.querySelector('.ofLink a') ??
    row?.querySelector('.ofLink') ??
    row?.querySelector('a[href*="/profiles/"]');
  const speaker = normalize(profileAnchor?.textContent) || 'Unknown speaker';

  const fromText = normalize(row?.querySelector('.from')?.textContent);
  const regionText = fromText.replace(/^from\s+/i, '');
  const region = regionText || fallbackRegion || 'Unknown region';

  return { speaker, region };
}

/** Parse play buttons inside one pronunciation container. */
function parseContainer(
  container: Element | null,
  accentId: 'UK' | 'US',
  fallbackRegion: string,
  startIndex: number,
): AudioItem[] {
  if (!container) return [];
  const items: AudioItem[] = [];
  const buttons = container.querySelectorAll('.play');
  let idx = startIndex;
  buttons.forEach((btn) => {
    const onClickAttr = btn.getAttribute('onclick') ?? '';
    const match = onClickAttr.match(/Play\(\d+,'([^']+)'/i);
    if (!match?.[1]) return;
    const url = decodeForvoUrl(match[1]);
    if (!url) return;
    const { speaker, region } = readSpeakerMeta(btn, fallbackRegion);
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
  });
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
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const uk = parseContainer(
      doc.querySelector('#pronunciations-list-en_uk'),
      'UK',
      'United Kingdom',
      0,
    );
    const us = parseContainer(
      doc.querySelector('#pronunciations-list-en_usa'),
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
