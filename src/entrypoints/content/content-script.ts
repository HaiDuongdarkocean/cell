import { sendMessage, onStorageChanged } from '@/shared/lib/chrome-apis';
import { PageScanner } from './pageScanner';
import { clearAutoLoadCache, initContentScriptController } from '@/features/subtitle';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS, DEFAULT_CARD_CREATOR_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { createWebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import { createWebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';
import type { WebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';
import { mountUniversalPanel, type UniversalPanelMountController } from '@/features/universalPanel';
import { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl, setSubtitleTokenizeEnabledForUrl, saveTokenizeSettings } from '@/features/tokenize/services/tokenizeSettingsStore';
import type { VideoEpisodeChangedPayload } from '@/entities/message';
import { installIframePlayerModeBridge } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { initOcrContentScript } from './ocrContentScript';
import { initializeStudyModeController } from '@/features/studyModes/content/studyModeController';
import { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import type { LookupRequest } from '@/features/dictionaryPopup/types';
import type { SubtitleSignal } from '@/features/detection/subtitleDiscovery';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installManagerSheetBridge,
  setHostSheetCallbacks,
  sendManagerActionToChild,
  sendManagerCloseToChild,
} from '@/features/subtitle/logic/iframeManagerBridgeHost';
import { HostManagerSheet } from '@/features/subtitle/ui/HostManagerSheet';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { injectShadowCss } from '@/shared/lib/shadowRoot/injectShadowCss';
import { hostManagerSheetShadowCss } from '@/features/subtitle/ui/hostManagerSheetShadowCss';
import type { SerializedManagerState, ManagerAction } from '@/features/subtitle/logic/iframeManagerBridgeTypes';

// Top-frame coordinator for Player Mode when the actual video is inside a
// cross-origin iframe. Child frames request the host container via postMessage.
installIframePlayerModeBridge();

// Host-side manager sheet bridge — renders bottom sheet on host page
// when a cross-origin child iframe requests it (mobile scenario where the
// iframe cannot expand its own overlay beyond its viewport).
let hostSheetRoot: ReturnType<typeof createRoot> | null = null;
let hostSheetHost: HTMLDivElement | null = null;
let hostSheetInner: HTMLDivElement | null = null;
let sheetCssCleanup: (() => void) | null = null;
// Guard: runPageScan is invoked both on DOMContentLoaded and from
// findAndInitOverlay when a video appears late. The flag prevents duplicate
// initial PAGE_SCAN_RESULT sends and observer restarts.
let pageScanObserverStarted = false;
let currentFrameSrc = '';
let currentState: SerializedManagerState | null = null;

function renderHostSheet(): void {
  if (!hostSheetRoot || !currentState || !hostSheetInner) return;
  const frameSrc = currentFrameSrc;
  hostSheetRoot.render(
    createElement(
      ShadowThemeProvider,
      { container: hostSheetInner },
      createElement(HostManagerSheet, {
        state: currentState,
        onAction: (action: ManagerAction, args: Record<string, unknown>) =>
          sendManagerActionToChild(frameSrc, action, args),
        onClose: () => sendManagerCloseToChild(frameSrc),
      }),
    ),
  );
}

setHostSheetCallbacks({
  onOpen: (state: SerializedManagerState, frameSrc: string): void => {
    // Tear down any existing sheet before opening a new one.
    if (hostSheetRoot) {
      hostSheetRoot.unmount();
      hostSheetRoot = null;
    }
    if (hostSheetHost) {
      hostSheetHost.remove();
      hostSheetHost = null;
    }
    if (sheetCssCleanup) {
      sheetCssCleanup();
      sheetCssCleanup = null;
    }

    currentFrameSrc = frameSrc;
    currentState = state;

    hostSheetHost = document.createElement('div');
    hostSheetHost.id = 'cell-host-manager-sheet';
    hostSheetHost.style.cssText =
      'position:fixed;inset:0;pointer-events:auto;z-index:2147483647;';
    document.body.appendChild(hostSheetHost);

    const shadow = hostSheetHost.attachShadow({ mode: 'open' });
    sheetCssCleanup = injectShadowCss(shadow, { css: hostManagerSheetShadowCss });

    hostSheetInner = document.createElement('div');
    hostSheetInner.style.display = 'contents';
    shadow.appendChild(hostSheetInner);

    hostSheetRoot = createRoot(hostSheetInner);
    renderHostSheet();
  },
  onStateUpdate: (partialState: Partial<SerializedManagerState>, _frameSrc: string): void => {
    if (!currentState) return;
    currentState = { ...currentState, ...partialState };
    renderHostSheet();
  },
  onClose: (_frameSrc: string): void => {
    if (hostSheetRoot) {
      hostSheetRoot.unmount();
      hostSheetRoot = null;
    }
    if (hostSheetHost) {
      hostSheetHost.remove();
      hostSheetHost = null;
    }
    hostSheetInner = null;
    if (sheetCssCleanup) {
      sheetCssCleanup();
      sheetCssCleanup = null;
    }
    currentFrameSrc = '';
    currentState = null;
  },
});

// Bridge lives for the page lifecycle — never cleaned up (the accidental
// reuse of the old `hostSheetCleanup` variable for both bridge + CSS cleanup
// was the root cause of the subtitle manager sheet not closing: onOpen called
// the bridge cleanup, removing the message listener, so __CELL_MANAGER_CLOSED
// from the child never reached the host and the sheet stayed mounted forever).
installManagerSheetBridge();

// ISOLATED content-script marker (verify injection from DevTools — MAIN world
// cannot see this because ISOLATED world globals are not shared with MAIN).
(window as unknown as Record<string, unknown>).__YT_CS_INJECTED = true;
const csInjectTime = performance.now();
(window as unknown as Record<string, unknown>).__YT_CS_INJECT_TIME = csInjectTime;

// Debug relay: the player iframe lives cross-origin, so its controller cannot
// set attributes on the top frame. It posts to window.parent; the top frame
// content script stores the last auto-load / scan signal on documentElement.
if (window.self === window.top) {
  window.addEventListener('message', (e) => {
    // AUTO_LOAD_SUBTITLES is acknowledged by the player iframe and by the
    // top frame on direct sites. Record every one — it is never the top's
    // own diagnostic noise.
    if (e.data?.type === '__CELL_AUTOLOAD_HANDLED') {
      document.documentElement.setAttribute(
        'data-cell-autoload-handled',
        JSON.stringify({ href: e.data.href, target: e.data.target }),
      );
    }
    // PAGE_SCAN debug markers: only record those coming from a player iframe.
    // The top frame's own runPageScan postMessage should not overwrite data.
    const isOwnFrame = e.source === window || e.origin === window.location.origin;
    if (e.data?.type === '__CELL_DEBUG_PAGE_SCAN' && e.data?.pageUrl && !isOwnFrame) {
      document.documentElement.setAttribute(
        'data-cell-iframe-scan',
        JSON.stringify({ pageUrl: e.data.pageUrl, videos: e.data.videoUrls?.length ?? 0, subtitles: e.data.subtitleUrls?.length ?? 0 }),
      );
    }
  });
}

// ADR-020 race fix: notify the MAIN-world YouTube script that our message
// listener is registered. CRXJS async dynamic-import loader delays ISOLATED
// content-script injection past the MAIN-world `__YT_DETECTED_SUBTITLES` post
// on SPA navigation → the MAIN world re-posts last tracks on this handshake.
window.postMessage({ type: '__YT_CS_READY', time: csInjectTime }, '*');
// ADR-028: same handshake for the iQIYI MAIN-world script.
window.postMessage({ type: '__IQ_CS_READY', time: csInjectTime }, '*');
// ADR-029: same handshake for the Netflix MAIN-world script.
window.postMessage({ type: '__NF_CS_READY', time: csInjectTime }, '*');

// Debug: respond to PING from SW/DevTools so we can verify injection.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'PING') {
    sendResponse({
      ok: true,
      csInjected: true,
      readyState: document.readyState,
      url: location.href,
      hasYtDebug: typeof (window as unknown as Record<string, unknown>).__YT_DEBUG !== 'undefined',
      csInjectTime: (window as unknown as Record<string, unknown>).__YT_CS_INJECT_TIME,
      msgListenerRegistered: true,
      lastRelayedVideoId: (window as unknown as Record<string, unknown>).__YT_LAST_RELAYED_VIDEO_ID,
      scanInfo: (window as unknown as Record<string, unknown>).__CELL_SCAN_INFO,
    });
    return false;
  }
  return false;
});

