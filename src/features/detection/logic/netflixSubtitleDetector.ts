import type { DetectedSubtitle } from '@/entities/media';

/**
 * Netflix subtitle detection — map Netflix player internal track state
 * to the extension's `DetectedSubtitle[]` for the auto-load flow.
 *
 * Netflix cadmium 6.0059+ no longer parses the MSL manifest via `JSON.parse`,
 * so the MAIN-world `netflix-main-world.iife.ts` traverses the player's
 * internal object graph (`cadmiumPlayerRepository.playersById[sessionId]`)
 * to find `type === 'timedtext'` nodes with `urls[0].url`, then pairs them
 * with metadata from `getTimedTextTrackList()` (ADR-029, pivoted 2026-07-13).
 *
 * Netflix serves IMSC1.1 (TTML XML) — not WebVTT — so `format: 'ttml'`.
 * The codebase has no TTML parser yet; download path converts TTML→SRT
 * via DOMParser when implemented (ponytail: deferred until download task).
 *
 * Sources:
 * - Stress test 2026-07-13 via edge-devtools MCP (movie 81947712, logged in).
 * - asbplayer 1.19.0 `netflix-page.js` (graph traversal approach).
 * - ADR-029 (interface contracts).
 */

/** Netflix subtitle track from player graph traversal + getTimedTextTrackList. */
export interface NetflixSubtitleTrack {
  readonly trackId: string; // "T:2:0;1;vi;0;0;0;" — dedup key
  readonly bcp47: string; // "en", "vi", "zh-Hans", "pt-BR", ...
  readonly displayName: string; // "Vietnamese", "English"
  readonly rawTrackType: string; // "SUBTITLES" | "CLOSEDCAPTIONS"
  readonly isNoneTrack: boolean; // true = "Off" track (skip)
  readonly isForcedNarrative: boolean; // foreign-language dialog subtitle
  readonly isImageBased: boolean; // true = DVD-style image subtitle (skip)
  readonly url: string; // direct CDN URL or 'lazy' (need setTimedTextTrack)
}

/** Referer/initiator required for Netflix subtitle CDN fetches. */
const NETFLIX_INITIATOR = 'https://www.netflix.com/';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Map Netflix player tracks → `DetectedSubtitle[]` for auto-load.
 *
 * - Skips `isNoneTrack`, `isImageBased`, and `url === 'lazy'` (not yet loaded).
 * - language = `bcp47` lowercased; CC tracks get `-CC` suffix (clone asbplayer).
 * - isAsr = false (Netflix does not expose an AI-generated distinction).
 * - displayName = `track.displayName`, with ` [forced]` appended only when
 *   `isForcedNarrative` is true and the display name does not already contain
 *   "forced" (case-insensitive) to avoid `English (forced) [forced]`.
 * - initiator = `'https://www.netflix.com/'` for the DNR Referer fallback.
 * - format = `'ttml'` — Netflix serves IMSC1.1 (TTML XML).
 */
export function mapNetflixSubtitleTracks(
  tracks: readonly NetflixSubtitleTrack[],
  tabId: number,
): DetectedSubtitle[] {
  const now = Date.now();
  const out: DetectedSubtitle[] = [];

  for (const track of tracks) {
    if (track.isNoneTrack || track.isImageBased) continue;
    if (!track.url || track.url === 'lazy') continue;

    const isClosedCaptions = track.rawTrackType === 'CLOSEDCAPTIONS';
    const language = isClosedCaptions
      ? `${track.bcp47.toLowerCase()}-cc`
      : track.bcp47.toLowerCase();

    const displayLower = track.displayName.toLowerCase();
    const forcedSuffix =
      track.isForcedNarrative && !displayLower.includes('forced')
        ? ' [forced]'
        : '';

    out.push({
      id: generateId(),
      url: track.url,
      format: 'ttml',
      language,
      tabId,
      detectedAt: now,
      isAsr: false,
      displayName: `${track.displayName}${forcedSuffix}`,
      initiator: NETFLIX_INITIATOR,
    });
  }

  return out;
}
