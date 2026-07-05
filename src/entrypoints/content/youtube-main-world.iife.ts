// === YouTube MAIN-world subtitle detector (ADR-020) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start',
// matches: *://*.youtube.com/*) to fetch caption tracks via the InnerTube
// ANDROID client — which returns tracks WITHOUT PO Token requirement.
//
// Browser verify (2026-07-04):
// - YouTube's WEB client `ytInitialPlayerResponse` caption tracks ALL have
//   `exp=xpe` (PO Token required, ephemeral). Fetching VTT without PO Token
//   returns empty (200 OK, 0 bytes).
// - The ANDROID InnerTube client returns tracks with `exp=null` (NO PO Token).
//   Verified on `YQHsXMglC9A` (Adele - Hello) — VTT fetch returns 18019 bytes.
// - ANDROID client works from PAGE context (has YouTube cookies + origin).
//   Background SW fetch returns 403 (no cookies/origin — cross-origin block).
//   Content scripts cannot set User-Agent (forbidden header), but ANDROID
//   client works WITHOUT User-Agent override (verified empirically).
//
// Architecture: MAIN world fetches InnerTube ANDROID → extracts caption tracks
// → postMessage `__YT_DETECTED_SUBTITLES` to ISOLATED content-script → relays
// to background as DETECTED_SUBTITLES → maps to DetectedSubtitle[] → auto-load.
//
// ponytail: self-contained IIFE (no imports — consistency with
// fetchInterceptor.iife.ts ADR-011 precedent). CRXJS emits this as a
// standalone bundle via the `.iife.ts` suffix.
// Ceiling: if YouTube blocks ANDROID client or renames `ytcfg`, detection
// fails silently. Upgrade: try IOS client as fallback (also returns tracks
// without PO Token — verified 2026-07-04).
(() => {
  // Marker for injection verification (visible from DevTools evaluate_script).
  (window as unknown as Record<string, unknown>).__YT_MAIN_WORLD_INJECTED = true;

  const ANDROID_CLIENT_VERSION = '20.10.38';
  const INNERTUBE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

  function extractInnertubeApiKey(html: string): string | null {
    const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }

  function getVideoIdFromPlayerResponse(playerResponse: unknown): string | null {
    if (typeof playerResponse !== 'object' || playerResponse === null) return null;
    const details = (playerResponse as Record<string, unknown>).videoDetails;
    if (typeof details !== 'object' || details === null) return null;
    const id = (details as Record<string, unknown>).videoId;
    return typeof id === 'string' ? id : null;
  }

  function getVideoIdFromUrl(): string | null {
    try {
      const url = new URL(location.href);
      return url.searchParams.get('v');
    } catch {
      return null;
    }
  }

  /** Extract visitorData from ytcfg INNERTUBE_CONTEXT (MAIN world only). */
  function getVisitorData(): string | undefined {
    try {
      const ytcfg = (window as unknown as { ytcfg?: { get?: (k: string) => unknown } }).ytcfg;
      if (!ytcfg?.get) return undefined;
      const ctx = ytcfg.get('INNERTUBE_CONTEXT') as
        | { client?: { visitorData?: string } }
        | undefined;
      return ctx?.client?.visitorData;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch caption tracks via InnerTube ANDROID client (NO PO Token).
   * MUST run in MAIN world — needs YouTube cookies + origin (SW fetch 403s).
   */
  async function fetchCaptionTracksViaInnerTube(
    videoId: string,
    apiKey: string,
    visitorData?: string,
  ): Promise<unknown[]> {
    const client: Record<string, unknown> = {
      clientName: 'ANDROID',
      clientVersion: ANDROID_CLIENT_VERSION,
    };
    if (visitorData) client.visitorData = visitorData;
    const body = { context: { client }, videoId };
    const url = `${INNERTUBE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.warn(`[youtube-main-world] InnerTube HTTP ${response.status}`);
        return [];
      }
      const json: unknown = await response.json();
      if (typeof json !== 'object' || json === null) return [];
      const captions = (json as Record<string, unknown>).captions;
      if (typeof captions !== 'object' || captions === null) return [];
      const renderer = (captions as Record<string, unknown>)
        .playerCaptionsTracklistRenderer;
      if (typeof renderer !== 'object' || renderer === null) return [];
      const tracks = (renderer as Record<string, unknown>).captionTracks;
      return Array.isArray(tracks) ? tracks : [];
    } catch (err) {
      console.warn('[youtube-main-world] InnerTube fetch failed:', err);
      return [];
    }
  }

  let lastVideoId: string | null = null;
  // Cache last detected tracks so a late-injecting content-script can request
  // a re-post via `__YT_CS_READY` handshake (ADR-020 race fix: CRXJS async
  // dynamic-import loader delays ISOLATED content-script listener registration
  // past the MAIN-world post on SPA navigation).
  let lastDetectedTracks: unknown[] = [];
  let lastDetectedVideoId: string | null = null;
  const debug: { detectCalls: number; lastVideoId: string | null; lastError: string | null; lastTrackCount: number; pollCycles: number; repostCount: number; postTime: number } = {
    detectCalls: 0,
    lastVideoId: null,
    lastError: null,
    lastTrackCount: -1,
    pollCycles: 0,
    repostCount: 0,
    postTime: -1,
  };
  (window as unknown as Record<string, unknown>).__YT_DEBUG = debug;

  function postDetectedSubtitles(tracks: unknown[], videoId: string): void {
    const postTime = performance.now();
    debug.postTime = postTime;
    console.log(`[youtube-main-world] posting __YT_DETECTED_SUBTITLES at ${postTime}`, {
      videoId,
      trackCount: tracks.length,
    });
    window.postMessage(
      { type: '__YT_DETECTED_SUBTITLES', tracks, videoId, postTime },
      '*',
    );
  }

  async function detect(): Promise<void> {
    debug.detectCalls++;
    try {
      const playerResponse = (window as unknown as Record<string, unknown>)
        .ytInitialPlayerResponse;
      // URL-first: on SPA navigation (radio mix, playlist click) YouTube updates
      // the URL immediately but `ytInitialPlayerResponse` stays stale (old videoId)
      // indefinitely — prioritising playerResponse made currentVideoId ===
      // lastVideoId so poll never triggered detect. URL changes first on SPA nav,
      // and on hard nav `location.href` already has `v` at document_start.
      const videoId =
        getVideoIdFromUrl() ?? getVideoIdFromPlayerResponse(playerResponse);
      debug.lastVideoId = videoId;
      if (!videoId || videoId === lastVideoId) return;

      const apiKey = extractInnertubeApiKey(document.documentElement.innerHTML);
      if (!apiKey) {
        // Page HTML not yet fully rendered (API key injected by YouTube's
        // script after initial paint). Do NOT cache lastVideoId — allow retry
        // on next poll cycle / yt-navigate-finish.
        console.warn('[youtube-main-world] no INNERTUBE_API_KEY yet, will retry');
        debug.lastError = 'no API key';
        return;
      }
      // API key available → commit to this videoId (prevent duplicate detect).
      lastVideoId = videoId;
      const visitorData = getVisitorData();

      // Fetch via ANDROID client — returns tracks WITHOUT PO Token (exp=null).
      // WEB client tracks all require PO Token (exp=xpe, ephemeral).
      const tracks = await fetchCaptionTracksViaInnerTube(videoId, apiKey, visitorData);
      debug.lastTrackCount = tracks.length;
      console.log(`[youtube-main-world] ANDROID InnerTube returned ${tracks.length} tracks`, {
        videoId,
        hasVisitorData: !!visitorData,
      });

      if (tracks.length > 0) {
        lastDetectedTracks = tracks;
        lastDetectedVideoId = videoId;
        postDetectedSubtitles(tracks, videoId);
      }
    } catch (err) {
      // Swallow — never break the page on instrumentation error (ADR-011 precedent).
      debug.lastError = err instanceof Error ? err.message : String(err);
      console.warn('[youtube-main-world] detect failed:', err);
    }
  }

  function pollForVideoIdChange(timeoutMs: number): void {
    const start = Date.now();
    debug.pollCycles++;
    const interval = setInterval(() => {
      const playerResponse = (window as unknown as Record<string, unknown>)
        .ytInitialPlayerResponse;
      const currentVideoId =
        getVideoIdFromUrl() ?? getVideoIdFromPlayerResponse(playerResponse);
      // Only trigger detect when BOTH videoId is new AND API key is available
      // (YouTube injects INNERTUBE_API_KEY into HTML after initial paint —
      // detecting before that fails with "no API key" and wastes the attempt).
      if (currentVideoId && currentVideoId !== lastVideoId) {
        const apiKey = extractInnertubeApiKey(document.documentElement.innerHTML);
        if (apiKey) {
          clearInterval(interval);
          void detect();
        }
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
      }
    }, 100);
  }

  // Handshake: content-script posts `__YT_CS_READY` when its ISOLATED-world
  // message listener registers (CRXJS async loader delays this past the MAIN
  // world post on SPA navigation). Re-post last detected tracks so the late
  // listener receives them. Dedup is the content-script's responsibility
  // (it ignores duplicates by videoId).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string } | null;
    if (data?.type === '__YT_CS_READY' && lastDetectedTracks.length > 0 && lastDetectedVideoId) {
      debug.repostCount++;
      console.log('[youtube-main-world] __YT_CS_READY received, re-posting last tracks', {
        videoId: lastDetectedVideoId,
        trackCount: lastDetectedTracks.length,
      });
      postDetectedSubtitles(lastDetectedTracks, lastDetectedVideoId);
    }
  });

  // Primary SPA trigger: YouTube fires `yt-navigate-finish` after SPA nav.
  // Race condition: `ytInitialPlayerResponse` may not be updated yet when the
  // event fires → poll until videoId changes from last-seen (timeout 2s).
  window.addEventListener('yt-navigate-finish', () => pollForVideoIdChange(2000));

  // Fallback SPA trigger: popstate (back/forward) + pushState hook.
  window.addEventListener('popstate', () => pollForVideoIdChange(2000));
  const originalPushState = history.pushState;
  history.pushState = function patchedPushState(
    ...args: Parameters<typeof history.pushState>
  ): void {
    const result = originalPushState.apply(this, args);
    pollForVideoIdChange(2000);
    return result;
  };

  // Initial detection: poll until `ytInitialPlayerResponse` is available.
  // At document_start the global is NOT yet defined (YouTube's script injects
  // it later) → a direct `detect()` call returns early and never retries.
  // Poll for up to 10s (covers slow first paint + API key injection + reinject
  // after SPA nav).
  pollForVideoIdChange(10000);
})();
