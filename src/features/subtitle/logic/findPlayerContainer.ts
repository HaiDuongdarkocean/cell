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
  const moviePlayer = document.querySelector('#movie_player');
  if (moviePlayer instanceof HTMLElement && moviePlayer.contains(video)) {
    return moviePlayer;
  }

  const baseRect = video.getBoundingClientRect();
  const vw = Math.round(baseRect.width);
  const vh = Math.round(baseRect.height);

  let farthest: HTMLElement = video;
  let el: HTMLElement | null = video.parentElement;

  while (el && el !== document.body) {
    // Skip Cell's own Split View elements (wrapper/stage/handle/panel) —
    // they're ancestors of the video after a normal→fullscreen→normal
    // transition but are NOT the real player shell. Walking through them
    // would return the old wrapper as playerShell, breaking the next run.
    if (el.hasAttribute('data-cell-split-view')) {
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

/** Find the largest <video> with a non-zero bounding rect.
 *
 * Does NOT require readyState ≥ 1 — CDN-slow pages (e.g. themoviebox) can
 * have readyState=0 for seconds while the video element is already visually
 * present. Filtering by readyState would make findPlayerContainer return
 * null, breaking Player Mode entry until metadata loads. */
export function findLargestPlayableVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video')).filter((v) => {
    const rect = v.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (videos.length === 0) return null;

  videos.sort((a, b) => {
    // Prefer videos with loaded metadata (videoWidth > 0) — they're the real
    // playable target. Fall back to bounding-rect area when no video has
    // loaded yet (CDN still fetching) so we pick the visually largest one.
    const aMeta = a.videoWidth * a.videoHeight;
    const bMeta = b.videoWidth * b.videoHeight;
    if (aMeta > 0 || bMeta > 0) return bMeta - aMeta;
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    return (bRect.width * bRect.height) - (aRect.width * aRect.height);
  });

  return videos[0] ?? null;
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
 * Falls back to `video.parentElement` (or `document.body`) if no suitable ancestor.
 *
 * This is the SSOT container-finding algorithm for subtitle overlay + OCR region
 * selector — both must attach to the SAME container so the region rect aligns
 * with the subtitle block's coordinate space.
 */
export function findVideoContainer(video: HTMLVideoElement): HTMLElement {
  const videoHeight = video.getBoundingClientRect().height;
  let el: HTMLElement | null = video.parentElement;
  while (el && el !== document.body) {
    const h = el.getBoundingClientRect().height;
    if (videoHeight > 0 && h >= videoHeight * 0.5) return el;
    el = el.parentElement;
  }
  return video.parentElement ?? document.body;
}
