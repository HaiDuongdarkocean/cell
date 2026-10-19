import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { VideoEpisodeChangedPayload } from '@/entities/message';
import { getFirstVideo } from '@/shared/lib/dom/videoFinder';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { findAndInitOverlay } from './videoOverlay';
import { scanAndReportIfFound } from './mediaScan';
import { isTihokaDebug } from './debugLog';

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

function reportEpisodeChanged(
  reason: 'replacement' | 'src-change' | 'iframe-replacement' | 'iframe-src-change',
  pageUrl?: string,
): void {
  if (!hasSeenFirstVideo) return; // first video/iframe — baseline, not a switch
  // Debug marker visible in the page so DevTools / E2E can verify the top frame
  // saw the provider/episode switch.
  if (isTihokaDebug()) {
    document.documentElement.setAttribute('data-tihoka-episode-changed', reason);
    document.documentElement.setAttribute('data-tihoka-episode-time', String(Date.now()));
  }
  // Tell the background to clear the previous episode's media before the new
  // episode's media is detected.
  const payload: VideoEpisodeChangedPayload = {
    tabId: undefined, // background resolves from sender.tab.id
    pageUrl,
    episodeAt: Date.now(),
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
    scanAndReportIfFound();
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
    const video = getFirstVideo();
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
    // (ADR-123) blob: URLs rotate every few seconds during MSE playback
    // (YouTube) — they carry no episode semantics, so reporting them wipes
    // freshly auto-loaded cues. Element replacement still covers blob sites
    // that swap <video>.
    if (currentSrc !== lastVideoSrc) {
      const isBlob = currentSrc.startsWith('blob:');
      lastVideoSrc = currentSrc;
      lastSeenVideo = video;
      if (!isBlob) {
        reportEpisodeChanged('src-change', currentSrc);
      }
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
  if (isChildFrame()) {
    try {
      if (window.innerWidth <= 10 && window.innerHeight <= 10) return;
    } catch {
      return;
    }
  }
  const isTop = !isChildFrame();
  // Baseline the first <video> or player iframe at inject time — these are not
  // considered an episode switch.
  const existing = getFirstVideo();
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

export function initEpisodeChangeWatcherOnReady(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEpisodeChangeWatcher);
  } else {
    initEpisodeChangeWatcher();
  }
}

export function cleanupEpisodeWatcher(): void {
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
}
