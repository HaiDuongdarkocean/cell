// === Netflix MAIN-world subtitle detector (ADR-029, pivoted 2026-07-13) ===
// Runs in the PAGE's main world (world: 'MAIN', run_at: 'document_start',
// matches: *://*.netflix.com/*) to detect subtitles by traversing the
// Netflix player's internal object graph.
//
// Architecture: poll for player availability → DFS/BFS traverse
// `cadmiumPlayerRepository.playersById[sessionId]` for `type === 'timedtext'`
// nodes with `urls[0].url` → pair with `getTimedTextTrackList()` metadata →
// post tracks via `window.postMessage` to the ISOLATED content-script →
// relays to background DETECTED_SUBTITLES (source:'netflix') →
// `mapNetflixSubtitleTracks`.
//
// Pivoted from JSON.parse/stringify hooks (asbplayer 1.18.0 approach) to
// graph traversal (asbplayer 1.19.0 approach) because cadmium 6.0059+
// no longer parses the MSL manifest via `JSON.parse` — it uses a
// schema-based custom parser with short field codes.
//
// ponytail: self-contained IIFE (no imports — consistency with
// fetchInterceptor.iife.ts ADR-011 + youtube-main-world.iife.ts ADR-020).
// CRXJS emits this as a standalone bundle via the `.iife.ts` suffix.
// Ceiling: if Netflix renames `cadmiumPlayerRepository` or changes the
// `type === 'timedtext'` node shape, traversal returns empty → hookMiss.
// Diagnostic: `__NF_DEBUG.hookMiss` + console.warn after 30s.
(() => {
  // === Types (erased at runtime) ===
  interface NetflixTrackMeta {
    readonly trackId: string;
    readonly bcp47: string;
    readonly displayName: string;
    readonly rawTrackType: string;
    readonly isNoneTrack: boolean;
    readonly isForcedNarrative: boolean;
    readonly isImageBased: boolean;
  }

  interface DetectedMessage {
    readonly type: '__NF_DETECTED_SUBTITLES';
    readonly tracks: (NetflixTrackMeta & { url: string })[];
    readonly movieId: number | string;
    readonly postTime: number;
  }

  // === Debug surface (clone iQIYI __IQ_DEBUG pattern) ===
  const __NF_MAIN_WORLD_INJECTED = true;
  const __NF_DEBUG = {
    captureCount: 0,
    lastMovieId: null as number | string | null,
    lastError: null as string | null,
    hookMiss: false,
    playerFound: false,
  };

  const globalWindow = window as unknown as Record<string, unknown>;
  globalWindow.__NF_MAIN_WORLD_INJECTED = __NF_MAIN_WORLD_INJECTED;
  globalWindow.__NF_DEBUG = __NF_DEBUG;

  // === State ===
  let lastDetectedTracks: (NetflixTrackMeta & { url: string })[] | null = null;
  let lastDetectedMovieId: number | string | null = null;
  let detectTimer: ReturnType<typeof setTimeout> | null = null;

  // === Helpers ===
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /** Deep-optional access helper — `dig(obj, 'a', 'b', 'c')` → `obj?.a?.b?.c`. */
  function dig(root: unknown, ...keys: string[]): unknown {
    let cur: unknown = root;
    for (const k of keys) {
      if (!isObject(cur)) return undefined;
      cur = cur[k];
    }
    return cur;
  }

  /** Access `netflix.appContext.state.playerApp.getAPI().videoPlayer`. */
  function getVideoPlayer(): Record<string, unknown> | undefined {
    const netflix = dig(globalWindow, 'netflix');
    if (netflix === undefined) return undefined;
    const api = dig(netflix, 'appContext', 'state', 'playerApp', 'getAPI');
    if (typeof api !== 'function') return undefined;
    const result = (api as () => unknown)();
    if (!isObject(result)) return undefined;
    const vp = result.videoPlayer;
    return isObject(vp) ? vp : undefined;
  }

  /** Get the active player session (last session ID). */
  function getPlayer(): Record<string, unknown> | undefined {
    const vp = getVideoPlayer();
    if (!vp) return undefined;
    const getIds = vp.getAllPlayerSessionIds;
    if (typeof getIds !== 'function') return undefined;
    const ids = (getIds as () => unknown[])() || [];
    if (ids.length === 0) return undefined;
    const getBySid = vp.getVideoPlayerBySessionId;
    if (typeof getBySid !== 'function') return undefined;
    const player = (getBySid as (id: unknown) => unknown)(ids[ids.length - 1]);
    return isObject(player) ? player : undefined;
  }

  /**
   * DFS/BFS traverse the player's internal object graph to find
   * `type === 'timedtext'` nodes with `urls[0].url`.
   * Returns `Map<trackId, url>`.
   * Ceiling: depth ≤ 20, WeakSet for cycle detection.
   */
  function traversePlayerGraph(): Map<string, string> {
    const urlMap = new Map<string, string>();
    const vp = getVideoPlayer();
    if (!vp) return urlMap;

    const getIds = vp.getAllPlayerSessionIds;
    if (typeof getIds !== 'function') return urlMap;
    const ids = (getIds as () => unknown[])() || [];
    if (ids.length === 0) return urlMap;
    const sid = ids[ids.length - 1];

    const root = dig(
      globalWindow,
      'netflix',
      'appContext',
      'state',
      'playerApp',
      'getState',
    );
    // getState is a function — call it, then dig into the result.
    if (typeof root !== 'function') return urlMap;
    const state = (root as () => unknown)();
    const playerRepo = dig(state, 'videoPlayer', 'cadmiumPlayerRepository', 'playersById');
    if (!isObject(playerRepo)) return urlMap;
    const node = playerRepo[sid as unknown as string];
    if (!isObject(node)) return urlMap;

    const visited = new WeakSet<object>();
    const stack: { node: unknown; depth: number }[] = [{ node, depth: 0 }];

    while (stack.length > 0) {
      const { node: cur, depth } = stack.pop()!;
      if (!isObject(cur) || depth > 20 || visited.has(cur)) continue;
      visited.add(cur);
      if (cur instanceof ArrayBuffer || ArrayBuffer.isView(cur)) continue;

      try {
        if (
          cur.type === 'timedtext' &&
          typeof cur.trackId === 'string' &&
          Array.isArray(cur.urls) &&
          cur.urls.length > 0
        ) {
          const first = cur.urls[0];
          if (isObject(first) && typeof first.url === 'string' && !urlMap.has(cur.trackId)) {
            urlMap.set(cur.trackId, first.url);
          }
        }
      } catch {
        // skip inaccessible property
      }

      if (Array.isArray(cur)) {
        for (const item of cur) {
          if (isObject(item)) stack.push({ node: item, depth: depth + 1 });
        }
      } else {
        for (const key of Object.keys(cur)) {
          let val: unknown;
          try {
            val = cur[key];
          } catch {
            continue;
          }
          if (isObject(val)) stack.push({ node: val, depth: depth + 1 });
        }
      }
    }
    return urlMap;
  }

  /** Get track metadata from `getTimedTextTrackList()`. */
  function getTrackMetadata(): NetflixTrackMeta[] {
    const np = getPlayer();
    if (!np) return [];
    const getter = np.getTimedTextTrackList;
    if (typeof getter !== 'function') return [];
    const list = (getter as () => unknown[])() ?? [];
    return list.map((t: unknown): NetflixTrackMeta => {
      const track = isObject(t) ? t : {};
      return {
        trackId: String(track.trackId ?? ''),
        bcp47: String(track.bcp47 ?? ''),
        displayName: String(track.displayName ?? ''),
        rawTrackType: String(track.rawTrackType ?? ''),
        isNoneTrack: track.isNoneTrack === true,
        isForcedNarrative: track.isForcedNarrative === true,
        isImageBased: track.isImageBased === true,
      };
    });
  }

  /** Combine graph traversal URLs + track metadata → detected tracks. */
  function detectSubtitles(): void {
    try {
      const np = getPlayer();
      if (!np) return;

      const getMovieId = np.getMovieId;
      if (typeof getMovieId !== 'function') return;
      const rawMovieId = (getMovieId as () => unknown)();
      if (typeof rawMovieId !== 'number' && typeof rawMovieId !== 'string') return;
      const movieId: number | string = rawMovieId;

      const urlMap = traversePlayerGraph();
      const trackList = getTrackMetadata();

      const tracks: (NetflixTrackMeta & { url: string })[] = [];
      for (const meta of trackList) {
        if (meta.isNoneTrack || meta.isImageBased) continue;
        if (!meta.trackId || !meta.bcp47) continue;
        const url = urlMap.get(meta.trackId);
        if (!url) continue; // skip 'lazy' — only report tracks with ready URLs
        tracks.push({ ...meta, url });
      }

      if (tracks.length === 0) return;

      __NF_DEBUG.captureCount++;
      __NF_DEBUG.playerFound = true;
      __NF_DEBUG.lastMovieId = movieId;

      // Dedup: skip if same movieId + same track count (SPA nav triggers re-detect).
      const movieKey = String(movieId);
      if (
        movieKey === String(lastDetectedMovieId) &&
        tracks.length === (lastDetectedTracks?.length ?? 0)
      ) {
        return;
      }

      lastDetectedTracks = tracks;
      lastDetectedMovieId = movieId;
      postDetectedSubtitles(tracks, movieId);
    } catch (err) {
      __NF_DEBUG.lastError = err instanceof Error ? err.message : String(err);
      console.warn('[netflix-main-world] detectSubtitles failed:', err);
    }
  }

  function postDetectedSubtitles(
    tracks: (NetflixTrackMeta & { url: string })[],
    movieId: number | string,
  ): void {
    const postTime = performance.now();
    console.log('[netflix-main-world] posting __NF_DETECTED_SUBTITLES', {
      movieId,
      trackCount: tracks.length,
      postTime,
    });
    const message: DetectedMessage = {
      type: '__NF_DETECTED_SUBTITLES',
      tracks,
      movieId,
      postTime,
    };
    window.postMessage(message, '*');
  }

  // === Polling: wait for player to be ready, then detect ===
  function startDetectionCycle(): void {
    if (detectTimer) clearTimeout(detectTimer);

    let attempts = 0;
    const maxAttempts = 30; // 30 × 1s = 30s

    function tick() {
      attempts++;
      const np = getPlayer();
      if (np) {
        detectSubtitles();
        // If we got tracks, stop polling. Otherwise keep trying.
        if (__NF_DEBUG.captureCount > 0 || attempts >= maxAttempts) {
          if (__NF_DEBUG.captureCount === 0 && !__NF_DEBUG.hookMiss) {
            __NF_DEBUG.hookMiss = true;
            console.warn(
              '[netflix-main-world] hook miss — player found but no timedtext nodes. ' +
                'Netflix may have changed cadmiumPlayerRepository structure.',
            );
          }
          return;
        }
      }
      if (attempts < maxAttempts) {
        detectTimer = setTimeout(tick, 1000);
      } else if (!__NF_DEBUG.hookMiss) {
        __NF_DEBUG.hookMiss = true;
        console.warn(
          '[netflix-main-world] hook miss — Netflix player not found after 30s.',
        );
      }
    }

    detectTimer = setTimeout(tick, 2000); // initial 2s delay for page load
  }

  // === SPA navigation hooks (reset + re-detect) ===
  function hookNavigation(): void {
    const origPush = history.pushState;
    history.pushState = function patchedPushState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void {
      const result = origPush.call(history, data, unused, url);
      lastDetectedMovieId = null;
      lastDetectedTracks = null;
      __NF_DEBUG.captureCount = 0;
      startDetectionCycle();
      return result;
    };

    const origReplace = history.replaceState;
    history.replaceState = function patchedReplaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void {
      const result = origReplace.call(history, data, unused, url);
      lastDetectedMovieId = null;
      lastDetectedTracks = null;
      __NF_DEBUG.captureCount = 0;
      startDetectionCycle();
      return result;
    };

    window.addEventListener('popstate', () => {
      lastDetectedMovieId = null;
      lastDetectedTracks = null;
      __NF_DEBUG.captureCount = 0;
      startDetectionCycle();
    });
  }

  // === Initialization ===
  hookNavigation();
  startDetectionCycle();

  // Handshake: ISOLATED content-script posts __NF_CS_READY after listener register.
  // Re-post last tracks if it missed the original post (CRXJS async loader delay).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as { type?: string } | null;
    if (
      data?.type === '__NF_CS_READY' &&
      lastDetectedTracks &&
      lastDetectedTracks.length > 0 &&
      lastDetectedMovieId !== null
    ) {
      console.log(
        '[netflix-main-world] __NF_CS_READY received, re-posting last tracks',
        { movieId: lastDetectedMovieId, trackCount: lastDetectedTracks.length },
      );
      postDetectedSubtitles(lastDetectedTracks, lastDetectedMovieId);
    }
  });
})();
