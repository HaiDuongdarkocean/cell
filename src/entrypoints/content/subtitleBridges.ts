import { sendMessage } from '@/shared/lib/chrome-apis';
import { cacheSubtitleBody } from '@/features/subtitle';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SubtitleSignal } from '@/features/detection/subtitleDiscovery';
import { isCellDebug } from './debugLog';

// Dedup state for the MAIN-world re-post handshakes (ADR-020/028/029). The
// MAIN world re-posts the same video's tracks when it receives the readiness
// announcement, so only the first post per ID is relayed to the background.
let lastRelayedVideoId: string | undefined;
let lastRelayedTvid: string | undefined;
let lastRelayedMovieId: string | undefined;

export function getLastRelayedVideoId(): string | undefined {
  return lastRelayedVideoId;
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
    // === Subtitle discovery relay from cross-origin player iframe ===
    // MAIN-world scripts inside player iframes (playembed.vip, vidnest, etc.)
    // post discovery signals to window.parent. The parent frame cannot read
    // the iframe DOM, but it can relay the observed signal to the background
    // discovery pipeline. The signal carries its own origin/initiator so the
    // adapter can match it to the correct player profile.
    if (dataEarly?.type === '__CELL_SUBTITLE_DISCOVERY' && event.source !== window) {
      try {
        const signal = (event.data as { signal: SubtitleSignal }).signal;
        if (signal) {
          if (signal.kind === 'network-response' && signal.body) {
            cacheSubtitleBody(signal.url, signal.body);
          }
          if (isCellDebug()) {
            const raw = document.documentElement.getAttribute('data-cell-iframe-discovery-log');
            const arr: unknown[] = raw ? JSON.parse(raw) : [];
            arr.push({ t: Date.now(), kind: signal.kind, origin: (signal as { origin?: string }).origin });
            if (arr.length > 200) arr.splice(0, arr.length - 200);
            document.documentElement.setAttribute('data-cell-iframe-discovery-log', JSON.stringify(arr));
          }
          void sendMessage({
            type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
            payload: { origin: location.origin, signal },
          }).catch((e) => console.warn('[content-script] cross-origin discovery relay error', e));
        }
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
      void sendMessage({
        type: MESSAGE_TYPES.DETECTED_SUBTITLE_URL,
        payload: { tabId: undefined, url: data.url },
      });
      return;
    }
    // Fetch-interceptor diagnostics reply (audit 12 residual). Only requested
    // under isCellDebug() below; the reply carries miss counters + buffer
    // state, no page-private data. Mirror to a debug attribute like the other
    // data-cell-* markers so E2E can read it without DevTools.
    if (data?.type === '__CELL_FETCH_INTERCEPTOR_DIAG' && isCellDebug()) {
      const diag = data as {
        misses?: Record<string, number>;
        pending?: number;
        ready?: boolean;
      };
      document.documentElement.setAttribute(
        'data-cell-fetch-interceptor-diag',
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
      if (isCellDebug()) {
        (window as unknown as Record<string, unknown>).__YT_LAST_RELAYED_VIDEO_ID = videoId;
      }
      void sendMessage({
        type: MESSAGE_TYPES.DETECTED_SUBTITLES,
        payload: {
          tabId: undefined,
          tracks: (data as { tracks?: unknown[] }).tracks ?? [],
          videoId,
        },
      }).catch((e) => console.error('[content-script] DETECTED_SUBTITLES bg error', e));
      return;
    }
    if (data?.type === '__YT_INNERTUBE_FALLBACK') {
      void sendMessage({
        type: MESSAGE_TYPES.INNERTUBE_FALLBACK_REQUEST,
        payload: {
          tabId: undefined,
          videoId: (data as { videoId?: string }).videoId ?? '',
          apiKey: (data as { apiKey?: string }).apiKey ?? '',
          visitorData: (data as { visitorData?: string }).visitorData,
        },
      });
    }
    // === Generic subtitle-list discovery bridge (MAIN-world → background) ===
    if (data?.type === '__CELL_SUBTITLE_DISCOVERY' && (data as { signal?: unknown }).signal) {
      const signal = (data as { signal: SubtitleSignal }).signal;
      if (signal.kind === 'network-response' && signal.body) {
        cacheSubtitleBody(signal.url, signal.body);
      }
      const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      void sendMessage({
        type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
        payload: {
          nonce,
          origin: location.origin,
          signal,
        },
      }).catch((e) => console.error('[content-script] SUBTITLE_DISCOVERY_SIGNAL bg error', e));
      return;
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
      if (isCellDebug()) {
        (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID = tvid;
      }
      void sendMessage({
        type: MESSAGE_TYPES.DETECTED_SUBTITLES,
        payload: {
          tabId: undefined,
          tracks: (data as { tracks?: unknown[] }).tracks ?? [],
          tvid,
          source: 'iqiyi',
          origin: (data as { origin?: string }).origin,
        },
      }).catch((e) => console.error('[content-script] IQ DETECTED_SUBTITLES bg error', e));
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
      if (isCellDebug()) {
        (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID = movieId;
      }
      void sendMessage({
        type: MESSAGE_TYPES.DETECTED_SUBTITLES,
        payload: {
          tabId: undefined,
          tracks: (data as { tracks?: unknown[] }).tracks ?? [],
          movieId,
          source: 'netflix',
        },
      }).catch((e) => console.error('[content-script] NF DETECTED_SUBTITLES bg error', e));
    }
  });

  // Announce readiness to the MAIN-world IIFE interceptors. They may have
  // posted signals before this isolated listener was registered (bundler async
  // loader delays content script registration past document_start).
  // See learning-and-apply: messaging-receiver-announces-readiness-handshake.
  window.postMessage({ type: '__CELL_CS_READY' }, '*');

  // Debug-only: ask the MAIN-world fetch interceptor to relay its miss
  // counters. The MAIN world only replies when __CELL_DEBUG__ is compiled in,
  // so production builds neither request nor answer.
  if (isCellDebug()) {
    window.postMessage({ type: '__CELL_FETCH_INTERCEPTOR_DIAG_REQUEST' }, '*');
  }
}
