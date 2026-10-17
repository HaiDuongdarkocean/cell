/**
 * YouTube player-mediated timedtext fetch.
 *
 * YouTube's timedtext endpoint rejects plain replays (HTTP 429 "Sorry" or
 * empty 200) unless the request carries a runtime-generated `pot` (PO Token)
 * parameter. The page's own player generates that token when it loads a
 * caption track — so when a direct/background fetch of a YouTube timedtext
 * URL fails, we ask the MAIN-world script to enable the matching caption
 * track on `#movie_player` and capture the response body the player receives.
 *
 * Bridge contract (postMessage, same window):
 *   ISOLATED → MAIN: { type: '__YT_TIMEDTEXT_REQUEST', requestId, lang, kind }
 *   MAIN → ISOLATED: { type: '__YT_TIMEDTEXT_RESPONSE', requestId, body }
 *
 * `body` is whatever the player fetched (srv3/json3/vtt) — callers normalize
 * via `youtubeTimedtextBodyToSrt`.
 */
import { youtubeTimedtextBodyToSrt } from '@/shared/lib/parsers/youtubeCaptionToSrt';
import { newId } from '@/shared/lib/id';
import type { SubtitleFormat } from '@/entities/subtitle';

const RESPONSE_TIMEOUT_MS = 12_000;

export function isYouTubeTimedtextUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/i.test(u.hostname) && u.pathname === '/api/timedtext';
  } catch {
    return false;
  }
}

interface TimedtextTrackRef {
  readonly lang: string | null;
  readonly kind: string | null;
}

function trackRefFromUrl(url: string): TimedtextTrackRef | null {
  try {
    const u = new URL(url);
    const lang = u.searchParams.get('lang');
    if (!lang) return null;
    return { lang, kind: u.searchParams.get('kind') };
  } catch {
    return null;
  }
}

/**
 * Fetch a YouTube caption track via the page's own player (MAIN world).
 * Returns `{ content, format }` — content is already normalized to VTT/SRT
 * text. `undefined` when the URL is not a timedtext URL, the player cannot
 * serve the track, or the request times out.
 */
export function fetchYouTubeCaptionViaPlayer(
  url: string,
): Promise<{ content: string; format: SubtitleFormat } | undefined> {
  const ref = trackRefFromUrl(url);
  if (!ref || !isYouTubeTimedtextUrl(url)) return Promise.resolve(undefined);
  if (typeof window === 'undefined') return Promise.resolve(undefined);

  const requestId = newId();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(undefined);
    }, RESPONSE_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.source !== window) return;
      const data = event.data as
        | { type?: string; requestId?: string; body?: string | null }
        | null;
      if (data?.type !== '__YT_TIMEDTEXT_RESPONSE' || data.requestId !== requestId) return;
      clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
      const body = data.body;
      if (!body) {
        resolve(undefined);
        return;
      }
      if (body.replace(/^\uFEFF/, '').trimStart().startsWith('WEBVTT')) {
        resolve({ content: body, format: 'vtt' });
        return;
      }
      const srt = youtubeTimedtextBodyToSrt(body);
      resolve(srt ? { content: srt, format: 'srt' } : undefined);
    }

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: '__YT_TIMEDTEXT_REQUEST', requestId, lang: ref.lang, kind: ref.kind },
      '*',
    );
  });
}
