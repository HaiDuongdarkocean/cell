// Player container discovery — pure DOM-read algorithm (no side effects).
//
// Finds the host player element that should be moved into Player Mode's
// video stage. Runs in any document (main page or iframe) because the
// extension content script is declared with all_frames=true. The algorithm
// starts at the largest playable <video> and walks up to the farthest
// ancestor whose bounding width AND height are each within a per-dimension
// tolerance of the video. Per-dimension (not area) comparison rejects a
// container with the same height but a much wider width (e.g. themoviebox
// .player-container 1635×690 vs video 1226×690, width +33%) while still
// accepting a container that is slightly taller because it owns the control
// bar (e.g. kisskh .videoplayer 1103×922 vs video 1103×913, height +1%).
//
// Algorithmic complexity: O(d) where d = DOM depth from video to body.

/** Per-dimension relative tolerance. Each dimension (width, height) must
 * independently stay within this fraction of the video's dimension.
 * 10% accepts control-bar height overhead (typically 1–10% of video height)
 * while rejecting layout containers that are significantly wider/taller. */
const DEFAULT_DIMENSION_TOLERANCE = 0.10;

/**
 * Find the best player container to move into Player Mode's video stage.
 *
 * @returns The player container element, or null if no playable video found.
 */
export function findPlayerContainer(): HTMLElement | null {
  const video = findLargestPlayableVideo();
  if (!video) return null;
  return findFarthestSameSizeContainer(video);
}

/**
 * Walk up from a <video> element to the farthest ancestor whose bounding
 * width AND height are each within `tolerance` of the video's corresponding
 * dimension. Per-dimension comparison (not area) so a container matching one
 * axis but diverging on the other is rejected. This is the shared container
 * algorithm for Player Mode and Split View.
 */
export function findFarthestSameSizeContainer(
  video: HTMLVideoElement,
  tolerance: number = DEFAULT_DIMENSION_TOLERANCE,
): HTMLElement {
  // YouTube: #movie_player is the player shell owning native controls + the
  // video. The same-size walk overshoots to #player (outer layout wrapper with
  // no controls), so the bounds effect walks #cinematics-container instead of
  // .html5-video-container → video height collapses to 0. Short-circuit to the
  // known shell when present. Ponytail ceiling: hardcoded YouTube selector;
  // upgrade path = per-host adapter registry if more structured hosts appear.
  //
  // Structural escape: when movie_player's parent has no content-box height
  // (padding-driven aspect-ratio shells like m.youtube .player-size set
  // height:0 + padding-top:56.25%), the shell is a floating surface, not a
  // flow box — wrapping it collapses the stage to h:0 and the outer same-size
  // ancestor is the real shell. Let the walk continue instead.
  const moviePlayer = document.querySelector('#movie_player');
  if (moviePlayer instanceof HTMLElement && moviePlayer.contains(video)) {
    const parent = moviePlayer.parentElement;
    const parentHeight = parent ? parseFloat(getComputedStyle(parent).height) : 0;
    const paddingDrivenParent = Number.isFinite(parentHeight) && parentHeight <= 1;
    if (!paddingDrivenParent) {
      return moviePlayer;
    }
  }

  const baseRect = video.getBoundingClientRect();
  const vw = Math.round(baseRect.width);
  const vh = Math.round(baseRect.height);

  let farthest: HTMLElement = video;
  let el: HTMLElement | null = video.parentElement;

  while (el && el !== document.body) {
    // Skip Tihoka's own Split View elements (wrapper/stage/handle/panel) —
    // they're ancestors of the video after a normal→fullscreen→normal
    // transition but are NOT the real player shell. Walking through them
    // would return the old wrapper as playerShell, breaking the next run.
    if (el.hasAttribute('data-tihoka-split-view')) {
      el = el.parentElement;
      continue;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      el = el.parentElement;
      continue;
    }

    const wDiff = Math.abs(Math.round(rect.width) - vw) / vw;
    const hDiff = Math.abs(Math.round(rect.height) - vh) / vh;
    if (wDiff <= tolerance && hDiff <= tolerance) {
      farthest = el;
    }

    // Do not stop on a rejected intermediate wrapper. A wider ancestor can be
    // the actual player shell (e.g. video aspect-ratio wrapper → controls shell).
    el = el.parentElement;
  }

  return farthest;
}

import { findLargestPlayableVideo as findLargestPlayableVideoFromDom } from '@/shared/lib/dom/videoFinder';

