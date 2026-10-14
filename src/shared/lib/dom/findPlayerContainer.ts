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
  return pickYoutubePlayerShell(video) ?? findPlayerShell(video);
}

// The player shell is the outermost ancestor that still belongs to the
// player — it owns CHROME: positioned elements (absolute|fixed) painted on
// the video's box (control bars, overlay scrims). Neutral same-size
// wrappers are traversed but never selected: a layout cell that merely
// shares the video's box is an unstable anchor — kisskh .col-12 loses
// col-xl-7 under 1200px, the shell then spans the full row and the dock
// strip collapses to 0px. An ancestor that outgrows the player box without
// adding chrome is page layout → stop. Chrome also has to stay ≤1.5× the
// video per dimension — page-level scrims (kisskh .mat-drawer-backdrop
// spans the whole page) live higher up and must not pull the shell into
// the app container.
const CHROME_COVER_RATIO = 0.05;
const SHELL_MAX_VS_VIDEO = 1.5;

export function findPlayerShell(video: HTMLVideoElement): HTMLElement {
  const videoRect = video.getBoundingClientRect();
  const vw = Math.round(videoRect.width);
  const vh = Math.round(videoRect.height);
  const videoArea = vw * vh;

  let candidate: HTMLElement = video;
  let el: HTMLElement | null = video.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    // Skip Tihoka's own Split View elements — they're ancestors of the
    // video after a normal→fullscreen→normal transition but are NOT the
    // real player shell.
    if (el.hasAttribute('data-tihoka-split-view')) break;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      el = el.parentElement;
      continue;
    }
    // display:inline ancestors (Angular custom elements like mat-video) can
    // wrap the video's box but width:% never applies to them — an
    // unresizable shell leaves the dock strip at 0px. Traverse, never pick.
    const resizable = getComputedStyle(el).display !== 'inline';
    const withinCap =
      rect.width <= vw * SHELL_MAX_VS_VIDEO && rect.height <= vh * SHELL_MAX_VS_VIDEO;
    if (resizable && withinCap && ownsVideoChrome(el, candidate, videoRect, videoArea)) {
      candidate = el;
      el = el.parentElement;
      continue;
    }
    const wDiff = Math.abs(Math.round(rect.width) - vw) / vw;
    const hDiff = Math.abs(Math.round(rect.height) - vh) / vh;
    if (wDiff > DEFAULT_DIMENSION_TOLERANCE || hDiff > DEFAULT_DIMENSION_TOLERANCE) break;
    // Nearest same-size ancestor = the tightest player box. Later same-size
    // wrappers add nothing — traverse them but keep the tight pick. Only a
    // still-unpicked walk (candidate === video) may claim the box: a chrome
    // upgrade already found a deeper shell and must not be overwritten by
    // a neutral layout cell like kisskh's .col-12.
    if (resizable && candidate === video) {
      candidate = el;
    }
    el = el.parentElement;
  }
  return candidate;
}

// Chrome = a positioned child of `el` outside the candidate subtree that
// covers ≥5% of the video's box. Player chrome (control bars ~10–30%)
// clears the bar; slivers like badge overlays do not.
function ownsVideoChrome(
  el: HTMLElement,
  candidate: HTMLElement,
  videoRect: DOMRect,
  videoArea: number,
): boolean {
  for (const child of Array.from(el.children)) {
    if (child === candidate || child.contains(candidate)) continue;
    if (!(child instanceof HTMLElement)) continue;
    if (child.id.startsWith('Tihoka') || child.hasAttribute('data-tihoka-split-view')) continue;
    const cs = getComputedStyle(child);
    if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
    const c = child.getBoundingClientRect();
    const iw = Math.min(c.right, videoRect.right) - Math.max(c.left, videoRect.left);
    const ih = Math.min(c.bottom, videoRect.bottom) - Math.max(c.top, videoRect.top);
    if (iw > 0 && ih > 0 && (iw * ih) / videoArea >= CHROME_COVER_RATIO) return true;
  }
  return false;
}

import { findLargestPlayableVideo as findLargestPlayableVideoFromDom } from '@/shared/lib/dom/videoFinder';
import { isYoutubePage, pickYoutubeOverlayMount, pickYoutubePlayerShell } from '@/shared/lib/dom/youtubePlayer';

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
 *  drag hint). Host-specific picks live in the per-host modules (e.g.
 *  pickYoutubeOverlayMount mounts into the shared ancestor because the
 *  host's own overlays sit in a sibling subtree — no z-index inside the
 *  video subtree can paint above them). The generic fallback is the
 *  nearest sized ancestor (findVideoContainer). */
export function findVideoOverlayContainer(video: HTMLVideoElement): HTMLElement {
  return pickYoutubeOverlayMount(video) ?? findVideoContainer(video);
}

// True when the overlay host sits somewhere other than the host-preferred
// mount — e.g. the Tihoka root still inside #movie_player because m.youtube
// had not laid out #player-container-id yet at init (the pick can only win
// once the shell resolves to the video's box). Host elements currently owned
// by a Tihoka surface (inside the split-view wrapper) don't count — the
// surface decides their anchor. Cheap on non-YouTube: the pick short-circuits
// on a missing element id before any layout reads.
export function videoOverlayMountNeedsMove(
  video: HTMLVideoElement,
  host: HTMLElement | null,
  hostname: string = location.hostname,
): boolean {
  if (!host || !isYoutubePage(hostname)) return false;
  if (host.closest('[data-tihoka-split-view]')) return false;
  const pick = pickYoutubeOverlayMount(video);
  return pick !== null && host.parentElement !== pick;
}
