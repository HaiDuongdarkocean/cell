// === iQIYI MAIN-world subtitle detector (ADR-028) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start',
// matches: *://*.iq.com/* + *://*.iqiyi.com/*) to read the subtitle manifest
// from `window.playerObject.package.engine.movieinfo.current.originalData
// .data.program.stl[]`.
//
// Browser verify (2026-07-12, edge-devtools MCP):
// - iQIYI does NOT expose subtitles via a public API. The full manifest
//   (all languages, human + AI) is injected into `window.playerObject` on
//   the MAIN world context ~3-7s after page load.
// - SRT URLs are plaintext (no WASM encryption — yt-dlp #7734 no longer
//   reproduces on free ep56 or VIP ep51, 2026-07-12).
// - Direct subtitle fetch from page context with `credentials:'omit'` works
//   (CORS `access-control-allow-origin:*`). Background SW fetch needs
//   `declarativeNetRequest` to set `Referer: https://www.iq.com/` (Cell has
//   this pattern from commit 700b901).
//
// Architecture: MAIN world polls `playerObject` → extracts `stl[]` →
// postMessage `__IQ_DETECTED_SUBTITLES` to ISOLATED content-script → relays
// to background as DETECTED_SUBTITLES (source:'iqiyi') → unified
// `detectionDispatch.ts` maps to DetectedSubtitle[] → auto-load flow.
//
// ponytail: self-contained IIFE (no imports — consistency with
// fetchInterceptor.iife.ts ADR-011 + youtube-main-world.iife.ts ADR-020).
// CRXJS emits this as a standalone bundle via the `.iife.ts` suffix.
// Ceiling: if iQIYI renames `playerObject` or restructures the deep path,
// detection fails silently. Upgrade: re-verify via MCP + update path.
(() => {
  // Marker for injection verification (visible from DevTools evaluate_script).
  (window as unknown as Record<string, unknown>).__IQ_MAIN_WORLD_INJECTED = true;

  const debug: {
    detectCalls: number;
    lastTvid: string | null;
    lastError: string | null;
    lastTrackCount: number;
    pollCycles: number;
    repostCount: number;
    postTime: number;
  } = {
    detectCalls: 0,
    lastTvid: null,
    lastError: null,
    lastTrackCount: -1,
    pollCycles: 0,
    repostCount: 0,
    postTime: -1,
  };
  (window as unknown as Record<string, unknown>).__IQ_DEBUG = debug;

  let lastTvid: string | null = null;
  // Cache last detected tracks so a late-injecting content-script can request
  // a re-post via `__IQ_CS_READY` handshake (ADR-028 race fix: CRXJS async
  // dynamic-import loader delays ISOLATED content-script listener registration
  // past the MAIN-world post on SPA navigation).
  let lastDetectedTracks: unknown[] = [];
  let lastDetectedTvid: string | null = null;

  function getPlayerObject(): unknown {
    return (window as unknown as { playerObject?: unknown }).playerObject;
  }

  /** Deep-walk `playerObject` to `current` (the per-episode info node). */
  function getCurrentNode(playerObject: unknown): Record<string, unknown> | null {
    if (typeof playerObject !== 'object' || playerObject === null) return null;
    try {
      const pkg = (playerObject as Record<string, unknown>).package;
      if (typeof pkg !== 'object' || pkg === null) return null;
      const engine = (pkg as Record<string, unknown>).engine;
      if (typeof engine !== 'object' || engine === null) return null;
      const movieinfo = (engine as Record<string, unknown>).movieinfo;
      if (typeof movieinfo !== 'object' || movieinfo === null) return null;
      const current = (movieinfo as Record<string, unknown>).current;
      if (typeof current === 'object' && current !== null) {
        return current as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Extract `tvid` (title/video ID — dedup key, clone YouTube `videoId`).
   *  iQIYI's `tvid` is the per-video identifier (different across episodes
   *  within a series — verified on iq.com: ep51 tvid=2220094256397200,
   *  ep56 tvid=1148400684481200). The `vid` field is a streaming session
   *  ID reused across unrelated videos and must NOT be used for dedup. */
  function getTvid(playerObject: unknown): string | null {
    const current = getCurrentNode(playerObject);
    if (!current) return null;
    try {
      // `tvid` appears at multiple levels (stress test 2026-07-12):
      //   current.tvid, current.originalData.tvid, current.originalData.data.tvid
      // All are numbers (e.g. 1148400684481200). Check each, coerce to string.
      const candidates: unknown[] = [
        (current as Record<string, unknown>).tvid,
      ];
      const originalData = (current as Record<string, unknown>).originalData;
      if (typeof originalData === 'object' && originalData !== null) {
        candidates.push((originalData as Record<string, unknown>).tvid);
        const data = (originalData as Record<string, unknown>).data;
        if (typeof data === 'object' && data !== null) {
          candidates.push((data as Record<string, unknown>).tvid);
        }
      }
      for (const c of candidates) {
        if (typeof c === 'string' && c.length > 0) return c;
        if (typeof c === 'number' && Number.isFinite(c)) return String(c);
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Extract `stl[]` from `playerObject...program.stl`. */
  function extractStl(playerObject: unknown): unknown[] {
    const current = getCurrentNode(playerObject);
    if (!current) return [];
    try {
      const originalData = (current as Record<string, unknown>).originalData;
      if (typeof originalData !== 'object' || originalData === null) return [];
      const data = (originalData as Record<string, unknown>).data;
      if (typeof data !== 'object' || data === null) return [];
      const program = (data as Record<string, unknown>).program;
      if (typeof program !== 'object' || program === null) return [];
      const stl = (program as Record<string, unknown>).stl;
      return Array.isArray(stl) ? stl : [];
    } catch {
      return [];
    }
  }

  /** Extract `dstl` (subtitle CDN base URL) and upgrade HTTP→HTTPS. */
  function getOrigin(playerObject: unknown): string {
    const current = getCurrentNode(playerObject);
    if (!current) return 'https://meta.video.iqiyi.com';
    try {
      const originalData = (current as Record<string, unknown>).originalData;
      if (typeof originalData !== 'object' || originalData === null) {
        return 'https://meta.video.iqiyi.com';
      }
      const data = (originalData as Record<string, unknown>).data;
      if (typeof data !== 'object' || data === null) {
        return 'https://meta.video.iqiyi.com';
      }
      const dstl = (data as Record<string, unknown>).dstl;
      if (typeof dstl !== 'string') return 'https://meta.video.iqiyi.com';
      // Stress test ep56: dstl="http://meta.video.iqiyi.com" — HTTPS fetch works.
      return dstl.replace(/^http:/, 'https:');
    } catch {
      return 'https://meta.video.iqiyi.com';
    }
  }

  function postDetectedSubtitles(
    tracks: unknown[],
    tvid: string,
    origin: string,
  ): void {
    const postTime = performance.now();
    debug.postTime = postTime;
    console.log(
      `[iqiyi-main-world] posting __IQ_DETECTED_SUBTITLES at ${postTime}`,
      { tvid, trackCount: tracks.length, origin },
    );
    window.postMessage(
      { type: '__IQ_DETECTED_SUBTITLES', tracks, tvid, origin, postTime },
      '*',
    );
  }

  /**
   * Detect subtitles for the current `playerObject`.
   * Returns `true` when non-empty tracks were posted (signal to stop polling).
   * Dedup by `tvid` (per-video ID). Commits `lastTvid` only after `extractStl`
   * runs — if `stl` is late (playerObject ready but stl not yet loaded), the
   * next poll re-tries the same tvid instead of deduplicating and never
   * reporting (spec-reviewer risk #4 fix).
   */
  async function detect(): Promise<boolean> {
    debug.detectCalls++;
    try {
      const playerObject = getPlayerObject();
      if (!playerObject) return false; // not ready yet, poll continues
      const tvid = getTvid(playerObject);
      if (!tvid || tvid === lastTvid) return false;

      const tracks = extractStl(playerObject);
      const origin = getOrigin(playerObject);
      // Commit lastTvid AFTER extract — re-try same tvid if stl was missing.
      lastTvid = tvid;
      debug.lastTvid = tvid;
      debug.lastTrackCount = tracks.length;

      if (tracks.length > 0) {
        lastDetectedTracks = tracks;
        lastDetectedTvid = tvid;
      }
      // Always post — 0-track post = SPA nav to no-subtitle video → clear
      // overlay (clone ADR-020 logic in youtubeDetection.ts).
      postDetectedSubtitles(tracks, tvid, origin);
      return tracks.length > 0;
    } catch (err) {
      // Swallow — never break the page on instrumentation error (ADR-011 precedent).
      debug.lastError = err instanceof Error ? err.message : String(err);
      console.warn('[iqiyi-main-world] detect failed:', err);
      return false;
    }
  }

  // Primary trigger: poll on page load (playerObject available ~3-7s after load).
  // ponytail: ceiling — poll timeout 15s if player init is slow (rare, slow network).
  // Upgrade: MutationObserver on <video> element.
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  function startPolling(timeoutMs = 15000): void {
    const start = Date.now();
    debug.pollCycles++;
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        return;
      }
      void detect().then((success) => {
        if (success && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      });
    }, 1000);
  }

  // SPA trigger: iQIYI uses the history API (no custom event like yt-navigate-finish).
  // ponytail: ceiling — iQIYI may override history.pushState after our hook → hook lost.
  // Upgrade: re-hook if override detected, or MutationObserver on URL.
  const originalPushState = history.pushState;
  history.pushState = function patchedPushState(
    ...args: Parameters<typeof history.pushState>
  ): void {
    const result = originalPushState.apply(this, args);
    if (!pollInterval) startPolling();
    else void detect();
    return result;
  };
  window.addEventListener('popstate', () => {
    if (!pollInterval) startPolling();
    else void detect();
  });

  // Handshake: content-script posts `__IQ_CS_READY` when its ISOLATED-world
  // message listener registers (CRXJS async loader delays this past the MAIN
  // world post on SPA navigation). Re-post last detected tracks so the late
  // listener receives them. Dedup is the content-script's responsibility
  // (it ignores duplicates by tvid). Mirror youtube-main-world.iife.ts guard
  // (spec-reviewer risk #3 fix).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string } | null;
    if (
      data?.type === '__IQ_CS_READY' &&
      lastDetectedTracks.length > 0 &&
      lastDetectedTvid
    ) {
      debug.repostCount++;
      const playerObject = getPlayerObject();
      const origin = getOrigin(playerObject);
      console.log(
        '[iqiyi-main-world] __IQ_CS_READY received, re-posting last tracks',
        { tvid: lastDetectedTvid, trackCount: lastDetectedTracks.length },
      );
      postDetectedSubtitles(lastDetectedTracks, lastDetectedTvid, origin);
    }
  });

  // Initial detection: poll until `playerObject` is available.
  // At document_start the global is NOT yet defined (iQIYI's player script
  // injects it ~3-7s later) → a direct `detect()` call returns early and
  // never retries. Poll for up to 15s (covers slow player init + reinject
  // after SPA nav).
  startPolling(15000);
})();
