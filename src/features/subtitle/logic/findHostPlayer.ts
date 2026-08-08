// Find the host player element that wraps the video + controls and has
// fullscreen capability. Used by Player Mode to wrap the host player into
// the overlay's video stage (instead of moving just the <video> element).
//
// Strategy: start at video.parentElement, walk up to find the first ancestor
// whose height >= 50% of the video height (findVideoContainer logic), then
// continue walking up to find an element that contains a fullscreen button.
// Falls back to the video container if no fullscreen-capable ancestor is found.

/** Common fullscreen button selectors across player libraries. */
const FULLSCREEN_BTN_SELECTORS = [
  '.art-control-fullscreen',           // art-player
  '.ytp-fullscreen-button',            // YouTube
  '.bilibili-player-video-btn-fullscreen', // Bilibili
  '.vjs-fullscreen-control',           // video.js
  '.jw-icon-fullscreen',               // JW Player
  '.fp-fullscreen',                    // flowplayer
  '.vjs-button-fullscreen',            // video.js variant
  '.shaka-fullscreen-button',          // Shaka Player
  '.plyr__control--fullscreen',        // Plyr
  '.video-js .vjs-fullscreen-control', // video.js
] as const;

/** Check if an element contains a fullscreen button (by selector or aria-label). */
function hasFullscreenButton(el: HTMLElement): boolean {
  for (const sel of FULLSCREEN_BTN_SELECTORS) {
    if (el.querySelector(sel)) return true;
  }
  // Generic: check for buttons with "fullscreen" in aria-label or title
  const btns = el.querySelectorAll('button, [role="button"], [class*="fullscreen"]');
  for (const btn of Array.from(btns)) {
    const label = (btn.getAttribute('aria-label') ?? '') + ' ' + (btn.getAttribute('title') ?? '');
    if (/fullscreen|full\s*screen/i.test(label)) return true;
  }
  return false;
}

/**
 * Find the video container — first ancestor whose height >= 50% of video height.
 * Handles YouTube's `.html5-video-container` (height:0) pattern.
 */
function findVideoContainer(video: HTMLVideoElement): HTMLElement {
  const videoHeight = video.getBoundingClientRect().height;
  let el: HTMLElement | null = video.parentElement;
  while (el && el !== document.body) {
    const h = el.getBoundingClientRect().height;
    if (videoHeight > 0 && h >= videoHeight * 0.5) return el;
    el = el.parentElement;
  }
  return video.parentElement ?? document.body;
}

/**
 * Find the host player element that contains the video + controls and has
 * fullscreen capability. Walks up from the video container to find the
 * first ancestor with a fullscreen button.
 *
 * Returns the fullscreen-capable ancestor, or the video container as fallback.
 * Never returns document.body (moving body into Player Mode would break the page).
 */
export function findHostPlayer(video: HTMLVideoElement): HTMLElement {
  const container = findVideoContainer(video);
  // Walk up from the container to find a fullscreen-capable ancestor
  let el: HTMLElement | null = container;
  while (el && el !== document.body) {
    if (hasFullscreenButton(el)) return el;
    el = el.parentElement;
  }
  // Fallback: the video container itself
  return container;
}
