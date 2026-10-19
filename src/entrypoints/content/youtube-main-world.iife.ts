// === YouTube MAIN-world subtitle detector (ADR-020, channel map ADR-123) ===
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
declare const __Tihoka_DEBUG__: string | undefined;

(() => {
  function isDebug(): boolean {
    return typeof __Tihoka_DEBUG__ !== 'undefined' && __Tihoka_DEBUG__ === 'true';
  }

  // Marker for injection verification (visible from DevTools evaluate_script).
  (window as unknown as Record<string, unknown>).__YT_MAIN_WORLD_INJECTED = true;

  // InnerTube clients that return caption tracks WITHOUT PO Token (exp=null).
  // ANDROID works most often; IOS is the fallback when ANDROID is flagged
  // (LOGIN_REQUIRED). Both work with the browser's default User-Agent.
  const INNERTUBE_CLIENTS = [
    { clientName: 'ANDROID', clientVersion: '20.10.38' },
    { clientName: 'IOS', clientVersion: '20.10.4' },
  ] as const;
  const INNERTUBE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

  function extractInnertubeApiKey(html: string): string | null {
    const match = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }

  let cachedApiKey: string | null = null;
  function resolveInnertubeApiKey(): string | null {
    if (cachedApiKey) return cachedApiKey;
    try {
      const ytcfg = (window as unknown as { ytcfg?: { get?: (k: string) => unknown } }).ytcfg;
      const key = ytcfg?.get?.('INNERTUBE_API_KEY');
      if (typeof key === 'string' && key) {
        cachedApiKey = key;
        return key;
      }
    } catch {}
    let scriptsText = '';
    for (const script of document.scripts) {
      if (script.src) continue;
      scriptsText += `${script.textContent ?? ''}\n`;
    }
    cachedApiKey = extractInnertubeApiKey(scriptsText);
    return cachedApiKey;
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
   * Fetch caption tracks via InnerTube (ANDROID → IOS fallback — both return
   * tracks WITHOUT PO Token). MUST run in MAIN world — needs YouTube cookies
   * + origin (SW fetch 403s).
   */
  async function fetchCaptionTracksViaInnerTube(
    videoId: string,
    apiKey: string,
    visitorData?: string,
  ): Promise<unknown[]> {
    const url = `${INNERTUBE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    for (const clientDef of INNERTUBE_CLIENTS) {
      const client: Record<string, unknown> = { ...clientDef };
      if (visitorData) client.visitorData = visitorData;
      const body = { context: { client }, videoId };
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          console.warn(
            `[youtube-main-world] InnerTube ${clientDef.clientName} HTTP ${response.status}`,
          );
          continue;
        }
        const json: unknown = await response.json();
        const status = (json as Record<string, unknown>)?.playabilityStatus as
          | { status?: string }
          | undefined;
        if (status?.status !== 'OK') {
          console.warn(
            `[youtube-main-world] InnerTube ${clientDef.clientName} playability=${status?.status}`,
          );
          continue;
        }
        const captions = (json as Record<string, unknown>).captions;
        if (typeof captions !== 'object' || captions === null) continue;
        const renderer = (captions as Record<string, unknown>)
          .playerCaptionsTracklistRenderer;
        if (typeof renderer !== 'object' || renderer === null) continue;
        const tracks = (renderer as Record<string, unknown>).captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
        return Array.isArray(tracks) ? tracks : [];
      } catch (err) {
        console.warn(
          `[youtube-main-world] InnerTube ${clientDef.clientName} fetch failed:`,
          err,
        );
      }
    }
    return [];
  }

  // === Player-mediated timedtext capture (PO Token workaround) ===
  // YouTube now rejects plain timedtext replays without a runtime `pot`
  // param (HTTP 429 "Sorry" or empty 200). The page's own player generates
  // the token when it loads a caption track, so on request from the isolated
  // content script we briefly enable the matching track on #movie_player and
  // capture the response body the player receives (XHR or fetch).
  const timedtextBodies = new Map<string, string>();
  const timedtextUrls = new Map<string, string>();

  function timedtextKey(url: string): string | null {
    try {
      const u = new URL(url, location.href);
      const lang = u.searchParams.get('lang');
      if (!lang) return null;
      return `${lang}|${u.searchParams.get('kind') ?? ''}`;
    } catch {
      return null;
    }
  }

  function captureTimedtextUrl(url: string): void {
    const key = timedtextKey(url);
    if (key) timedtextUrls.set(key, url);
  }

  function captureTimedtextBody(url: string, body: string): void {
    if (!body) return;
    captureTimedtextUrl(url);
    const key = timedtextKey(url);
    if (key) timedtextBodies.set(key, body);
  }

  // Other MAIN-world scripts (uBlock scriptlets, YouTube itself) re-wrap
  // XHR/fetch after document_start, silently dropping ours from the chain.
  // Re-install just-in-time: wrap whatever impl is current, marked via
  // __TihokaTt so repeated calls stay idempotent.
  type Marked<T> = T & { __TihokaTt?: true };
  function installTimedtextHooks(): void {
    const proto = XMLHttpRequest.prototype as {
      open: Marked<typeof XMLHttpRequest.prototype.open>;
      send: Marked<typeof XMLHttpRequest.prototype.send>;
    };
    if (!proto.open.__TihokaTt) {
      const prevOpen = proto.open;
      const open = function (
        this: XMLHttpRequest & { __TihokaTtUrl?: string },
        method: string,
        url: string | URL,
        ...rest: unknown[]
      ): void {
        this.__TihokaTtUrl = String(url);
        return (prevOpen as unknown as (...a: unknown[]) => void).call(
          this,
          method,
          url,
          ...rest,
        );
      } as Marked<typeof XMLHttpRequest.prototype.open>;
      open.__TihokaTt = true;
      proto.open = open;
    }
    if (!proto.send.__TihokaTt) {
      const prevSend = proto.send;
      const send = function (
        this: XMLHttpRequest & { __TihokaTtUrl?: string },
        ...args: unknown[]
      ): void {
        const url = this.__TihokaTtUrl;
        if (url && /\/api\/timedtext/.test(url)) {
          captureTimedtextUrl(url);
          this.addEventListener('load', () => {
            try {
              if (this.status === 200 && typeof this.responseText === 'string') {
                captureTimedtextBody(url, this.responseText);
              }
            } catch {
              /* best effort */
            }
          });
        }
        return (prevSend as unknown as (...a: unknown[]) => void).apply(this, args);
      } as Marked<typeof XMLHttpRequest.prototype.send>;
      send.__TihokaTt = true;
      proto.send = send;
    }
    const w = window as { fetch: Marked<typeof window.fetch> };
    if (!w.fetch.__TihokaTt) {
      const prevFetch = w.fetch;
      const fetchWrap = function (
        this: unknown,
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> {
        return prevFetch.call(this, input, init).then((response) => {
          try {
            const url =
              typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.href
                  : (input as Request).url;
            if (/\/api\/timedtext/.test(url)) {
              captureTimedtextUrl(url);
              if (response.ok) {
                void response
                  .clone()
                  .text()
                  .then((body) => captureTimedtextBody(url, body))
                  .catch(() => undefined);
              }
            }
          } catch {
            /* best effort */
          }
          return response;
        });
      } as Marked<typeof window.fetch>;
      fetchWrap.__TihokaTt = true;
      w.fetch = fetchWrap;
    }
  }
  installTimedtextHooks();

  interface CaptionsPlayerApi {
    getOption?: (module: string, option: string) => unknown;
    setOption?: (module: string, option: string, value: unknown) => void;
    loadModule?: (name: string) => void;
    unloadModule?: (name: string) => void;
  }

  function getMoviePlayer(): CaptionsPlayerApi | null {
    const el = document.getElementById('movie_player');
    return el ? (el as unknown as CaptionsPlayerApi) : null;
  }

  interface PlayerCaptionTrack {
    languageCode?: string;
    kind?: string;
    [key: string]: unknown;
  }

  function waitForTimedtextBody(key: string, timeoutMs: number): Promise<string | undefined> {
    const start = Date.now();
    return new Promise((resolve) => {
      const existing = timedtextBodies.get(key);
      if (existing) {
        resolve(existing);
        return;
      }
      const id = setInterval(() => {
        const body = timedtextBodies.get(key);
        if (body || Date.now() - start >= timeoutMs) {
          clearInterval(id);
          resolve(body);
        }
      }, 100);
    });
  }

  // Drives the player to fetch one caption track, captures the timedtext
  // body, then restores the user's previous caption state so native captions
  // do not stay enabled.
  async function fetchTrackViaPlayer(
    lang: string,
    kind: string | null,
  ): Promise<string | undefined> {
    const key = `${lang}|${kind ?? ''}`;
    const cached = timedtextBodies.get(key);
    if (cached) return cached;
    const player = getMoviePlayer();
    if (!player?.getOption || !player.setOption) return undefined;
    try {
      player.loadModule?.('captions');
    } catch {
      /* best effort */
    }
    // The captions module populates `tracklist` asynchronously; on some
    // videos it stays empty while `track` still reports the active track.
    // Poll briefly, then fall back to a synthesized track object.
    let track: PlayerCaptionTrack | undefined;
    for (let i = 0; i < 10 && !track; i++) {
      const tracklist = player.getOption('captions', 'tracklist');
      if (Array.isArray(tracklist)) {
        const tracks = tracklist as PlayerCaptionTrack[];
        track =
          tracks.find(
            (t) =>
              t.languageCode === lang && (kind ? t.kind === kind : !t.kind),
          ) ?? tracks.find((t) => t.languageCode === lang);
      }
      if (!track) {
        const cur = player.getOption('captions', 'track') as
          | PlayerCaptionTrack
          | undefined;
        if (cur?.languageCode === lang && (!kind || cur.kind === kind)) {
          track = cur;
        }
      }
      if (!track) await new Promise((s) => setTimeout(s, 200));
    }
    if (!track) {
      track = { languageCode: lang, kind: kind ?? undefined };
    }
    let prev: PlayerCaptionTrack | undefined;
    try {
      prev = player.getOption('captions', 'track') as PlayerCaptionTrack | undefined;
    } catch {
      prev = undefined;
    }
    installTimedtextHooks();
    try {
      player.loadModule?.('captions');
      if (prev?.languageCode === track.languageCode && (prev?.kind ?? '') === (track.kind ?? '')) {
        player.setOption('captions', 'track', {});
        await new Promise((s) => setTimeout(s, 300));
      }
      player.setOption('captions', 'track', track);
    } catch {
      return undefined;
    }
    let body = await waitForTimedtextBody(key, 10_000);
    if (!body) {
      for (const [k, v] of timedtextBodies) {
        if (k.startsWith(`${lang}|`)) {
          body = v;
          break;
        }
      }
    }
    if (!body) {
      let url = timedtextUrls.get(key);
      if (!url) {
        for (const [k, v] of timedtextUrls) {
          if (k.startsWith(`${lang}|`)) {
            url = v;
            break;
          }
        }
      }
      if (url) {
        try {
          const res = await fetch(url, { credentials: 'include' });
          if (res.ok) {
            const text = await res.text();
            if (text) {
              captureTimedtextBody(url, text);
              body = text;
            }
          }
        } catch {
          /* best effort */
        }
      }
    }
    try {
      if (prev?.languageCode) {
        player.setOption('captions', 'track', prev);
      } else {
        player.setOption('captions', 'track', {});
        player.unloadModule?.('captions');
      }
    } catch {
      /* best effort */
    }
    return body;
  }

  window.addEventListener('message', (event) => {
    const data = event.data as
      | { type?: string; requestId?: string; lang?: string; kind?: string | null }
      | null;
    if (data?.type !== '__YT_TIMEDTEXT_REQUEST' || !data.requestId || !data.lang) {
      return;
    }
    void fetchTrackViaPlayer(data.lang, data.kind ?? null).then((body) => {
      window.postMessage(
        {
          type: '__YT_TIMEDTEXT_RESPONSE',
          requestId: data.requestId,
          body: body ?? null,
        },
        '*',
      );
    });
  });

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
  if (isDebug()) (window as unknown as Record<string, unknown>).__YT_DEBUG = debug;

  // Split View CSS bridge: isolated world tells MAIN world to inject/remove
  // YouTube-specific CSS overrides for split view layout. These selectors
  // (.ytp-*, .html5-video-container) are YouTube-internal — they belong in
  // the YouTube adapter, not in generic React UI code (SubtitlePanels.tsx).
  // The marked shell ([data-tihoka-split-shell]) and fullscreen stage
  // ([data-tihoka-split-view="stage"]) are created by the isolated-world
  // React component but live in the light DOM, so MAIN world CSS can target
  // them.
  const YT_SPLIT_STYLE_ID = '__yt_Tihoka_split_view_css';
  const YT_SPLIT_CSS = [
    // Shell-scoped rules — apply in both normal mode (shell narrowed in
    // place, height anchored to its natural height) and fullscreen
    // (children inside stageTihoka, still under the marked shell).
    '[data-tihoka-split-shell] video{object-fit:contain!important}',
    // YouTube sets left:12px inline on .ytp-chrome-bottom; width:100% would
    // overflow the shrunken shell by 12px. calc(100% - 24px) preserves 12px
    // padding on both sides.
    '[data-tihoka-split-shell] .ytp-chrome-bottom{width:calc(100% - 24px)!important}',
    // YouTube JS sizes these to movie_player width (full viewport), not the
    // shrunken shell. Force 100% so they fit inside chromeBottom.
    '[data-tihoka-split-shell] .ytp-progress-bar-container,',
    '[data-tihoka-split-shell] .ytp-progress-bar,',
    '[data-tihoka-split-shell] .ytp-heat-map-container,',
    '[data-tihoka-split-shell] .ytp-chapters-container,',
    '[data-tihoka-split-shell] .ytp-timed-markers-container,',
    '[data-tihoka-split-shell] .ytp-chrome-controls{width:100%!important}',
    // Progress bar internals get explicit pixel widths from YouTube JS
    // (e.g. 2536px = movie_player width - 24). Override to 100% of parent.
    // Per-chapter segments (.ytp-heat-map-chapter, .ytp-chapter-hover-container)
    // must NOT be forced to 100%: YouTube sets inline px widths per chapter and
    // tiles them via float:left — at 100% each chapter wraps to its own line,
    // stacking into a striped block that overflows below the video.
    '[data-tihoka-split-shell] .ytp-progress-bar-padding,',
    '[data-tihoka-split-shell] .ytp-progress-list,',
    '[data-tihoka-split-shell] .ytp-progress-linear-live-buffer{width:100%!important}',
    // Fill chain — zero .player-size's %-padding and let
    // .player-size → #movie_player → .html5-video-container → video fill the
    // shell instead. SAFE only because the shell's height is anchored:
    // normal mode sets an explicit px height (natural full-width height) and
    // the fullscreen shell fills the top layer — a percentage height inside
    // resolves against a definite base. Without that anchor, height:100% on
    // .player-size resolves against its own content (circular → 0).
    '[data-tihoka-split-shell] .player-size{padding:0!important;height:100%!important}',
    '[data-tihoka-split-shell] #movie_player{height:100%!important;width:100%!important;inset:0!important}',
    '[data-tihoka-split-shell] .html5-video-container{height:100%!important;width:100%!important}',
    '[data-tihoka-split-shell] video{width:100%!important;height:100%!important;object-fit:contain!important;top:0!important;left:0!important}',
  ].join('');

  document.addEventListener('__YT_SPLIT_VIEW_APPLY_CSS', () => {
    if (document.getElementById(YT_SPLIT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = YT_SPLIT_STYLE_ID;
    style.textContent = YT_SPLIT_CSS;
    document.head.appendChild(style);
  });

  document.addEventListener('__YT_SPLIT_VIEW_REMOVE_CSS', () => {
    document.getElementById(YT_SPLIT_STYLE_ID)?.remove();
  });

  function postDetectedSubtitles(tracks: unknown[], videoId: string): void {
    const postTime = performance.now();
    debug.postTime = postTime;
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

      const apiKey = resolveInnertubeApiKey();
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

      if (tracks.length > 0) {
        lastDetectedTracks = tracks;
        lastDetectedVideoId = videoId;
      }
      // Always post on a successful detect — even when 0 tracks. The background
      // uses this signal to clear the previous video's subtitles when the new
      // video has none (SPA nav from a video WITH subtitles to one WITHOUT).
      // Without the 0-track post, the background never learns the video changed
      // and the previous overlay persists. Cache lastDetectedTracks only when
      // non-empty (handshake re-post is for videos that HAVE tracks).
      postDetectedSubtitles(tracks, videoId);
    } catch (err) {
      // Swallow — never break the page on instrumentation error (ADR-011 precedent).
      debug.lastError = err instanceof Error ? err.message : String(err);
      console.warn('[youtube-main-world] detect failed:', err);
    }
  }

  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pollDeadline = 0;
  function pollForVideoIdChange(timeoutMs: number): void {
    pollDeadline = Date.now() + timeoutMs;
    if (pollInterval) return;
    debug.pollCycles++;
    pollInterval = setInterval(() => {
      const playerResponse = (window as unknown as Record<string, unknown>)
        .ytInitialPlayerResponse;
      const currentVideoId =
        getVideoIdFromUrl() ?? getVideoIdFromPlayerResponse(playerResponse);
      // Only trigger detect when BOTH videoId is new AND API key is available
      // (YouTube injects INNERTUBE_API_KEY into HTML after initial paint —
      // detecting before that fails with "no API key" and wastes the attempt).
      if (currentVideoId && currentVideoId !== lastVideoId) {
        const apiKey = resolveInnertubeApiKey();
        if (apiKey && pollInterval !== null) {
          clearInterval(pollInterval);
          pollInterval = null;
          void detect();
        }
      } else if (Date.now() > pollDeadline) {
        if (pollInterval !== null) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
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
