import { sendMessage } from '@/shared/lib/chrome-apis';
import { cacheSubtitleBody } from '@/features/subtitle/logic/subtitleResponseCache';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { subtitleSignalSchema } from '@/features/detection/subtitleDiscovery/schema';
import { isTihokaDebug } from './debugLog';
import { isResolvableHttpOrigin } from '@/shared/lib/dom/frameOrigin';

// Dedup state for the MAIN-world re-post handshakes (ADR-020/028/029). The
// MAIN world re-posts the same video's tracks when it receives the readiness
// announcement, so only the first post per ID is relayed to the background.
let lastRelayedVideoId: string | undefined;
let lastRelayedTvid: string | undefined;
let lastRelayedMovieId: string | undefined;

export function getLastRelayedVideoId(): string | undefined {
  return lastRelayedVideoId;
}

// Firefox's non-persistent background page drops the first post-resume
// message ("Could not establish connection") — the wake it triggers races
// listener re-registration. These relays are one-shot with no outer retry,
// so retry here; onDropped resets the dedup mark so the next MAIN-world
// repost can try again instead of being swallowed for the page lifetime.
function relayToBackground(
  message: { type: string; payload: Record<string, unknown> },
  onDropped: () => void,
): void {
  const attempt = (retriesLeft: number): void => {
    void sendMessage(message).catch((e) => {
      if (retriesLeft > 0) {
        setTimeout(() => attempt(retriesLeft - 1), 800);
        return;
      }
      onDropped();
      console.error('[content-script] relay to background failed', e);
    });
  };
  attempt(2);
}

// ADR-020 race fix: notify the MAIN-world YouTube script that our message
// listener is registered. CRXJS async dynamic-import loader delays ISOLATED
// content-script injection past the MAIN-world `__YT_DETECTED_SUBTITLES` post
// on SPA navigation → the MAIN world re-posts last tracks on this handshake.
export function postSiteReadyHandshakes(csInjectTime: number): void {
  window.postMessage({ type: '__YT_CS_READY', time: csInjectTime }, '*');
  // ADR-028: same handshake for the iQIYI MAIN-world script.
  window.postMessage({ type: '__IQ_CS_READY', time: csInjectTime }, '*');
  // ADR-029: same handshake for the Netflix MAIN-world script.
  window.postMessage({ type: '__NF_CS_READY', time: csInjectTime }, '*');
}

