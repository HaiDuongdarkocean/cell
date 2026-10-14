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
  return pickYoutubePlayerShell(video)
    ?? liftToOverlayOwner(findFarthestSameSizeContainer(video));
}

// Hosts can mount their player chrome (controls/scrim overlays) as siblings
// NEXT TO the video subtree instead of inside it — m.youtube keeps
// .player-controls-background / #player-control-overlay as siblings of
// #player inside #player-container-id. The same-size walk may stop at the
// inner shell when the outer container exceeds the dimension tolerance
// (landscape stretches the fixed container wider than the video), leaving
// those overlays floating over the split-view stage AND panel — they paint
// above and swallow pointer hits. The real stage shell is the shared parent
// of the covered subtree: climb ancestors while one owns a positioned
// sibling covering ≥80% of it, and lift the shell to that parent.
const OVERLAY_COVER_RATIO = 0.8;

function liftToOverlayOwner(shell: HTMLElement): HTMLElement {
  // A lift must stay inside the visible slot — reject page-column parents
  // that dwarf the viewport (height cap keeps room for the masthead).
  const maxH = window.innerHeight * 1.2;
  const maxW = window.innerWidth + 1;
  let lifted = shell;
  let node: HTMLElement | null = shell;
  while (node && node !== document.body && node !== document.documentElement) {
    // Never treat our own split-view elements as evidence — on a re-open the
    // video sits inside stageTihoka and the panel must not lift us into the
    // wrapper.
    if (node.hasAttribute('data-tihoka-split-view')) break;
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    if (hasCoveringSibling(node, parent)) {
      const pr = parent.getBoundingClientRect();
      if (pr.width === 0 || pr.height === 0 || pr.height > maxH || pr.width > maxW) break;
      lifted = parent;
    }
    node = parent;
  }
  return lifted;
}

// Out-of-flow shells (position:absolute|fixed) leave no footprint in the
// page flow — hosts that still reserve the player's slot do it with a
// separate in-flow element (m.youtube's .player-placeholder sits exactly
// under the absolute #player-container-id). Split View's wrapper must take
// THAT slot, not the shell's DOM position: wrapping a body-level absolute
// shell in place lands the wrapper at the page top under fixed chrome and
// pushes the whole feed down. elementsFromPoint below the shell's own
// subtree finds the keeper without any host selector.
export function findFlowSlotKeeper(shell: HTMLElement): HTMLElement | null {
  const rect = shell.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const hits = document.elementsFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  for (const el of hits) {
    if (!(el instanceof HTMLElement)) continue;
    if (el === shell || shell.contains(el) || el.contains(shell)) continue;
    if (el.hasAttribute('data-tihoka-split-view')) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    const wDiff = Math.abs(r.width - rect.width) / rect.width;
    const hDiff = Math.abs(r.height - rect.height) / rect.height;
    if (wDiff <= DEFAULT_DIMENSION_TOLERANCE && hDiff <= DEFAULT_DIMENSION_TOLERANCE) {
      return el;
    }
  }
  return null;
}

function hasCoveringSibling(candidate: HTMLElement, parent: HTMLElement): boolean {
  const rect = candidate.getBoundingClientRect();
  const area = rect.width * rect.height;
  if (area === 0) return false;
  for (const sib of Array.from(parent.children)) {
    if (sib === candidate || !(sib instanceof HTMLElement)) continue;
    if (sib.id.startsWith('Tihoka') || sib.hasAttribute('data-tihoka-split-view')) continue;
    const cs = getComputedStyle(sib);
    if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
    const s = sib.getBoundingClientRect();
    const iw = Math.min(s.right, rect.right) - Math.max(s.left, rect.left);
    const ih = Math.min(s.bottom, rect.bottom) - Math.max(s.top, rect.top);
    if (iw > 0 && ih > 0 && (iw * ih) / area >= OVERLAY_COVER_RATIO) return true;
  }
  return false;
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
import { pickYoutubeOverlayMount, pickYoutubePlayerShell } from '@/shared/lib/dom/youtubePlayer';

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