// === Main-world message bridge (ADR-011/020/028/029) ===
// Register the MAIN→ISOLATED postMessage listener BEFORE any potentially-
// throwing initialization (clearAutoLoadCache, PageScanner, overlay init).
// The listener only depends on `sendMessage` + `MESSAGE_TYPES` (imported at
// top). If later code throws, this listener still catches MAIN-world posts.
window.addEventListener('message', (event) => {
  const dataEarly = event.data as { type?: string } | null;
  // === Split View diagnostic log relay (from child iframe) ===
  // MUST run before the `event.source !== window` guard below — iframe
  // posts have event.source === iframe.contentWindow, not the top window.
  // Store entries in documentElement.dataset so MCP execute_script (top
  // frame) can read them. Anti-debug sites reload on F12, but stealth MCP
  // bypasses that. Temporary — remove after split view iframe bug is fixed.
  if (dataEarly?.type === '__CELL_SPLIT_VIEW_LOG') {
    try {
      const raw = document.documentElement.getAttribute('data-cell-sv-log');
      const arr: unknown[] = raw ? JSON.parse(raw) : [];
      const d = event.data as { line?: string; data?: unknown };
      arr.push({ line: d.line, data: d.data, t: Date.now() });
      if (arr.length > 200) arr.splice(0, arr.length - 200);
      document.documentElement.setAttribute('data-cell-sv-log', JSON.stringify(arr));
    } catch { /* best effort */ }
    return;
  }
  if (event.source !== window) return;
  const data = event.data as { type?: string; url?: string; postTime?: number } | null;
  if (data?.type === '__DETECTED_SUBTITLE_FETCH' && data.url) {
    void sendMessage({
      type: MESSAGE_TYPES.DETECTED_SUBTITLE_URL,
      payload: { tabId: undefined, url: data.url },
    });
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
    const lastRelayedVideoId = (window as unknown as Record<string, unknown>).__YT_LAST_RELAYED_VIDEO_ID as string | undefined;
    if (videoId && lastRelayedVideoId === videoId) return;
    (window as unknown as Record<string, unknown>).__YT_LAST_RELAYED_VIDEO_ID = videoId;
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
    const lastRelayedTvid = (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID as string | undefined;
    if (tvid && lastRelayedTvid === tvid) return;
    (window as unknown as Record<string, unknown>).__IQ_LAST_RELAYED_TVID = tvid;
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
    const lastRelayedMovieId = (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID as string | undefined;
    if (movieId !== '' && lastRelayedMovieId === movieId) return;
    (window as unknown as Record<string, unknown>).__NF_LAST_RELAYED_MOVIE_ID = movieId;
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

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
// Clear auto-load cache on every (re)inject — tab navigate re-injects the
// content-script, so the per-URL cache must not survive across navigations.
clearAutoLoadCache();
const scanner = new PageScanner();

// Scan on page load — defer to DOMContentLoaded because content-script now
// runs at document_start (ADR-020: listener must register before MAIN world
// posts `__YT_DETECTED_SUBTITLES` after InnerTube fetch ~3-4s after start).
// Page scanning needs DOM ready, but the message listener above registers
// immediately at document_start (no DOM dependency).
function runPageScan(): void {
  // Scan the top frame and any iframe that actually hosts a <video>.
  // Cross-origin iframe players (vidnest.fun, anikage.cc, etc.) keep <track>
  // elements inside the iframe, so scanning only the top frame misses the
  // entire subtitle list. Background deduplicates by URL, so overlapping scans
  // across frames are safe. Iframes without a video are skipped to avoid
  // observing ad/empty frames.
  if (window.self !== window.top && !document.querySelector('video')) return;
  const urls = scanner.scan();
  // ponytail: guard is intentionally removed. Players like vidnest/videasy
  // mount the <video> before the <track> src attributes are set, so the first
  // DOMContentLoaded scan is often empty. finishVideoInit must be able to
  // re-scan once tracks appear; the background deduplicates by URL and the
  // content-script controller deduplicates auto-load payloads.
  if (pageScanObserverStarted) {
    const last = scanner.getLastScanned();
    if (
      last &&
      urls.videoUrls.length === last.videoUrls.length &&
      urls.subtitleUrls.length === last.subtitleUrls.length &&
      urls.videoUrls.every((u, i) => u === last.videoUrls[i]) &&
      urls.subtitleUrls.every((u, i) => u === last.subtitleUrls[i])
    ) {
      return;
    }
  }
  pageScanObserverStarted = true;
  // Debug: surface scan results to the top frame so browser tests can verify
  // the content script is finding media without reading cross-origin iframes.
  // Iframes use window.parent; top frames use window (self).
  const debugTarget = window.self === window.top ? window : window.parent;
  debugTarget.postMessage({
    type: '__CELL_DEBUG_PAGE_SCAN',
    pageUrl: window.location.href,
    videoUrls: urls.videoUrls,
    subtitleUrls: urls.subtitleUrls,
  }, '*');
  document.documentElement.setAttribute(
    'data-cell-runscan',
    JSON.stringify({ pageUrl: window.location.href, videos: urls.videoUrls.length, subtitles: urls.subtitleUrls.length }),
  );
  if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: undefined,
        videoUrls: urls.videoUrls,
        subtitleUrls: urls.subtitleUrls,
        pageUrl: window.location.href,
      },
    });
  }

  // Start observing for dynamically loaded content
  scanner.startObserving((newUrls) => {
    void sendMessage({
      type: 'PAGE_SCAN_RESULT',
      payload: {
        tabId: undefined,
        videoUrls: newUrls.videoUrls,
        subtitleUrls: newUrls.subtitleUrls,
        pageUrl: window.location.href,
      },
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    runPageScan();
    runSubtitleDiscoveryScan();
  });
} else {
  runPageScan();
  runSubtitleDiscoveryScan();
}

function runSubtitleDiscoveryScan(): void {
  // 1. Iframe hash sources (lunastream/moviesapi → flixcdn.cyou).
  const iframes = document.querySelectorAll('iframe[src*="subs="]');
  for (const iframe of iframes) {
    const frameUrl = iframe.getAttribute('src');
    if (!frameUrl) continue;
    const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void sendMessage({
      type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
      payload: {
        nonce,
        origin: location.origin,
        signal: {
          kind: 'frame-source',
          frameUrl,
          ownerUrl: location.href,
          tabId: 0,
          frameId: 0,
          initiator: location.href,
        },
      },
    });
  }

  // 2. HTML player variable fallback (MyAsianTV/kisscloud).
  const html = document.documentElement.outerHTML;
  if (html.includes('playerjsSubtitle')) {
    const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void sendMessage({
      type: MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL,
      payload: {
        nonce,
        origin: location.origin,
        signal: {
          kind: 'document-html',
          url: location.href,
          html: html.slice(0, 500_000),
          tabId: 0,
          frameId: 0,
          initiator: location.href,
        },
      },
    });
  }
}

// Find video element and init overlay (defer until DOM ready, observe SPA late mounts)
// ADR-012: SPA frameworks (Angular on kisskh.co) render <video> in two phases —
// first mount the element with src="" (template), then assign the real source
// (blob: URL) after fetch. If the content-script init's overlay UI during phase 1,
// the framework's continued render wipes foreign (non-framework) elements appended
// to the video's parent. Waiting until the video has a real source (blob: URL OR
// readyState >= 2 HAVE_CURRENT_DATA) ensures the framework render is done, so
// appended UI persists. Covers both blob-streaming SPAs (kisskh) and direct-MP4
// sites (themoviebox.org — no framework re-render, readyState>=2 is immediate).
// Also accept non-empty child <source>/<track> src as a readiness signal: HLS
// players (hls.js / vidstack) often leave the video element's src attribute empty
// and set currentSrc only after metadata loads, while the <track> list is already
// present in the DOM. This lets the overlay register before the background's first
// AUTO_LOAD_SUBTITLES push, avoiding a lost load-on-start race in cross-origin
// iframes like moviepire → vidnest.
// SSOT helper moved to src/shared/lib/dom/videoReady.ts (shared with ocrContentScript).
import { isVideoReady } from '@/shared/lib/dom/videoReady';

// Track current overlay cleanup so we can tear down before re-init on SPA
// episode switch. Angular replaces <video> on episode switch → old overlay UI
// is removed by the framework's re-render, but document/onMessage listeners
// would otherwise accumulate.
let currentOverlayCleanup: (() => void) | null = null;
// Track the video element the overlay is currently attached to, so we only
// re-init when the <video> element identity actually changes (Angular may
// mount/unmount the same element multiple times during phase render).
let currentVideo: HTMLVideoElement | null = null;
// Track a video element we have seen but is not yet ready (no metadata loaded).
// Players like vidnest/videasy insert the <video> before the source is resolved,
// so we wait for loadedmetadata or a readyState poll before init.
let currentPendingVideo: HTMLVideoElement | null = null;
let videoReadyPoll: ReturnType<typeof setInterval> | null = null;

function stopVideoReadyPoll(): void {
  if (videoReadyPoll) {
    clearInterval(videoReadyPoll);
    videoReadyPoll = null;
  }
}

function finishVideoInit(video: HTMLVideoElement): void {
  stopVideoReadyPoll();
  if (video === currentVideo) return;
  currentPendingVideo = null;
  currentOverlayCleanup?.();
  currentVideo = video;
  currentOverlayCleanup = initContentScriptController(video, ensureWebTextCtrl());
  runPageScan();
}

function tryInitVideoWhenReady(video: HTMLVideoElement): void {
  if (video === currentVideo || video === currentPendingVideo) return;
  stopVideoReadyPoll();
  currentPendingVideo = video;
  if (isVideoReady(video)) {
    finishVideoInit(video);
    return;
  }
  // Wait for the player to assign a real source / load metadata.
  // The 'loadedmetadata' event fires when readyState reaches HAVE_METADATA (>=2).
  const onReady = (): void => {
    if (document.querySelector('video') === video) {
      finishVideoInit(video);
    } else {
      stopVideoReadyPoll();
    }
  };
  video.addEventListener('loadedmetadata', onReady, { once: true });
  // Fallback poll for players that set currentSrc without firing loadedmetadata.
  // ponytail: naive 100ms poll, stop when the 10s findVideoObserver timeout fires.
  videoReadyPoll = setInterval(() => {
    if (document.querySelector('video') !== video) {
      stopVideoReadyPoll();
      return;
    }
    if (isVideoReady(video)) {
      finishVideoInit(video);
    }
  }, 100);
}

// Top-level web-text dictionary controller (independent of video presence).
// Shared with subtitle overlay controller for token lookup + highlight.
let webTextCtrl: WebTextDictionaryController | null = null;
let webTokenizeCtrl: WebTokenizeController | null = null;
/** ADR-061: Pending tokenize subscribers — collected before
 *  webTokenizeCtrl is initialized (initTokenize is async and may complete
 *  after mountSettingsDialog subscribes). Flushed when webTokenizeCtrl is
 *  created. Without this, the orbital badge's SettingsDialog never receives
 *  tokenize state updates → toggles don't visually switch. */
interface PendingTokenizeSub {
  cb: (s: { enabled: boolean; showStatus: boolean; showFrequency: boolean; subtitleEnabled: boolean }) => void;
  unsubscribe?: () => void;
}
let pendingTokenizeSubs: PendingTokenizeSub[] = [];

let universalPanelMount: UniversalPanelMountController | null = null;

// Cached subtitle tokenize enabled state for this URL — read by universal panel.
let cachedSubtitleEnabled = false;

/** Active panel notify callback — push state updates outside webTokenizeCtrl. */
let panelNotify: ((s: { enabled: boolean; showStatus: boolean; showFrequency: boolean; subtitleEnabled: boolean }) => void) | null = null;

/** Build a TokenizePanelState snapshot from current webTokenizeCtrl + cachedSubtitleEnabled. */
function buildPanelState(): { enabled: boolean; showStatus: boolean; showFrequency: boolean; subtitleEnabled: boolean } {
  const s = webTokenizeCtrl?.getState();
  return {
    enabled: s?.enabled ?? false,
    showStatus: s?.showStatus ?? false,
    showFrequency: s?.showFrequency ?? false,
    subtitleEnabled: cachedSubtitleEnabled,
  };
}

function ensureUniversalPanelMount(): UniversalPanelMountController {
  if (!universalPanelMount) {
    // Initialize subtitle tokenize state from storage (async, fires once).
    void loadTokenizeSettings().then((ts) => {
      cachedSubtitleEnabled = isSubtitleTokenizeEnabledForUrl(ts, window.location.href);
      panelNotify?.(buildPanelState());
    });

    universalPanelMount = mountUniversalPanel({
      panel: {
        getState: () => buildPanelState(),
        onToggle: (key) => {
          if (key === 'enabled') webTokenizeCtrl?.toggleEnabled();
          else if (key === 'showStatus') webTokenizeCtrl?.toggleShowStatus();
          else if (key === 'showFrequency') webTokenizeCtrl?.toggleShowFrequency();
          else if (key === 'subtitleEnabled') void toggleSubtitleTokenize();
        },
        onOpenDictionary: () => {
          universalPanelMount?.open('dictionary');
        },
        subscribe: (cb) => {
          panelNotify = cb;
          if (!webTokenizeCtrl) {
            const item: PendingTokenizeSub = { cb };
            pendingTokenizeSubs.push(item);
            cb(buildPanelState());
            return () => {
              item.unsubscribe?.();
              pendingTokenizeSubs = pendingTokenizeSubs.filter((i) => i !== item);
              if (panelNotify === cb) panelNotify = null;
            };
          }
          const unsub = webTokenizeCtrl.subscribe((s) => {
            cb({ enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency, subtitleEnabled: cachedSubtitleEnabled });
          });
          cb(buildPanelState());
          return () => {
            unsub();
            if (panelNotify === cb) panelNotify = null;
          };
        },
      },
    });
  }
  return universalPanelMount;
}

/** Toggle subtitle tokenize for this URL — persists to storage + notifies panel. */
async function toggleSubtitleTokenize(): Promise<void> {
  const ts = await loadTokenizeSettings();
  const url = window.location.href;
  const next = !isSubtitleTokenizeEnabledForUrl(ts, url);
  const updated = setSubtitleTokenizeEnabledForUrl(ts, url, next);
  await saveTokenizeSettings(updated);
  cachedSubtitleEnabled = next;
  panelNotify?.(buildPanelState());
}

function ensureWebTextCtrl(): WebTextDictionaryController {
  if (!webTextCtrl) {
    webTextCtrl = createWebTextDictionaryController({
      container: document.body ?? document.documentElement,
      dictionaryPopupSettings: DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreatorSettings: DEFAULT_CARD_CREATOR_SETTINGS,
      hasVideo: false,
      // Bridge popup status cycle → tokenize controller so token blocks rebind
      // with the new status instead of reverting from stale cache on rebind.
      // `webTokenizeCtrl` is module-level and may still be null on the first
      // lookup (tokenize init runs in parallel); the closure reads it lazily
      // at click time, by which point both controllers are ready.
      onStatusChange: (term, _langCode, status) => {
        webTokenizeCtrl?.applyStatusForTerm(term, status);
      },
      getTokenStatus: (term) => webTokenizeCtrl?.getStatusForTerm(term) ?? 'unknown',
      // ADR-065: generic universal panel controller toggled by the orbital badge.
      panelController: ensureUniversalPanelMount(),
    });
  }
  return webTextCtrl;
}

async function initWebTextDictionary(): Promise<void> {
  try {
    const settings = await loadSettings();
    const dp = settings.dictionaryPopup;
    const ctrl = ensureWebTextCtrl();
    ctrl.updateSettings({
      dictionaryPopup: dp ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
      subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
    });
    if (dp?.enabled) {
      findAndInitOverlay();
    }
  } catch (err) {
    // Storage may be unavailable in some test/sandbox contexts — safe fallback.
    console.warn('[content-script] initWebTextDictionary failed', err);
  }
}

async function initTokenize(): Promise<void> {
  try {
    if (webTokenizeCtrl) return;
    const settings = await loadSettings();
    const langCode = settings.subtitleOverlayTargetLanguage || 'en';
    webTokenizeCtrl = await createWebTokenizeController({
      url: window.location.href,
      root: document.body,
      langCode,
      onOpenDictionary: (term, element, contextSentence) => {
        const ctrl = ensureWebTextCtrl();
        const start = parseInt(element.getAttribute('data-cell-start') ?? '0', 10);
        const wordEl = element.querySelector('.js-cell-token-word');
        const range = document.createRange();
        if (wordEl) {
          range.selectNodeContents(wordEl);
        } else {
          range.selectNodeContents(element);
        }
        ctrl.handleLookup(
          { term, langCode, contextSentence, cursorOffset: start },
          `tokenize-${term}`,
          element.getBoundingClientRect(),
          range,
        );
      },
      onStatusChange: (term, _langCode, status) => {
        ensureWebTextCtrl().syncStatus(term, status);
      },
    });
    // ADR-061: Flush pending subscribers that were queued before
    // webTokenizeCtrl was initialized (mountSettingsDialog subscribes at
    // orbital badge creation time, which may race with initTokenize).
    // Store the real unsubscribe on the pending item so the cleanup returned
    // earlier can correctly tear down the subscription on unmount.
    for (const item of pendingTokenizeSubs) {
      item.unsubscribe = webTokenizeCtrl.subscribe((s) => {
        item.cb({ enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency, subtitleEnabled: cachedSubtitleEnabled });
      });
    }
    pendingTokenizeSubs = [];
  } catch (err) {
    // Storage may be unavailable in some test/sandbox contexts — safe fallback.
    console.warn('[content-script] initTokenize failed', err);
  }
}

function findAndInitOverlay(): void {
  // ADR: allow injection in iframes that host the actual <video> element
  // (animekai.be / shuttletv.su embed via cross-origin iframe). The top frame
  // has no <video>; the iframe does. The `document.querySelector('video')` +
  // `isVideoReady` checks below already gate on a real video, and the
  // MutationObserver auto-disconnects after 10s when no video appears, so
  // iframes without a video pay only a short observer cost.
  const video = document.querySelector('video');
  if (video) {
    tryInitVideoWhenReady(video);
    return;
  }

  // SPA: video may be rendered after DOMContentLoaded. Observe body until a
  // video appears; then wait for it to become ready before injecting the overlay.
  // attributeFilter:['src'] catches phase-2 src assignment (blob: URL) that
  // childList alone would miss.
  // ponytail: disconnect as soon as a video is found to avoid unnecessary
  // mutation work.
  // AC4.4 early-exit: if no video after 10s, disconnect observer (no video on page).
  findVideoObserver?.disconnect();
  stopVideoReadyPoll();
  findVideoObserver = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (v && v !== currentVideo) {
      findVideoObserver?.disconnect();
      findVideoObserver = null;
      clearTimeout(disconnectTimer);
      tryInitVideoWhenReady(v);
    }
  });
  const root = document.body ?? document.documentElement;
  findVideoObserver.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  // AC4.4: auto-disconnect after 10s if no video appears (early-exit optimization).
  // Do NOT stop videoReadyPoll here: a video may have appeared but still be
  // loading its <track>/<source> src (vidnest/videasy iframe embeds), and we
  // must keep polling until isVideoReady becomes true.
  //
  // videasy (moviepire 4K provider) only creates the <video> element AFTER the
  // user clicks the play button — which can happen well after the 10s observer
  // window. When the observer times out without finding a video, install a
  // one-shot click listener so the next user interaction re-triggers the
  // search. The listener removes itself once the overlay initializes.
  const disconnectTimer = setTimeout(() => {
    findVideoObserver?.disconnect();
    findVideoObserver = null;
    if (currentVideo || currentPendingVideo) return;
    const onClickRetry = (): void => {
      if (currentVideo || currentPendingVideo) {
        document.removeEventListener('click', onClickRetry, true);
        return;
      }
      const v = document.querySelector('video');
      if (v && v !== currentVideo) {
        document.removeEventListener('click', onClickRetry, true);
        tryInitVideoWhenReady(v);
      }
    };
    document.addEventListener('click', onClickRetry, true);
  }, 10000);
}

// === In-page episode/movie switch detection (ADR-010) ===
// SPA sites (themoviebox.org) switch episodes by REPLACING the `<video>`
// element in-page — no URL change, no pushState, no reload, so
// `chrome.tabs.onUpdated` never fires and the background's navigation clear
// never runs. Media from the previous episode then accumulates into the new
// episode's list.
//
// Detection signal: a NEW `<video>` element appearing in the DOM AFTER the
// first one has already been seen = episode switch (the element was replaced).
// Quality switches keep the SAME `<video>` element (only `src` changes,
// verified 1080p↔480p: element identity preserved), so they do NOT trigger a
// clear and the subtitle list is preserved.
//
// Triggering on element replacement (not on `loadedmetadata` duration-diff) is
// deliberate: the replacement fires BEFORE the new video's network requests,
// so the clear runs before the new episode's media is detected — no race that
// would wipe the newly detected media.
//
// This watcher is module-level and independent of `initContentScriptController`
// because themoviebox replaces the entire `<video>` element on episode switch
// — listeners attached to the previous element do not fire on the new one.
//
// ponytail: element-replacement heuristic. Ceiling: (1) sites that replace the
// `<video>` element on quality switch would spuriously clear; (2) pages with
// multiple `<video>` elements (e.g. ad-supported) may clear on the second
// element's mount. Upgrade path: combine with video-URL path heuristic or an
// explicit episode-click watcher.
let hasSeenFirstVideo = false;
// Track the last <video> element seen by the episode watcher, so we only fire
// VIDEO_EPISODE_CHANGED + re-init overlay when the element identity actually
// changes. Angular may mount/unmount the same element multiple times during
// phase render — without this guard, the clear + re-init would fire spuriously.
let lastSeenVideo: HTMLVideoElement | null = null;
// Track the last video src URL. Sites like aniwatch.co.at switch sub→dub by
// changing `video.src` on the SAME <video> element (no element replacement,
// no URL change, no pushState) → element-replacement watcher misses it.
// Comparing src catches this case. ponytail: blob: URLs change on every
// quality switch too — we only fire when the URL path differs (ignore query
// params + blob: revocation noise by comparing pathname, not full href).
let lastVideoSrc: string | null = null;
// Track the player iframe (moviepire-style embed). Provider and episode switches
// replace the <iframe> or change its src; the top frame must clear old media.
let lastSeenIframe: HTMLIFrameElement | null = null;
let lastIframeSrc: string | null = null;
let iframeBaselineReady = false;
let episodeChangeDebounce: ReturnType<typeof setTimeout> | null = null;
let videoSrcWatcherInterval: ReturnType<typeof setInterval> | null = null;
let episodeChangeObserver: MutationObserver | null = null;
let findVideoObserver: MutationObserver | null = null;

function reportEpisodeChanged(
  reason: 'replacement' | 'src-change' | 'iframe-replacement' | 'iframe-src-change',
  pageUrl?: string,
): void {
  if (!hasSeenFirstVideo) return; // first video/iframe — baseline, not a switch
  // Debug marker visible in the page so DevTools / E2E can verify the top frame
  // saw the provider/episode switch.
  document.documentElement.setAttribute('data-cell-episode-changed', reason);
  document.documentElement.setAttribute('data-cell-episode-time', String(Date.now()));
  // Tell the background to clear the previous episode's media before the new
  // episode's media is detected.
  const payload: VideoEpisodeChangedPayload = {
    tabId: undefined, // background resolves from sender.tab.id
    pageUrl,
  };
  // Await the clear before re-scanning. The PageScanner's MutationObserver
  // (registered before this watcher) already fired on the same mutation batch
  // and sent PAGE_SCAN_RESULT with the new episode's track URLs. But that
  // PAGE_SCAN_RESULT arrives at the background BEFORE VIDEO_EPISODE_CHANGED
  // (observer registration order), so the clear wipes the newly-added
  // subtitles. By awaiting VIDEO_EPISODE_CHANGED's response and then
  // re-scanning, we guarantee the clear is processed first and the re-scan
  // re-adds the new episode's media after the wipe.
  // Bug: lordflix.org (SvelteKit SPA) replaces <video> + <track> on episode
  // switch → 27 new tracks detected by PageScanner → wiped by clear → 0
  // subtitles. This re-scan restores them.
  void sendMessage({
    type: MESSAGE_TYPES.VIDEO_EPISODE_CHANGED,
    payload,
  }).then(() => {
    const urls = scanner.scan();
    if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
      void sendMessage({
        type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
        payload: {
          tabId: undefined,
          videoUrls: urls.videoUrls,
          subtitleUrls: urls.subtitleUrls,
          pageUrl: window.location.href,
        },
      });
    }
  });
  // Re-init overlay for the new <video> element. Angular replaces the entire
  // <video> on episode switch → old overlay UI (toggle button, manager panel)
  // is removed by the framework's re-render. findAndInitOverlay waits for the
  // new video to be ready (blob: src, Angular phase-2 render) then re-injects.
  void reason; // currently unused — reserved for future telemetry
  findAndInitOverlay();
}