// === Main-world message bridge (ADR-011/020/028/029) ===
// Register the MAIN→ISOLATED postMessage listener BEFORE any potentially-
// throwing initialization (clearAutoLoadCache, PageScanner, overlay init).
// The listener only depends on `sendMessage` + `MESSAGE_TYPES` (imported at
// top). If later code throws, this listener still catches MAIN-world posts.
export function installMainWorldBridge(): void {
  window.addEventListener('message', (event) => {
    const dataEarly = event.data as { type?: string } | null;
    // === Subtitle discovery relay (same-window MAIN-world + cross-origin iframe) ===
    // MAIN-world scripts post discovery signals to their own window; player
    // iframes (playembed.vip, vidnest, etc.) also post to window.parent.
    // Both paths are untrusted: validate the signal schema and take the origin
    // from event.origin (browser-enforced), never the self-reported fields.
    if (dataEarly?.type === '__Tihoka_SUBTITLE_DISCOVERY') {
      try {
        if (!isResolvableHttpOrigin(event.origin)) return;
        const parsed = subtitleSignalSchema.safeParse(
          (event.data as { signal?: unknown }).signal,
        );
        if (!parsed.success) return;
        const signal = parsed.data;
        const trustedOrigin = event.origin;
        if (signal.kind === 'player-state') signal.origin = trustedOrigin;
        signal.initiator = trustedOrigin;
        if (signal.kind === 'network-response' && signal.body) {
          cacheSubtitleBody(signal.url, signal.body);
        }
        if (isTihokaDebug() && event.source !== window) {
          const raw = document.documentElement.getAttribute('data-tihoka-iframe-discovery-log');
          const arr: unknown[] = raw ? JSON.parse(raw) : [];
          arr.push({ t: Date.now(), kind: signal.kind, origin: trustedOrigin });
          if (arr.length > 200) arr.splice(0, arr.length - 200);
          document.documentElement.setAttribute('data-tihoka-iframe-discovery-log', JSON.stringify(arr));
        }
        const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        relayToBackground(
          {
            type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
            payload: { nonce, origin: trustedOrigin, signal },
          },
          () => undefined,
        );
      } catch { /* best effort */ }
      return;
    }
    // Accept same-origin MAIN-world posts even if event.source !== window
    // (isolated-world WindowProxy can differ from page WindowProxy in some
    // environments). Cross-origin iframe posts are still filtered out because
    // their origin does not match the content script's origin.
    if (event.source !== window && event.origin !== location.origin) return;
    const data = event.data as { type?: string; url?: string; postTime?: number } | null;
    if (data?.type === '__DETECTED_SUBTITLE_FETCH' && data.url) {
      relayToBackground(
        {
          type: MESSAGE_TYPES.DETECTED_SUBTITLE_URL,
          payload: { tabId: undefined, url: data.url },
        },
        () => undefined,
      );
      return;
    }
    // Fetch-interceptor diagnostics reply (audit 12 residual). Only requested
    // under isTihokaDebug() below; the reply carries miss counters + buffer
    // state, no page-private data. Mirror to a debug attribute like the other
    // data-tihoka-* markers so E2E can read it without DevTools.
    if (data?.type === '__Tihoka_FETCH_INTERCEPTOR_DIAG' && isTihokaDebug()) {
      const diag = data as {
        misses?: Record<string, number>;
        pending?: number;
        ready?: boolean;
      };
      document.documentElement.setAttribute(
        'data-tihoka-fetch-interceptor-diag',
        JSON.stringify({
          t: Date.now(),
          misses: diag.misses ?? {},
          pending: diag.pending ?? 0,
          ready: diag.ready === true,
        }),
      );
      console.info('[content-script] fetch interceptor diag', diag.misses ?? {});
      return;
    }
    // === YouTube MAIN-world bridge (ADR-020) ===
    // youtube-main-world.iife.ts reads `window.ytInitialPlayerResponse` (MAIN
    // world only) and posts caption tracks / InnerTube fallback requests.
    if (data?.type === '__YT_DETECTED_SUBTITLES') {
      const videoId = (data as { videoId?: string }).videoId ?? '';
      // Dedup by videoId: MAIN world re-posts on __YT_CS_READY handshake, so the
      // same videoId may arrive twice. Only relay once per videoId to avoid
      // duplicate auto-load (ADR-020 race fix).
      if (videoId && lastRelayedVideoId === videoId) return;
      lastRelayedVideoId = videoId;
      if (isTihokaDebug()) {
        (window as unknown as Record<string, unknown>).__YT_LAST_RELAYED_VIDEO_ID = videoId;
      }
      relayToBackground(
        {
          type: MESSAGE_TYPES.DETECTED_SUBTITLES,
          payload: {
            tabId: undefined,
            tracks: (data as { tracks?: unknown[] }).tracks ?? [],
            videoId,
          },
        },
        () => {
          if (lastRelayedVideoId === videoId) lastRelayedVideoId = undefined;
        },
      );
      return;
    }
    if (data?.type === '__YT_INNERTUBE_FALLBACK') {
      relayToBackground(
        {
          type: MESSAGE_TYPES.INNERTUBE_FALLBACK_REQUEST,
          payload: {
            tabId: undefined,
            videoId: (data as { videoId?: string }).videoId ?? '',
            apiKey: (data as { apiKey?: string }).apiKey ?? '',
            visitorData: (data as { visitorData?: string }).visitorData,
          },
        },
        () => undefined,
      );
    }
    // === iQIYI MAIN-world bridge (ADR-028) ===
    // iqiyi-main-world.iife.ts reads `window.playerObject.stl` (MAIN world only)
    // and posts subtitle tracks. Relay to background as DETECTED_SUBTITLES with
    // source:'iqiyi' so detectionDispatch.ts routes to mapIqiyiSubtitleTracks.
    if (data?.type === '__IQ_DETECTED_SUBTITLES') {
      const tvid = (data as { tvid?: string }).tvid ?? '';
      // Dedup by tvid (per-video ID): MAIN world re-posts on __IQ_CS_READY handshake,
      // so the same tvid may arrive twice. Only relay once per tvid to avoid duplicate
      // auto-load (ADR-028 race fix, clone ADR-020). iQIYI's `tvid` is the unique
      // video identifier; `vid` is a streaming session ID reused across videos.
      if (tvid && lastRelayedTvid === tvid) return;
      lastRelayedTvid = tvid;
      if (isTihokaDebug()) {
        (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID = tvid;
      }
      relayToBackground(
        {
          type: MESSAGE_TYPES.DETECTED_SUBTITLES,
          payload: {
            tabId: undefined,
            tracks: (data as { tracks?: unknown[] }).tracks ?? [],
            tvid,
            source: 'iqiyi',
            origin: (data as { origin?: string }).origin,
          },
        },
        () => {
          if (lastRelayedTvid === tvid) lastRelayedTvid = undefined;
        },
      );
    }
    // === Netflix MAIN-world bridge (ADR-029) ===
    // netflix-main-world.iife.ts hooks JSON.parse and posts raw timedtexttracks.
    // Relay to background as DETECTED_SUBTITLES with source:'netflix' so
    // detectionDispatch.ts routes to mapNetflixSubtitleTracks.
    if (data?.type === '__NF_DETECTED_SUBTITLES') {
      const movieId = String((data as { movieId?: number | string }).movieId ?? '');
      // Dedup by movieId (per-video ID): MAIN world re-posts on __NF_CS_READY handshake,
      // so the same movieId may arrive twice. Use string-based dedup (clone YouTube/iQIYI `?? ''`
      // pattern — NOT `?? 0` which is falsy and would re-post for movieId 0).
      if (movieId !== '' && lastRelayedMovieId === movieId) return;
      lastRelayedMovieId = movieId;
      if (isTihokaDebug()) {
        (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID = movieId;
      }
      relayToBackground(
        {
          type: MESSAGE_TYPES.DETECTED_SUBTITLES,
          payload: {
            tabId: undefined,
            tracks: (data as { tracks?: unknown[] }).tracks ?? [],
            movieId,
            source: 'netflix',
          },
        },
        () => {
          if (lastRelayedMovieId === movieId) lastRelayedMovieId = undefined;
        },
      );
    }
  });

  // Announce readiness to the MAIN-world IIFE interceptors. They may have
  // posted signals before this isolated listener was registered (bundler async
  // loader delays content script registration past document_start).
  // See learning-and-apply: messaging-receiver-announces-readiness-handshake.
  window.postMessage({ type: '__Tihoka_CS_READY' }, '*');

  // Debug-only: ask the MAIN-world fetch interceptor to relay its miss
  // counters. The MAIN world only replies when __Tihoka_DEBUG__ is compiled in,
  // so production builds neither request nor answer.
  if (isTihokaDebug()) {
    window.postMessage({ type: '__Tihoka_FETCH_INTERCEPTOR_DIAG_REQUEST' }, '*');
  }
}
