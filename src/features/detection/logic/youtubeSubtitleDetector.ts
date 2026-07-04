import type { DetectedSubtitle } from '@/entities/media';

/**
 * YouTube subtitle detection — map `ytInitialPlayerResponse` caption tracks
 * to the extension's `DetectedSubtitle[]` for the auto-load flow.
 *
 * YouTube serves subtitles via a proprietary `timedtext` API whose URLs do
 * NOT match the generic `SUBTITLE_URL_PATTERNS` (no `.srt/.vtt/.ass` ext,
 * no `/subtitles|subs|caption|cc/` path). Detection is therefore proactive:
 * the MAIN-world script reads `window.ytInitialPlayerResponse.captions.
 * playerCaptionsTracklistRenderer.captionTracks[]` and forwards the tracks
 * to the isolated-world content-script via `postMessage` (ADR-020).
 *
 * This module is pure (no DOM, no Chrome API) so it is unit-testable in
 * isolation. The MAIN-world script wires it to the page; the background
 * handler wires it to the auto-load flow.
 *
 * Sources:
 * - yt-dlp `_video.py` (captionTracks extraction)
 * - github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md (Innertube API)
 * - ADR-020 (interface contracts)
 */

/** YouTube caption track from ytInitialPlayerResponse (subset of fields used). */
export interface YouTubeCaptionTrack {
  readonly baseUrl: string;
  readonly languageCode: string;
  readonly kind?: string; // "asr" = auto-generated; absent = manual
  readonly name?: { readonly simpleText?: string };
  readonly vssId?: string;
  readonly isTranslatable?: boolean;
}

/**
 * PO Token indicator params in the baseUrl `exp` query field.
 * YouTube adds `xpe`/`xpv` to `exp` when the track requires a PO Token;
 * fetching such a URL without the token returns an empty (200 OK) response.
 *
 * Source: yt-dlp issue #13654, Stack Overflow #79668836.
 */
const POT_TOKEN_INDICATORS = /(?:^|[,])xpe(?:$|[,])|(?:^|[,])xpv(?:$|[,])/;

/** yt-dlp #13654: `xosf` param damages subtitles — strip before appending fmt. */
const XOSF_PARAM = /(^|[?&])xosf=[^&]*/gi;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Build the VTT fetch URL from a YouTube caption track `baseUrl`.
 *
 * - Strip `xosf` param (yt-dlp #13654 — damaged subtitles).
 * - Append `&fmt=vtt` so the response is WebVTT (reuse `parseVtt`).
 * - Preserve all other params (signature, pot token, etc.).
 */
export function buildVttUrl(baseUrl: string): string {
  const withoutXosf = baseUrl.replace(XOSF_PARAM, (_m, prefix: string) =>
    prefix.startsWith('?') || prefix.startsWith('&') ? prefix[0] ?? '' : '',
  );
  const joiner = withoutXosf.includes('?') ? '&' : '?';
  return `${withoutXosf}${joiner}fmt=vtt`;
}

/**
 * Detect whether a track requires a PO Token by inspecting the `exp` param.
 * Returns `true` when `exp` contains `xpe` or `xpv` (comma-separated list).
 */
export function requiresPoToken(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const exp = url.searchParams.get('exp');
    if (!exp) return false;
    return POT_TOKEN_INDICATORS.test(exp);
  } catch {
    return false;
  }
}

/**
 * Safely extract `captionTracks` from an unknown `ytInitialPlayerResponse`
 * payload. Returns `[]` when the structure is missing or malformed —
 * callers (MAIN-world script, InnerTube fallback) treat empty as
 * "trigger fallback" (ADR-020 Contract 6).
 */
export function extractCaptionTracks(playerResponse: unknown): YouTubeCaptionTrack[] {
  if (typeof playerResponse !== 'object' || playerResponse === null) {
    return [];
  }
  const captions = (playerResponse as Record<string, unknown>).captions;
  if (typeof captions !== 'object' || captions === null) {
    return [];
  }
  const renderer = (captions as Record<string, unknown>)
    .playerCaptionsTracklistRenderer;
  if (typeof renderer !== 'object' || renderer === null) {
    return [];
  }
  const tracks = (renderer as Record<string, unknown>).captionTracks;
  if (!Array.isArray(tracks)) {
    return [];
  }
  return tracks.filter(
    (t): t is YouTubeCaptionTrack =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as YouTubeCaptionTrack).baseUrl === 'string' &&
      typeof (t as YouTubeCaptionTrack).languageCode === 'string',
  );
}

/**
 * Map YouTube `captionTracks` → `DetectedSubtitle[]` for the extension's
 * auto-load flow.
 *
 * - Appends `&fmt=vtt` to `baseUrl` (reuse `parseVtt`).
 * - Strips `xosf` param (yt-dlp #13654 — damaged subtitles).
 * - Skips tracks requiring a PO Token (`exp` contains `xpe`/`xpv`) and
 *   warns with the language code — graceful degradation (spec F6/F9).
 * - Sets `isAsr: true` for `kind === "asr"` tracks (auto-generated).
 * - Sets `displayName` from `name.simpleText` (fallback: uppercase
 *   `languageCode`) so the manager panel can show "English (auto-generated)".
 *
 * @param tracks - `captionTracks` from `ytInitialPlayerResponse.captions.
 *   playerCaptionsTracklistRenderer` (or InnerTube fallback).
 * @param tabId - Current tab ID.
 * @returns `DetectedSubtitle[]` (empty if no tracks or all skipped).
 */
export function mapYouTubeCaptionTracks(
  tracks: readonly YouTubeCaptionTrack[],
  tabId: number,
): DetectedSubtitle[] {
  const now = Date.now();
  const out: DetectedSubtitle[] = [];

  for (const track of tracks) {
    if (requiresPoToken(track.baseUrl)) {
      console.warn(
        `[youtube-detector] skipping track requiring PO Token: ${track.languageCode}`,
      );
      continue;
    }

    const displayName =
      track.name?.simpleText?.trim() || track.languageCode.toUpperCase();

    out.push({
      id: generateId(),
      url: buildVttUrl(track.baseUrl),
      format: 'vtt',
      language: track.languageCode.toLowerCase(),
      tabId,
      detectedAt: now,
      isAsr: track.kind === 'asr',
      displayName,
    });
  }

  return out;
}