function reportEpisodeChangedIfReplacement(video: HTMLVideoElement): void {
  if (video === lastSeenVideo) return; // same element, not a replacement
  const newSrc = video.src || video.currentSrc || null;
  reportEpisodeChanged('replacement', newSrc ?? undefined);
  lastSeenVideo = video;
  lastVideoSrc = newSrc;
  hasSeenFirstVideo = true;
}

/**
 * Watch `video.src` (or `currentSrc`) for changes on the SAME <video> element.
 * Aniwatch and similar SPAs switch sub→dub by mutating `src` in-place — the
 * element-replacement MutationObserver above does NOT fire (element identity
 * preserved). We poll `src`/`currentSrc` on a short interval because there is
 * no reliable cross-browser event for programmatic `src` assignment (the
 * `loadstart` event fires but also fires on initial load + quality switches,
 * making it noisy). Ponytail: 500ms polling is a naive heuristic — ceiling is
 * a 500ms delay before clearing old subs. Upgrade path: listen to `loadstart`
 * + debounce, or hook the site's episode-switch button click.
 */
function initVideoSrcWatcher(): void {
  if (videoSrcWatcherInterval) return;
  videoSrcWatcherInterval = setInterval(() => {
    const video = document.querySelector('video');
    if (!video) return;
    const currentSrc = video.src || video.currentSrc || null;
    if (!currentSrc) return;
    // First sighting — baseline without firing.
    if (lastVideoSrc === null) {
      lastVideoSrc = currentSrc;
      lastSeenVideo = video;
      hasSeenFirstVideo = true;
      return;
    }
    // Src changed → episode switch (sub→dub, dub→sub, or episode-to-episode
    // on sites that reuse the element). We don't check element identity here
    // — the replacement watcher handles element-swap cases, and a src change
    // on a different element is still an episode switch worth reporting.
    if (currentSrc !== lastVideoSrc) {
      lastVideoSrc = currentSrc;
      lastSeenVideo = video;
      reportEpisodeChanged('src-change', currentSrc);
    }
  }, 500);
}

