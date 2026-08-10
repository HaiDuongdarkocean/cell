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

/** Find the largest <video> that has loaded data and a non-zero size. */
export function findLargestPlayableVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video')).filter((v) => {
    if (v.videoWidth <= 0 || v.readyState < 1) return false;
    const rect = v.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (videos.length === 0) return null;

  videos.sort((a, b) => {
    const aArea = a.videoWidth * a.videoHeight;
    const bArea = b.videoWidth * b.videoHeight;
    return bArea - aArea;
  });

  return videos[0] ?? null;
}
