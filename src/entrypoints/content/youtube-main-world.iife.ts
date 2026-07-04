// === YouTube MAIN-world subtitle detector (ADR-020) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start',
// matches: *://*.youtube.com/*) to read `window.ytInitialPlayerResponse`
// — which is NOT accessible from the isolated-world content-script.
//
// Detected caption tracks are forwarded to the isolated-world content-script
// via `window.postMessage` (main world has no `chrome.runtime` access).
// The isolated content-script listens and relays `DETECTED_SUBTITLES` to the
// background, which maps them to `DetectedSubtitle[]` and triggers auto-load.
//
// ponytail: self-contained IIFE (no imports — consistency with
// fetchInterceptor.iife.ts ADR-011 precedent). CRXJS emits this as a
// standalone bundle via the `.iife.ts` suffix.
// Ceiling: if YouTube renames `ytInitialPlayerResponse`, detection fails
// silently — the InnerTube fallback (background SW fetch) covers this.
// Upgrade: also hook `ytplayer.config` or `ytInitialData` for resilience.
(() => {
  // === Inline extractors (mirror youtubeSubtitleDetector.ts — kept in sync) ===
  function extractCaptionTracks(playerResponse: unknown): unknown[] {
    if (typeof playerResponse !== 'object' || playerResponse === null) return [];
    const captions = (playerResponse as Record<string, unknown>).captions;
    if (typeof captions !== 'object' || captions === null) return [];
    const renderer = (captions as Record<string, unknown>)
      .playerCaptionsTracklistRenderer;
    if (typeof renderer !== 'object' || renderer === null) return [];
    const tracks = (renderer as Record<string, unknown>).captionTracks;
    return Array.isArray(tracks) ? tracks : [];
  }

  function extractInnertubeApiKey(html: string): string | null {
    const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }

  function getVideoId(playerResponse: unknown): string | null {
    if (typeof playerResponse !== 'object' || playerResponse === null) return null;
    const details = (playerResponse as Record<string, unknown>).videoDetails;
    if (typeof details !== 'object' || details === null) return null;
    const id = (details as Record<string, unknown>).videoId;
    return typeof id === 'string' ? id : null;
  }

  let lastVideoId: string | null = null;

  function detect(): void {
    try {
      const playerResponse = (window as unknown as Record<string, unknown>)
        .ytInitialPlayerResponse;
      const videoId = getVideoId(playerResponse);
      if (!videoId || videoId === lastVideoId) return;
      lastVideoId = videoId;

      const tracks = extractCaptionTracks(playerResponse);
      if (tracks.length > 0) {
        window.postMessage(
          { type: '__YT_DETECTED_SUBTITLES', tracks, videoId },
          '*',
        );
        return;
      }

      // No caption tracks in DOM → InnerTube fallback (background SW fetch).
      // MAIN world cannot fetch with User-Agent override, so it requests the
      // background to do it (ADR-020 Contract 5).
      const apiKey = extractInnertubeApiKey(document.documentElement.innerHTML);
      if (apiKey) {
        window.postMessage(
          { type: '__YT_INNERTUBE_FALLBACK', videoId, apiKey },
          '*',
        );
      }
    } catch (err) {
      // Swallow — never break the page on instrumentation error (ADR-011 precedent).
      console.warn('[youtube-main-world] detect failed:', err);
    }
  }

  function pollForVideoIdChange(timeoutMs: number): void {
    const start = Date.now();
    const interval = setInterval(() => {
      const playerResponse = (window as unknown as Record<string, unknown>)
        .ytInitialPlayerResponse;
      const currentVideoId = getVideoId(playerResponse);
      if (currentVideoId && currentVideoId !== lastVideoId) {
        clearInterval(interval);
        detect();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
      }
    }, 100);
  }

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

  // Initial detection on script load (covers first page load + reinject).
  detect();
})();