/** Find the largest <video> with a non-zero bounding rect.
 *
 * Does NOT require readyState ≥ 1 — CDN-slow pages (e.g. themoviebox) can
 * have readyState=0 for seconds while the video element is already visually
 * present. Filtering by readyState would make findPlayerContainer return
 * null, breaking Player Mode entry until metadata loads.
 *
 * Delegates to videoFinder so Player Mode and the overlay use the same
 * shadow-DOM-aware discovery. */
export function findLargestPlayableVideo(): HTMLVideoElement | null {
  return findLargestPlayableVideoFromDom();
}

/**
 * Find the overlay container for a video — ADR-008 D2.
 *
 * Starts at `video.parentElement` and walks up to the first ancestor whose
 * height is at least 50% of the video's height. This handles sites where
 * `video.parentElement` has zero height (e.g. YouTube's `.html5-video-container`
 * has `height:0` with the `<video>` absolutely positioned inside it, while the
 * real sized container is `#movie_player` — the grandparent). On normal sites
 * the parent already matches the video height, so the walk-up stops immediately.
 * Ancestors taller than ~160% of the video wrap non-video content (figure +
 * figcaption) and are skipped — anchoring inset:0 there lands the overlay on
 * the caption. When no tight ancestor exists, an inline direct parent wins
 * (it shrink-wraps the video once promoted), else the first oversized
 * ancestor, else `video.parentElement`/`document.body`.
 *
 * Callers that mount Tihoka video-level UI should go through
 * findVideoOverlayContainer, which lifts the result to the shared ancestor
 * on hosts whose own overlays live outside the video subtree.
 */
export function findVideoContainer(video: HTMLVideoElement): HTMLElement {
  const videoHeight = video.getBoundingClientRect().height;
  // Shadow DOM: the video may be a direct child of a shadow root with no
  // parentElement in the light DOM. Start from the shadow host so the overlay
  // can attach to a real element instead of falling back to document.body.
  const shadowHost =
    video.getRootNode() instanceof ShadowRoot
      ? ((video.getRootNode() as ShadowRoot).host as HTMLElement | null)
      : null;
  const directParent = video.parentElement ?? shadowHost;
  let el: HTMLElement | null = directParent;
  let oversized: HTMLElement | null = null;
  while (el && el !== document.body) {
    const h = el.getBoundingClientRect().height;
    if (videoHeight > 0 && h >= videoHeight * 0.5) {
      // An ancestor taller than ~160% of the video carries non-video content
      // (Wikipedia figure embeds video + figcaption) — anchoring inset:0 to it
      // lands the overlay on the caption/text instead of the video. Prefer a
      // tight inline wrapper, else this oversized ancestor as last resort.
      if (h <= videoHeight * 1.6) return el;
      oversized ??= el;
    }
    el = el.parentElement;
  }
  // Inline parents (e.g. Wikipedia's SPAN.mw-tmh-player) report ~0 height but
  // shrink-wrap the video once the caller promotes them to inline-block.
  if (directParent && getComputedStyle(directParent).display === 'inline') {
    return directParent;
  }
  return oversized ?? directParent ?? document.body;
}

/** Mount container for Tihoka video-level UI (subtitle overlay host, toasts,
 *  drag hint). Usually the nearest sized ancestor (findVideoContainer), but
 *  when the host site keeps its own video overlays in a SIBLING subtree of
 *  the video, no z-index inside the video subtree can paint above them.
 *  m.youtube: #player-control-container (native controls + scrim) is a
 *  sibling of #player — mount into the shared parent #player-container-id so
 *  Tihoka UI, appended last with var(--z-overlay-video), wins the context.
 *  Tihoka's body-level surfaces (dictionary popup, universal panel, dialogs)
 *  still render above via their own stacking contexts, and portals via
 *  higher z-index. The same-size guard keeps `inset:0` anchored to the
 *  video box; any layout divergence falls back to the nearest container.
 *  ponytail: hardcoded m.youtube selectors — if more hosts keep overlays
 *  outside the video subtree, upgrade to a per-host adapter or generic
 *  "covering sibling" detection. */
export function findVideoOverlayContainer(video: HTMLVideoElement): HTMLElement {
  const shell = document.getElementById('player-container-id');
  if (shell && document.getElementById('player-control-container') && shell.contains(video)) {
    const videoRect = video.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (
      videoRect.width > 0 &&
      videoRect.height > 0 &&
      Math.abs(shellRect.width - videoRect.width) / videoRect.width <= DEFAULT_DIMENSION_TOLERANCE &&
      Math.abs(shellRect.height - videoRect.height) / videoRect.height <= DEFAULT_DIMENSION_TOLERANCE
    ) {
      return shell;
    }
  }
  return findVideoContainer(video);
}
