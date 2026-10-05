import { isVideoReady } from '@/shared/lib/dom/videoReady';
import { findLargestPlayableVideo, hasVideo } from '@/shared/lib/dom/videoFinder';
import { runPageScan } from './mediaScan';

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
// Lightweight periodic re-scan for players that create the <video> well after
// DOMContentLoaded without any user click (Next.js/Playembed lazy players).
let videoFindPoll: ReturnType<typeof setInterval> | null = null;
let findVideoObserver: MutationObserver | null = null;

function stopVideoReadyPoll(): void {
  if (videoReadyPoll) {
    clearInterval(videoReadyPoll);
    videoReadyPoll = null;
  }
}

function stopVideoFindPoll(): void {
  if (videoFindPoll) {
    clearInterval(videoFindPoll);
    videoFindPoll = null;
  }
}

function finishVideoInit(video: HTMLVideoElement): void {
  stopVideoReadyPoll();
  stopVideoFindPoll();
  if (video === currentVideo) return;
  currentPendingVideo = null;
  currentOverlayCleanup?.();
  currentVideo = video;
  void Promise.all([
    import('@/features/subtitle'),
    import('@/features/cardCreator/service/cardCreatorActionPorts'),
    import('./featureInit'),
  ]).then(([subtitleMod, portsMod, featureInitMod]) => {
    if (video !== currentVideo) return;
    currentOverlayCleanup = subtitleMod.initContentScriptController(
      video,
      featureInitMod.ensureWebTextCtrl(),
      featureInitMod.handleTokenizeStatusKey,
      portsMod.createCardCreatorActionPorts(),
    );
  }).catch((err: unknown) => {
    console.warn('[content-script] overlay init failed', err);
  });
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
    if (hasVideo(video)) {
      finishVideoInit(video);
    } else {
      stopVideoReadyPoll();
    }
  };
  video.addEventListener('loadedmetadata', onReady, { once: true });
  // Fallback poll for players that set currentSrc without firing loadedmetadata.
  // ponytail: naive 100ms poll, stop when the 10s findVideoObserver timeout fires.
  videoReadyPoll = setInterval(() => {
    if (!hasVideo(video)) {
      stopVideoReadyPoll();
      return;
    }
    if (isVideoReady(video)) {
      finishVideoInit(video);
    }
  }, 100);
}

export function findAndInitOverlay(): void {
  // ADR: allow injection in iframes that host the actual <video> element
  // (animekai.be / shuttletv.su embed via cross-origin iframe). The top frame
  // has no <video>; the iframe does. Use a shadow-DOM-aware, visible-video
  // finder; iframes without a visible video are skipped to avoid observing
  // ad/empty frames.
  const video = findLargestPlayableVideo();
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
  stopVideoFindPoll();
  findVideoObserver = new MutationObserver(() => {
    const v = findLargestPlayableVideo();
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
  //
  // Playembed/Next.js players auto-play after lazy-loading the player and may
  // create the <video> after the 10s MutationObserver window without a user
  // gesture. Keep a lightweight 500ms poll running for up to 60s so the overlay
  // still initializes once the video mounts.
  const disconnectTimer = setTimeout(() => {
    findVideoObserver?.disconnect();
    findVideoObserver = null;
    if (currentVideo || currentPendingVideo) return;
    const onClickRetry = (): void => {
      if (currentVideo || currentPendingVideo) {
        document.removeEventListener('click', onClickRetry, true);
        return;
      }
      const v = findLargestPlayableVideo();
      if (v && v !== currentVideo) {
        document.removeEventListener('click', onClickRetry, true);
        stopVideoFindPoll();
        tryInitVideoWhenReady(v);
      }
    };
    document.addEventListener('click', onClickRetry, true);

    // ponytail: 500ms poll is a naive fallback for auto-play lazy players.
    // Ceiling: closed Shadow DOM or players that never create a <video> element.
    stopVideoFindPoll();
    let findAttempts = 0;
    const MAX_FIND_ATTEMPTS = 100; // 50s of additional polling
    videoFindPoll = setInterval(() => {
      findAttempts++;
      if (currentVideo || currentPendingVideo || findAttempts > MAX_FIND_ATTEMPTS) {
        stopVideoFindPoll();
        return;
      }
      const v = findLargestPlayableVideo();
      if (v && v !== currentVideo) {
        stopVideoFindPoll();
        tryInitVideoWhenReady(v);
      }
    }, 500);
  }, 10000);
}

export function cleanupVideoOverlay(): void {
  currentOverlayCleanup?.();
  currentOverlayCleanup = null;
  currentVideo = null;
  currentPendingVideo = null;
  findVideoObserver?.disconnect();
  findVideoObserver = null;
  stopVideoReadyPoll();
  stopVideoFindPoll();
}
