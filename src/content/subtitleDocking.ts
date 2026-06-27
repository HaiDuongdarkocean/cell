/**
 * Docking layout manager for subtitle panel + toggle + video.
 *
 * Direction C: panel is hidden by default; when user toggles it, the video
 * container shrinks to make room for the panel (beside on desktop, below on mobile).
 * This keeps the panel outside the video so it never covers the content.
 *
 * ponytail: minimal DOM manipulation — wrap once, reuse for show/hide, no unwrap.
 */

export const DESKTOP_BREAKPOINT = 768;
export const PANEL_WIDTH = 280;
export const MOBILE_VIDEO_RATIO = '60%';
export const MOBILE_PANEL_RATIO = '40%';
export const DESKTOP_VIDEO_FLEX = '1 1 70%';
export const DESKTOP_PANEL_FLEX = `0 0 ${PANEL_WIDTH}px`;

/** Testid marker for the docking wrapper. */
export const DOCKING_WRAPPER_TESTID = 'subtitle-docking-wrapper';

/**
 * Create a wrapper div around the video and move the video inside it.
 * The wrapper becomes the common parent for all subtitle UI elements.
 */
export function createDockingWrapper(video: HTMLVideoElement): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-testid', DOCKING_WRAPPER_TESTID);
  const parent = video.parentElement;
  if (parent) {
    parent.insertBefore(wrapper, video);
    wrapper.appendChild(video);
  }
  return wrapper;
}

/** Detect mobile/narrow viewport based on window width. */
export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= DESKTOP_BREAKPOINT;
}

/** Detect whether the video is taken out of normal document flow (absolute/fixed). */
function isOutOfFlowVideo(video: HTMLVideoElement): boolean {
  const position = getComputedStyle(video).position;
  return position === 'absolute' || position === 'fixed';
}

/**
 * Show panel in docked layout: shrink video to make room.
 * Desktop: video 70% width, panel 280px on the right.
 * Mobile: video 60% height, panel 40% height below.
 *
 * ponytail: fallback to fixed positioning when the video is out-of-flow
 * (e.g. art-player uses absolute positioning) — flex shrink would not move the panel
 * beside the video and would overlap instead.
 */
export function showPanelDocked(
  wrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
): void {
  if (isOutOfFlowVideo(video)) {
    showFixedPanel(video, panel);
    return;
  }

  const mobile = isMobileViewport();
  panel.setAttribute('data-docking-mode', 'flex');

  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = mobile ? 'column' : 'row';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.alignItems = 'stretch';

  video.style.flex = '0 0 auto';
  video.style.width = mobile ? '100%' : '70%';
  video.style.height = mobile ? '60%' : 'auto';
  video.style.maxWidth = mobile ? '100%' : '70%';
  video.style.maxHeight = mobile ? '60%' : '100%';
  video.style.minWidth = '0';
  video.style.minHeight = '0';

  panel.style.position = 'relative';
  panel.style.right = 'auto';
  panel.style.top = 'auto';
  panel.style.left = 'auto';
  panel.style.flex = '0 0 auto';
  panel.style.width = mobile ? '100%' : `${PANEL_WIDTH}px`;
  panel.style.height = mobile ? '40%' : '100%';
  panel.style.maxHeight = mobile ? '40%' : '100%';
  panel.style.display = 'flex';
}

/** Place panel fixed beside the video for out-of-flow players. */
function showFixedPanel(video: HTMLVideoElement, panel: HTMLDivElement): void {
  const rect = video.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const width = PANEL_WIDTH;
  // Prefer right side of video; if it overflows viewport, place on the left.
  let left = rect.right;
  if (left + width > viewportWidth) {
    left = Math.max(0, rect.left - width);
  }

  panel.setAttribute('data-docking-mode', 'fixed');
  panel.style.position = 'fixed';
  panel.style.left = `${left}px`;
  panel.style.top = `${rect.top}px`;
  panel.style.right = 'auto';
  panel.style.width = `${width}px`;
  panel.style.height = `${rect.height}px`;
  panel.style.maxHeight = `${rect.height}px`;
  panel.style.display = 'flex';
}

/**
 * Hide panel and restore video to its full container size.
 */
export function hidePanelDocked(
  wrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
): void {
  panel.removeAttribute('data-docking-mode');

  wrapper.style.display = 'block';
  wrapper.style.flexDirection = '';
  wrapper.style.alignItems = '';

  video.style.flex = '';
  video.style.width = '100%';
  video.style.height = 'auto';
  video.style.maxWidth = '';
  video.style.maxHeight = '';
  video.style.minWidth = '';
  video.style.minHeight = '';

  panel.style.position = 'absolute';
  panel.style.right = '0px';
  panel.style.top = '0px';
  panel.style.left = '';
  panel.style.flex = '';
  panel.style.width = `${PANEL_WIDTH}px`;
  panel.style.height = 'auto';
  panel.style.maxHeight = '100%';
  panel.style.display = 'none';
}

/**
 * Move an existing UI element into the docking wrapper.
 * Useful for elements that were created before the wrapper existed.
 */
export function moveElementIntoWrapper(element: HTMLElement, wrapper: HTMLElement): void {
  if (element.parentElement !== wrapper) {
    wrapper.appendChild(element);
  }
}
