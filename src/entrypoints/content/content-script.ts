import { sendMessage } from '@/shared/lib/chrome-apis';
import { PageScanner } from './pageScanner';
import { clearAutoLoadCache, initContentScriptController } from '@/features/subtitle';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { VideoEpisodeChangedPayload } from '@/entities/message';

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
  const data = event.data as { type?: string; url?: string } | null;
  if (data?.type !== '__DETECTED_SUBTITLE_FETCH' || !data.url) return;
  void sendMessage({
    type: MESSAGE_TYPES.DETECTED_SUBTITLE_URL,
    payload: { tabId: undefined, url: data.url },
  });
});

// Scan on page load — gửi không tabId, background resolve từ sender
const urls = scanner.scan();
if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
  void sendMessage({
    type: 'PAGE_SCAN_RESULT',
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

function findAndInitOverlay(): void {
  const video = document.querySelector('video');
  if (video && isVideoReady(video)) {
    initContentScriptController(video);
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
    if (v && isVideoReady(v)) {
      observer.disconnect();
      clearTimeout(disconnectTimer);
      initContentScriptController(v);
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

function reportEpisodeChangedIfReplacement(): void {
  if (hasSeenFirstVideo) {
    // A previous <video> was already seen → this new one is a replacement
    // (episode switch). Tell the background to clear the previous episode's
    // media before the new episode's media is detected.
    const payload: VideoEpisodeChangedPayload = {
      tabId: undefined, // background resolves from sender.tab.id
    };
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_EPISODE_CHANGED,
      payload,
    });
  }
  hasSeenFirstVideo = true;
}

function initEpisodeChangeWatcher(): void {
  // If a <video> is already present at inject time, that's the first one —
  // baseline it without firing an episode-changed event.
  if (document.querySelector('video')) {
    hasSeenFirstVideo = true;
  }
  // Persistently observe for new <video> elements. A NEW element appearing
  // after the first one was seen = episode switch (element replacement).
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          reportEpisodeChangedIfReplacement();
        } else if (node instanceof Element && node.querySelector('video')) {
          reportEpisodeChangedIfReplacement();
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
