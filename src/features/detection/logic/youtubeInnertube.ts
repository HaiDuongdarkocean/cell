/**
 * InnerTube fallback — POST `/youtubei/v1/player` (WEB client) when the
 * MAIN-world DOM parse of `ytInitialPlayerResponse` fails or yields no
 * caption tracks.
 *
 * Constraint (ADR-020 Contract 5): content scripts CANNOT set the
 * `User-Agent` header (forbidden header — MDN). The ANDROID client context
 * requires an ANDROID `User-Agent`, so it is unfeasible from a content
 * script. This module uses the WEB client context and is fetched by the
 * BACKGROUND service worker (which has no `User-Agent` restriction on
 * `fetch`). The WEB client may still require a PO Token — `mapYouTubeCaptionTracks`
 * skips those tracks gracefully.
 *
 * Sources:
 * - github.com/nadimtuhin/ytranscript/HOW_IT_WORKS.md
 * - medium.com/@aqib-2 (Innertube API 2025 guide)
 * - ADR-020 Contract 5
 */
import type { YouTubeCaptionTrack } from './youtubeSubtitleDetector';
import { extractCaptionTracks } from './youtubeSubtitleDetector';

/** Regex to extract `INNERTUBE_API_KEY` from page HTML (MAIN-world side). */
const INNERTUBE_API_KEY_RE = /"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/;

/** Regex to extract `INNERTUBE_CONTEXT` client version from page HTML. */
const CLIENT_VERSION_RE = /"clientVersion"\s*:\s*"([^"]+)"/;

/** InnerTube API endpoint (no `User-Agent` override — WEB client). */
const INNERTUBE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

/** InnerTube WEB client context (no ANDROID `User-Agent` — ADR-020). */
interface InnerTubeContext {
  readonly clientName: string;
  readonly clientVersion: string;
}

/**
 * Extract the InnerTube API key from page HTML.
 *
 * Called from the MAIN-world script (page HTML is available there); the key
 * is forwarded to the background via `postMessage` so the background SW can
 * call InnerTube without re-fetching the page.
 *
 * @returns the API key string, or `null` when not found.
 */
export function extractInnertubeApiKey(html: string): string | null {
  const match = html.match(INNERTUBE_API_KEY_RE);
  return match?.[1] ?? null;
}

/**
 * Extract the WEB client version from page HTML (falls back to a recent
 * stable version when not found, so the fallback still works if YouTube
 * changes the HTML structure).
 */
export function extractClientVersion(html: string): string {
  const match = html.match(CLIENT_VERSION_RE);
  return match?.[1] ?? '2.20240701.00.00';
}

/**
 * Build the InnerTube POST body for the WEB client context.
 *
 * The WEB client does NOT require an ANDROID `User-Agent` — it uses the
 * browser's default `User-Agent`, which the background SW `fetch` sends
 * automatically (content scripts cannot set `User-Agent` — forbidden header).
 */
function buildInnerTubeBody(
  videoId: string,
  clientVersion: string,
): Record<string, unknown> {
  return {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion,
      },
    },
    videoId,
  };
}

/**
 * Fetch caption tracks via the InnerTube API (WEB client).
 *
 * MUST be called from the BACKGROUND service worker — content scripts cannot
 * set `User-Agent` (forbidden header), and the WEB client response depends
 * on the browser's default `User-Agent`. The background SW `fetch` sends it
 * automatically.
 *
 * @param videoId - YouTube video ID (e.g. `dQw4w9WgXcQ`).
 * @param apiKey - InnerTube API key (extracted from page HTML by the MAIN
 *   world script).
 * @param clientVersion - Optional client version (extracted from page HTML).
 *   Falls back to a recent stable version.
 * @returns `YouTubeCaptionTrack[]` (empty if the response has no captions or
 *   the request fails).
 */
export async function fetchCaptionTracksViaInnerTube(
  videoId: string,
  apiKey: string,
  clientVersion?: string,
): Promise<YouTubeCaptionTrack[]> {
  const version = clientVersion ?? '2.20240701.00.00';
  const url = `${INNERTUBE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const body = buildInnerTubeBody(videoId, version);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn(
        `[youtube-innertube] HTTP ${response.status} for videoId=${videoId}`,
      );
      return [];
    }
    const json: unknown = await response.json();
    return extractCaptionTracks(json);
  } catch (err) {
    console.warn(
      `[youtube-innertube] fetch failed for videoId=${videoId}:`,
      err,
    );
    return [];
  }
}

/**
 * Build the InnerTube context (exported for testing).
 */
export function buildInnerTubeContext(
  clientVersion: string,
): InnerTubeContext {
  return { clientName: 'WEB', clientVersion };
}