function isPlayerIframe(el: Element): boolean {
  // Guard against ad/comment iframes: only iframes inside a player container.
  // moviepire.ru uses .player; fall back to common player IDs/classes.
  const container = el.closest('.player, #player, .player-container, [class*="player"], [id*="player"]');
  return container !== null || /^https?:\/\/.+\/(tv|movie|embed|video)\//.test((el as HTMLIFrameElement).src || '');
}

function stageIframeEpisodeChange(reason: 'iframe-src-change' | 'iframe-replacement', iframe: HTMLIFrameElement, src: string): void {
  if (episodeChangeDebounce) clearTimeout(episodeChangeDebounce);
  lastSeenIframe = iframe;
  lastIframeSrc = src;
  // Many SPAs set the player iframe src in multiple steps during initial load.
  // The first src that stays stable for 500ms becomes the baseline provider;
  // only later changes are treated as a user-initiated provider/episode switch.
  if (iframeBaselineReady && src !== '') {
    // Fire immediately before the new iframe document starts loading, so
    // VIDEO_EPISODE_CHANGED clears old media before any new PAGE_SCAN_RESULT arrives.
    reportEpisodeChanged(reason, src);
  }
  episodeChangeDebounce = setTimeout(() => {
    episodeChangeDebounce = null;
    if (!iframeBaselineReady && src !== '') {
      iframeBaselineReady = true;
      hasSeenFirstVideo = true;
    }
  }, 500);
}

