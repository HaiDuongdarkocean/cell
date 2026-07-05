import { sendMessage } from '@/shared/lib/chrome-apis';
import { PageScanner } from './pageScanner';
import { clearAutoLoadCache, initContentScriptController } from '@/features/subtitle';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { VideoEpisodeChangedPayload } from '@/entities/message';

// ISOLATED content-script marker (verify injection from DevTools — MAIN world
// cannot see this because ISOLATED world globals are not shared with MAIN).
(window as unknown as Record<string, unknown>).__YT_CS_INJECTED = true;
const csInjectTime = performance.now();
(window as unknown as Record<string, unknown>).__YT_CS_INJECT_TIME = csInjectTime;
console.log('[content-script] injected at', document.readyState, 'time:', csInjectTime);

// ADR-020 race fix: notify the MAIN-world YouTube script that our message
// listener is registered. CRXJS async dynamic-import loader delays ISOLATED
// content-script injection past the MAIN-world `__YT_DETECTED_SUBTITLES` post
// on SPA navigation → the MAIN world re-posts last tracks on this handshake.
window.postMessage({ type: '__YT_CS_READY', time: csInjectTime }, '*');

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
    });
    return false;
  }
  return false;
});

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
// Clear auto-load cache on every (re)inject — tab navigate re-injects the
// content-script, so the per-URL cache must not survive across navigations.
clearAutoLoadCache();
const scanner = new PageScanner();

// === Main-world fetch interceptor bridge (ADR-011) ===
// The main-world fetchInterceptor.iife.ts patches `window.fetch` and posts
// detected subtitle URLs via `window.postMessage`. This isolated-world
// listener receives them and relays to the background, which adds them to
// the network interceptor's subtitle store. This catches subtitle fetches
// that page Service Workers serve from cache (webRequest does not fire for
// cached responses).
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
    console.log('[content-script] __YT_DETECTED_SUBTITLES received', {
      trackCount: (data as { tracks?: unknown[] }).tracks?.length,
      videoId,
      postTime: data.postTime,
    });
    void sendMessage({
      type: MESSAGE_TYPES.DETECTED_SUBTITLES,
      payload: {
        tabId: undefined,
        tracks: (data as { tracks?: unknown[] }).tracks ?? [],
        videoId,
      },
    }).then(
      (r) => console.log('[content-script] DETECTED_SUBTITLES bg response', r),
      (e) => console.error('[content-script] DETECTED_SUBTITLES bg error', e),
    );
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
});

// Scan on page load — defer to DOMContentLoaded because content-script now
// runs at document_start (ADR-020: listener must register before MAIN world
// posts `__YT_DETECTED_SUBTITLES` after InnerTube fetch ~3-4s after start).
// Page scanning needs DOM ready, but the message listener above registers
// immediately at document_start (no DOM dependency).
function runPageScan(): void {
  const urls = scanner.scan();
  if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: undefined,
        videoUrls: urls.videoUrls,
        subtitleUrls: urls.subtitleUrls
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
        subtitleUrls: newUrls.subtitleUrls
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

function findAndInitOverlay(): void {
  const video = document.querySelector('video');
  if (video && isVideoReady(video)) {
    if (video === currentVideo) return; // already initialized for this element
    currentOverlayCleanup?.();
    currentVideo = video;
    currentOverlayCleanup = initContentScriptController(video);
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
      currentOverlayCleanup = initContentScriptController(v);
    }
  });
  observer.observe(document.body, {
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

function reportEpisodeChangedIfReplacement(video: HTMLVideoElement): void {
  if (video === lastSeenVideo) return; // same element, not a replacement
  if (hasSeenFirstVideo) {
    // A previous <video> was already seen → this new one is a replacement
    // (episode switch). Tell the background to clear the previous episode's
    // media before the new episode's media is detected.
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
          },
        });
      }
    });
    // Re-init overlay for the new <video> element. Angular replaces the entire
    // <video> on episode switch → old overlay UI (toggle button, manager panel)
    // is removed by the framework's re-render. findAndInitOverlay waits for the
    // new video to be ready (blob: src, Angular phase-2 render) then re-injects.
    findAndInitOverlay();
  }
  lastSeenVideo = video;
  hasSeenFirstVideo = true;
}

function initEpisodeChangeWatcher(): void {
  // If a <video> is already present at inject time, that's the first one —
  // baseline it without firing an episode-changed event.
  const existing = document.querySelector('video');
  if (existing) {
    hasSeenFirstVideo = true;
    lastSeenVideo = existing;
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
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEpisodeChangeWatcher);
} else {
  initEpisodeChangeWatcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndInitOverlay);
} else {
  findAndInitOverlay();
}
