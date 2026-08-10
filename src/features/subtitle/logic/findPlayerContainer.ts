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
 * Walk up from a <video> element to the farthest ancestor whose bounding area
 * is within `tolerance` of the video's area.
 *
 * Skips zero-area ancestors (e.g. YouTube's .html5-video-container placeholder)
 * and stops as soon as the area changes beyond the tolerance.
 */
export function findFarthestSameSizeContainer(
  video: HTMLVideoElement,
  tolerance: number = DEFAULT_SIZE_TOLERANCE,
): HTMLElement {
  const baseRect = video.getBoundingClientRect();
  const baseArea = baseRect.width * baseRect.height;

  let farthest: HTMLElement = video;
  let el: HTMLElement | null = video.parentElement;

  while (el && el !== document.body) {
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;

    if (area === 0) {
      el = el.parentElement;
      continue;
    }

    const diff = Math.abs(area - baseArea) / baseArea;

    if (diff <= tolerance) {
      farthest = el;
      el = el.parentElement;
    } else {
      break;
    }
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