function reportEpisodeChangedIfIframeSrc(iframe: HTMLIFrameElement): void {
  const src = iframe.src || '';
  if (iframe === lastSeenIframe && src === lastIframeSrc) return; // same src
  stageIframeEpisodeChange('iframe-src-change', iframe, src);
}

function reportEpisodeChangedIfIframeReplaced(iframe: HTMLIFrameElement): void {
  if (!isPlayerIframe(iframe)) return;
  const src = iframe.src || '';
  if (iframe === lastSeenIframe && src === lastIframeSrc) return;
  stageIframeEpisodeChange('iframe-replacement', iframe, src);
}

function initEpisodeChangeWatcher(): void {
  // Skip hidden Cloudflare challenge iframes (1x1) — same guard as
  // fetchInterceptor.iife.ts. Player iframes (videasy, vidnest) are visible and
  // must be instrumented so in-player episode switches (e.g. videasy's next-
  // episode button) are detected.
  if (window.self !== window.top) {
    try {
      if (window.innerWidth <= 10 && window.innerHeight <= 10) return;
    } catch {
      return;
    }
  }
  const isTop = window.self === window.top;
  // Baseline the first <video> or player iframe at inject time — these are not
  // considered an episode switch.
  const existing = document.querySelector('video');
  if (existing) {
    hasSeenFirstVideo = true;
    lastSeenVideo = existing;
    lastVideoSrc = existing.src || existing.currentSrc || null;
  } else if (isTop) {
    const existingIframe = document.querySelector('.player iframe, #player iframe, iframe[src*="/tv/"], iframe[src*="/movie/"], iframe[src*="/embed/"]') as HTMLIFrameElement | null;
    // Stage the existing iframe for baseline. If its src changes within the
    // 500ms debounce, the final stable value becomes the baseline; this avoids
    // treating initial provider assignment as a user switch.
    if (existingIframe) {
      stageIframeEpisodeChange('iframe-src-change', existingIframe, existingIframe.src || '');
    }
  }
  // Persistently observe for new <video> elements and player-iframes. A NEW
  // element appearing after the first one was seen = episode switch.
  if (episodeChangeObserver) episodeChangeObserver.disconnect();
  episodeChangeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          reportEpisodeChangedIfReplacement(node as HTMLVideoElement);
        } else if (node.nodeName === 'IFRAME') {
          reportEpisodeChangedIfIframeReplaced(node as HTMLIFrameElement);
        } else if (node instanceof Element) {
          const v = node.querySelector('video');
          if (v) reportEpisodeChangedIfReplacement(v);
          const iframe = node.querySelector('iframe');
          if (iframe && isPlayerIframe(iframe)) reportEpisodeChangedIfIframeReplaced(iframe);
        }
      }
      // moviepire switches provider/episode by mutating the existing iframe's
      // src attribute. Attribute changes do not appear in addedNodes.
      if (m.type === 'attributes' && m.attributeName === 'src' && m.target.nodeName === 'IFRAME') {
        const iframe = m.target as HTMLIFrameElement;
        if (isPlayerIframe(iframe)) reportEpisodeChangedIfIframeSrc(iframe);
      }
    }
  });
  const root = document.body ?? document.documentElement;
  // attributeFilter:['src'] catches iframe provider/episode switches without
  // polling. Filters in the callback avoid firing on unrelated src changes.
  episodeChangeObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  // Also watch for src changes on the same <video> element (aniwatch sub→dub case).
  initVideoSrcWatcher();
}

