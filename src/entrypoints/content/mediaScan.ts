import { sendMessage } from '@/shared/lib/chrome-apis';
import { PageScanner } from './pageScanner';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { findLargestPlayableVideo } from '@/shared/lib/dom/videoFinder';
import { isCellDebug } from './debugLog';

// ponytail: content script không có chrome.tabs API — gửi message không tabId,
// background tự lấy từ sender.tab.id (xem messageBus.handleMessage)
const scanner = new PageScanner();

// Guard: runPageScan is invoked both on DOMContentLoaded and from
// findAndInitOverlay when a video appears late. The flag prevents duplicate
// initial PAGE_SCAN_RESULT sends and observer restarts.
let pageScanObserverStarted = false;

// Scan on page load — defer to DOMContentLoaded because content-script now
// runs at document_start (ADR-020: listener must register before MAIN world
// posts `__YT_DETECTED_SUBTITLES` after InnerTube fetch ~3-4s after start).
// Page scanning needs DOM ready, but the message listener above registers
// immediately at document_start (no DOM dependency).
export function initMediaScan(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runPageScan();
      runSubtitleDiscoveryScan();
    });
  } else {
    runPageScan();
    runSubtitleDiscoveryScan();
  }
}

export function runPageScan(): void {
  // Scan the top frame and any iframe that actually hosts a <video>.
  // Cross-origin iframe players (vidnest.fun, anikage.cc, etc.) keep <track>
  // elements inside the iframe, so scanning only the top frame misses the
  // entire subtitle list. Background deduplicates by URL, so overlapping scans
  // across frames are safe. Iframes without a video are skipped to avoid
  // observing ad/empty frames.
  if (window.self !== window.top && !findLargestPlayableVideo()) return;
  const urls = scanner.scan();

  // Debug: surface scan results so browser tests can verify the content script
  // is finding media. Only enabled for E2E builds via CELL_E2E=1.
  if (isCellDebug()) {
    const debugTarget = window.self === window.top ? window : window.parent;
    debugTarget.postMessage({
      type: '__CELL_DEBUG_PAGE_SCAN',
      pageUrl: window.location.href,
      videoUrls: urls.videoUrls,
      subtitleUrls: urls.subtitleUrls,
      trackSubtitles: urls.trackSubtitles,
    }, '*');
    document.documentElement.setAttribute(
      'data-cell-runscan',
      JSON.stringify({ pageUrl: window.location.href, videos: urls.videoUrls.length, subtitles: urls.subtitleUrls.length, tracks: urls.trackSubtitles.length }),
    );
  }

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
  if (
    urls.videoUrls.length > 0 ||
    urls.subtitleUrls.length > 0 ||
    urls.trackSubtitles.length > 0
  ) {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: undefined,
        videoUrls: urls.videoUrls,
        subtitleUrls: urls.subtitleUrls,
        trackSubtitles: urls.trackSubtitles,
        pageUrl: window.location.href,
      },
    });
  }

  // Start observing for dynamically loaded content
  scanner.startObserving((newUrls) => {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: undefined,
        videoUrls: newUrls.videoUrls,
        subtitleUrls: newUrls.subtitleUrls,
        trackSubtitles: newUrls.trackSubtitles,
        pageUrl: window.location.href,
      },
    });
  });
}

// Re-scan after the background has processed VIDEO_EPISODE_CHANGED. The
// PageScanner's MutationObserver (registered before the episode watcher)
// already fired on the same mutation batch and sent PAGE_SCAN_RESULT with the
// new episode's track URLs, but that result arrives at the background BEFORE
// VIDEO_EPISODE_CHANGED (observer registration order), so the clear wipes the
// newly-added subtitles. Re-scanning after the clear restores them.
export function scanAndReportIfFound(): void {
  const urls = scanner.scan();
  if (
    urls.videoUrls.length > 0 ||
    urls.subtitleUrls.length > 0 ||
    urls.trackSubtitles.length > 0
  ) {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: undefined,
        videoUrls: urls.videoUrls,
        subtitleUrls: urls.subtitleUrls,
        trackSubtitles: urls.trackSubtitles,
        pageUrl: window.location.href,
      },
    });
  }
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

  // 2. HTML player variable fallback (MyAsianTV/kisscloud, vidrift).
  const html = document.documentElement.outerHTML;
  const hasPlayerjsSubtitle = html.includes('playerjsSubtitle');
  const hasSubtitleTracks = html.includes('subtitleTracks');
  if (hasPlayerjsSubtitle || hasSubtitleTracks) {
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
    if (isCellDebug()) {
      document.documentElement.setAttribute(
        'data-cell-subtitle-discovery-scan',
        JSON.stringify({
          kinds: ['document-html'],
          variable: hasPlayerjsSubtitle ? 'playerjsSubtitle' : hasSubtitleTracks ? 'subtitleTracks' : null,
          url: location.href,
        }),
      );
    }
  }
}
