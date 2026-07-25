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
import type { VideoEpisodeChangedPayload } from '@/entities/message';

// ISOLATED content-script marker (verify injection from DevTools — MAIN world
// cannot see this because ISOLATED world globals are not shared with MAIN).
(window as unknown as Record<string, unknown>).__YT_CS_INJECTED = true;
const csInjectTime = performance.now();
(window as unknown as Record<string, unknown>).__YT_CS_INJECT_TIME = csInjectTime;

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
  if (window.self !== window.top) return;
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
  document.addEventListener('DOMContentLoaded', () => runPageScan());
} else {
  runPageScan();
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
function isVideoReady(v: HTMLVideoElement): boolean {
  return (v.src !== '' && v.src.startsWith('blob:')) || v.readyState >= 2;
}

// Track current overlay cleanup so we can tear down before re-init on SPA
// episode switch. Angular replaces <video> on episode switch → old overlay UI
// is removed by the framework's re-render, but document/onMessage listeners
// would otherwise accumulate.
let currentOverlayCleanup: (() => void) | null = null;
// Track the video element the overlay is currently attached to, so we only
// re-init when the <video> element identity actually changes (Angular may
// mount/unmount the same element multiple times during phase render).
let currentVideo: HTMLVideoElement | null = null;

// Top-level web-text dictionary controller (independent of video presence).
// Shared with subtitle overlay controller for token lookup + highlight.
let webTextCtrl: WebTextDictionaryController | null = null;
let webTokenizeCtrl: WebTokenizeController | null = null;
/** ADR-061: Pending tokenize subscribers — collected before
 *  webTokenizeCtrl is initialized (initTokenize is async and may complete
 *  after mountSettingsDialog subscribes). Flushed when webTokenizeCtrl is
 *  created. Without this, the orbital badge's SettingsDialog never receives
 *  tokenize state updates → toggles don't visually switch. */
let pendingTokenizeSubs: Array<(s: { enabled: boolean; showStatus: boolean; showFrequency: boolean }) => void> = [];

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
      // Orbital badge settings panel — merged from the former token FAB.
      // The panel reads/writes tokenize state via these callbacks. Lazily
      // reads `webTokenizeCtrl` at click time (may be null on first render).
      panel: {
        getState: () => {
          const s = webTokenizeCtrl?.getState();
          return {
            enabled: s?.enabled ?? false,
            showStatus: s?.showStatus ?? false,
            showFrequency: s?.showFrequency ?? false,
          };
        },
        onToggle: (key) => {
          if (key === 'enabled') webTokenizeCtrl?.toggleEnabled();
          else if (key === 'showStatus') webTokenizeCtrl?.toggleShowStatus();
          else if (key === 'showFrequency') webTokenizeCtrl?.toggleShowFrequency();
        },
        onOpenDictionary: () => {
          const term = webTokenizeCtrl?.pickDictionaryTerm();
          if (term) {
            const ctrl = ensureWebTextCtrl();
            ctrl.handleLookup(
              { term, langCode: 'en', contextSentence: '', cursorOffset: 0 },
              `tokenize-panel-${term}`,
              document.body.getBoundingClientRect(),
              (() => { const r = document.createRange(); r.selectNodeContents(document.body); return r; })(),
            );
          }
        },
        subscribe: (cb) => {
          if (!webTokenizeCtrl) {
            // ADR-061: webTokenizeCtrl not yet initialized — queue the
            // subscriber. It will be registered when initTokenize completes.
            pendingTokenizeSubs.push(cb);
            return () => {
              pendingTokenizeSubs = pendingTokenizeSubs.filter((c) => c !== cb);
            };
          }
          return webTokenizeCtrl.subscribe((s) => {
            cb({ enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency });
          });
        },
      },
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
    for (const cb of pendingTokenizeSubs) {
      webTokenizeCtrl.subscribe((s) => {
        cb({ enabled: s.enabled, showStatus: s.showStatus, showFrequency: s.showFrequency });
      });
    }
    pendingTokenizeSubs = [];
  } catch (err) {
    // Storage may be unavailable in some test/sandbox contexts — safe fallback.
    console.warn('[content-script] initTokenize failed', err);
  }
}

function findAndInitOverlay(): void {
  if (window.self !== window.top) return;
  const video = document.querySelector('video');
  if (video && isVideoReady(video)) {
    if (video === currentVideo) return; // already initialized for this element
    currentOverlayCleanup?.();
    currentVideo = video;
    currentOverlayCleanup = initContentScriptController(video, ensureWebTextCtrl());
    return;
  }

  // SPA: video may be rendered after DOMContentLoaded, or may exist but not yet
  // have a real source (Angular two-phase render — see isVideoReady). Observe
  // body until a ready video appears. attributeFilter:['src'] catches the
  // phase-2 src assignment (blob: URL) that childList alone would miss.
  // ponytail: disconnect as soon as a ready video is found to avoid unnecessary
  // mutation work.
  // AC4.4 early-exit: if no video after 10s, disconnect observer (no video on page).
  const observer = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (v && isVideoReady(v) && v !== currentVideo) {
      observer.disconnect();
      clearTimeout(disconnectTimer);
      currentOverlayCleanup?.();
      currentVideo = v;
      currentOverlayCleanup = initContentScriptController(v, ensureWebTextCtrl());
    }
  });
  const root = document.body ?? document.documentElement;
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  // AC4.4: auto-disconnect after 10s if no video appears (early-exit optimization)
  const disconnectTimer = setTimeout(() => observer.disconnect(), 10000);
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

function reportEpisodeChanged(reason: 'replacement' | 'src-change'): void {
  if (!hasSeenFirstVideo) return; // first video — baseline, not a switch
  // Tell the background to clear the previous episode's media before the new
  // episode's media is detected.
  const payload: VideoEpisodeChangedPayload = {
    tabId: undefined, // background resolves from sender.tab.id
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
  reportEpisodeChanged('replacement');
  lastSeenVideo = video;
  lastVideoSrc = video.src || video.currentSrc || null;
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
  setInterval(() => {
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
      reportEpisodeChanged('src-change');
    }
  }, 500);
}

function initEpisodeChangeWatcher(): void {
  if (window.self !== window.top) return;
  // If a <video> is already present at inject time, that's the first one —
  // baseline it without firing an episode-changed event.
  const existing = document.querySelector('video');
  if (existing) {
    hasSeenFirstVideo = true;
    lastSeenVideo = existing;
    lastVideoSrc = existing.src || existing.currentSrc || null;
  }
  // Persistently observe for new <video> elements. A NEW element appearing
  // after the first one was seen = episode switch (element replacement).
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          reportEpisodeChangedIfReplacement(node as HTMLVideoElement);
        } else if (node instanceof Element) {
          const v = node.querySelector('video');
          if (v) reportEpisodeChangedIfReplacement(v);
        }
      }
    }
  });
  const root = document.body ?? document.documentElement;
  observer.observe(root, { childList: true, subtree: true });
  // Also watch for src changes on the same element (aniwatch sub→dub case).
  initVideoSrcWatcher();
}

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