function cleanupContentScript(): void {
  try {
    currentOverlayCleanup?.();
    currentOverlayCleanup = null;
    currentVideo = null;
    currentPendingVideo = null;
    findVideoObserver?.disconnect();
    findVideoObserver = null;
    stopVideoReadyPoll();
    episodeChangeObserver?.disconnect();
    episodeChangeObserver = null;
    if (episodeChangeDebounce) {
      clearTimeout(episodeChangeDebounce);
      episodeChangeDebounce = null;
    }
    iframeBaselineReady = false;
    lastSeenIframe = null;
    lastIframeSrc = null;
    if (videoSrcWatcherInterval) {
      clearInterval(videoSrcWatcherInterval);
      videoSrcWatcherInterval = null;
    }
    webTextCtrl?.destroy();
    webTextCtrl = null;
    webTokenizeCtrl?.destroy();
    webTokenizeCtrl = null;
    universalPanelMount?.unmount?.();
    universalPanelMount = null;
    pendingTokenizeSubs = [];
  } catch {
    // Best-effort cleanup on content-script teardown.
  }
}

window.addEventListener('beforeunload', cleanupContentScript);
// pagehide fires on SPA navigations (bfcache) — only clean up video/overlay,
// NOT universal panel (it should persist across SPA navs).
window.addEventListener('pagehide', () => {
  try {
    currentOverlayCleanup?.();
    currentOverlayCleanup = null;
    currentVideo = null;
    currentPendingVideo = null;
    findVideoObserver?.disconnect();
    findVideoObserver = null;
    stopVideoReadyPoll();
    episodeChangeObserver?.disconnect();
    episodeChangeObserver = null;
    if (episodeChangeDebounce) {
      clearTimeout(episodeChangeDebounce);
      episodeChangeDebounce = null;
    }
    iframeBaselineReady = false;
    lastSeenIframe = null;
    lastIframeSrc = null;
    if (videoSrcWatcherInterval) {
      clearInterval(videoSrcWatcherInterval);
      videoSrcWatcherInterval = null;
    }
    // Keep webTextCtrl, webTokenizeCtrl, universalPanelMount
    // alive across SPA navigations — they are page-level, not video-level.
  } catch {
    // Best-effort cleanup on content-script teardown.
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEpisodeChangeWatcher);
} else {
  initEpisodeChangeWatcher();
}

// Skip heavy initialization in iframes — Cloudflare's challenge iframe (1x1
// hidden) runs our content script via all_frames: true. Creating badge hosts,
// MutationObservers, and viewport observers modifies the iframe's DOM, which
// Cloudflare's bot detection can flag, causing the challenge to fail and the
// page to get stuck at "Infinite loading". Tokenize/dictionary features only
// make sense in the top-level frame anyway.
const isTopFrame = window.self === window.top;

// Run heavy DOM setup (tokenize + dictionary) at DOMContentLoaded, before
// Angular/Vue hydration rewires the DOM. These features only observe when
// enabled, so the initial badge append is cheap. findAndInitOverlay is kept
// early because it must catch <video> as soon as it appears.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
  if (isTopFrame) {
    document.addEventListener('DOMContentLoaded', () => { void initWebTextDictionary(); });
    document.addEventListener('DOMContentLoaded', () => { void initTokenize(); });
  }
} else {
  findAndInitOverlay();
  if (isTopFrame) {
    void initWebTextDictionary();
    void initTokenize();
  }
}

