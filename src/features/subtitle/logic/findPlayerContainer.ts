// Player container discovery — pure DOM-read algorithm (no side effects).
//
// Finds the host player element that should be moved into Player Mode's
// video stage. Runs in any document (main page or iframe) because the
// extension content script is declared with all_frames=true. The algorithm
// starts at the largest playable <video> and walks up to the farthest
// ancestor whose bounding area is within tolerance of the video.
//
// Algorithmic complexity: O(d) where d = DOM depth from video to body.

const DEFAULT_SIZE_TOLERANCE = 0.15;

/**
 * Find the best player container to move into Player Mode's video stage.
 *
 * @param tolerance - Relative area tolerance for the same-size walk-up
 *   (default 0.15 = 15%).
 * @returns The player container element, or null if no playable video found.
 */
export function findPlayerContainer(
  tolerance: number = DEFAULT_SIZE_TOLERANCE,
): HTMLElement | null {
  const video = findLargestPlayableVideo();
  if (!video) return null;
  return findFarthestSameSizeContainer(video, tolerance);
}

/**
 * Walk up from a <video> element to the farthest player ancestor.
 *
 * Normal ancestors must stay within `tolerance` of the previous stable
 * container. Some players put the video in an aspect-ratio wrapper while the
 * controls live on a wider shell; that shell is accepted when its area remains
 * within a safe 0.5–1.5 ratio of the video and it owns interactive controls.
 * The walk continues after rejected wrappers so the farthest valid player shell
 * can still be found. This is the shared container algorithm for Player Mode
 * and Split View.
 */
export function findFarthestSameSizeContainer(
  video: HTMLVideoElement,
  tolerance: number = DEFAULT_SIZE_TOLERANCE,
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
  const baseArea = baseRect.width * baseRect.height;

  let farthest: HTMLElement = video;
  let referenceArea = baseArea;
  let el: HTMLElement | null = video.parentElement;
  const MIN_PLAYER_AREA_RATIO = 0.5;
  const MAX_PLAYER_AREA_RATIO = 1.5;

  while (el && el !== document.body) {
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;

    if (area === 0) {
      el = el.parentElement;
      continue;
    }

    const diff = Math.abs(area - referenceArea) / referenceArea;
    const ratioToVideo = area / baseArea;
    const hasControls = Boolean(el.querySelector(
      'button, [role="button"], input[type="range"], video[controls]',
    ));
    const isControlShell = hasControls
      && ratioToVideo >= MIN_PLAYER_AREA_RATIO
      && ratioToVideo <= MAX_PLAYER_AREA_RATIO;

    if (diff <= tolerance || isControlShell) {
      farthest = el;
      referenceArea = area;
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