// Re-init web-text dictionary when settings change (no page reload needed).
onStorageChanged((changes, area) => {
  if (window.self !== window.top) return;
  if (area === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
    void initWebTextDictionary();
  }
});

// === OCR (Orca) — T18/T19/T20: init content script with trigger controller ===
// Lazily creates a SubtitleTriggerController wired to webTextCtrl so OCR
// hitbox clicks dispatch dictionary lookups (T16). initOcrContentScript
// registers chrome.storage.onChanged (toggle ON/OFF) + SPA nav listeners.
function createOcrTriggerController(): SubtitleTriggerController | null {
  if (!isTopFrame) return null;
  const ctrl = ensureWebTextCtrl();
  return new SubtitleTriggerController({
    triggerMode: 'click',
    onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => {
      const range = document.createRange();
      range.selectNodeContents(highlightTarget);
      ctrl.handleLookup(request, requestId, anchorRect, range);
    },
    onCancel: (requestId: string) => { ctrl.cancelLookup(requestId); },
    onClear: () => { ctrl.dismissLookup(); },
  });
}

if (isTopFrame) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initOcrContentScript(createOcrTriggerController);
      initializeStudyModeController();
    });
  } else {
    initOcrContentScript(createOcrTriggerController);
    initializeStudyModeController();
  }
}
