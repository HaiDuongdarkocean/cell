/**
 * Docking layout manager for subtitle panel + video.
 *
 * Direction C: panel is hidden by default; when user toggles it, the video
 * container shrinks to make room for the panel (beside on desktop, below on mobile).
 * This keeps the panel outside the video so it never covers the content.
 *
 * DOM structure:
 *   outerWrapper (flex container when panel open)
 *     ├── videoWrapper (contains video + overlay + toggle + import + drag hint)
 *     └── panel (subtitle cue list, stretches to outerWrapper height)
 *
 * ponytail: two-wrapper structure keeps video and its controls in one box, and the
 * panel as a sibling — responsive flex/grow works naturally.
 */

export const DESKTOP_BREAKPOINT = 768;
export const PANEL_WIDTH = 280;
export const MOBILE_VIDEO_RATIO = '60%';
export const MOBILE_PANEL_RATIO = '40%';

/** Testid marker for the outer docking wrapper. */
export const DOCKING_WRAPPER_TESTID = 'subtitle-docking-wrapper';
/** Testid marker for the inner video wrapper. */
export const VIDEO_WRAPPER_TESTID = 'subtitle-video-wrapper';

/** Result of wrapping the video for docking. */
export interface DockingWrappers {
  outerWrapper: HTMLDivElement;
  videoWrapper: HTMLDivElement;
}

/**
 * Create the two-wrapper docking structure around the video.
 * - `outerWrapper` is the flex container that will hold the video box + panel.
 * - `videoWrapper` contains the video and all overlay controls.
 */
export function createDockingWrapper(video: HTMLVideoElement): DockingWrappers {
  const outerWrapper = document.createElement('div');
  outerWrapper.setAttribute('data-testid', DOCKING_WRAPPER_TESTID);

  const videoWrapper = document.createElement('div');
  videoWrapper.setAttribute('data-testid', VIDEO_WRAPPER_TESTID);

  const parent = video.parentElement;
  if (parent) {
    parent.insertBefore(outerWrapper, video);
    outerWrapper.appendChild(videoWrapper);
    videoWrapper.appendChild(video);
  }

  return { outerWrapper, videoWrapper };
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
 * Desktop: video wrapper 70% width, panel 280px on the right.
 * Mobile: video wrapper 60% height, panel 40% height below.
 *
 * ponytail: fallback to fixed positioning when the video is out-of-flow
 * (e.g. art-player uses absolute positioning) — flex shrink would not move the panel
 * beside the video and would overlap instead.
 */
export function showPanelDocked(
  outerWrapper: HTMLDivElement,
  videoWrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
): void {
  if (isOutOfFlowVideo(video)) {
    showFixedPanel(video, panel);
    return;
  }

  const mobile = isMobileViewport();
  panel.setAttribute('data-docking-mode', 'flex');

  outerWrapper.style.display = 'flex';
  outerWrapper.style.flexDirection = mobile ? 'column' : 'row';
  outerWrapper.style.width = '100%';
  outerWrapper.style.height = '100%';
  outerWrapper.style.alignItems = 'stretch';

  videoWrapper.style.position = 'relative';
  videoWrapper.style.flex = mobile ? `0 0 ${MOBILE_VIDEO_RATIO}` : '1 1 70%';
  videoWrapper.style.width = mobile ? '100%' : 'auto';
  videoWrapper.style.height = mobile ? MOBILE_VIDEO_RATIO : 'auto';
  videoWrapper.style.minWidth = '0';
  videoWrapper.style.minHeight = '0';
  videoWrapper.style.overflow = 'hidden';

  video.style.width = '100%';
  video.style.height = 'auto';
  video.style.maxHeight = '100%';
  video.style.minWidth = '0';
  video.style.minHeight = '0';

  panel.style.position = 'relative';
  panel.style.right = 'auto';
  panel.style.top = 'auto';
  panel.style.left = 'auto';
  panel.style.flex = mobile ? `0 0 ${MOBILE_PANEL_RATIO}` : '0 0 auto';
  panel.style.width = mobile ? '100%' : `${PANEL_WIDTH}px`;
  panel.style.height = mobile ? MOBILE_PANEL_RATIO : 'auto';
  panel.style.maxHeight = '100%';
  panel.style.display = 'flex';
  panel.style.alignSelf = 'stretch';
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
  panel.style.alignSelf = '';
}

/**
 * Hide panel and restore video to its full container size.
 */
export function hidePanelDocked(
  outerWrapper: HTMLDivElement,
  videoWrapper: HTMLDivElement,
  panel: HTMLDivElement,
): void {
  panel.removeAttribute('data-docking-mode');

  outerWrapper.style.display = 'block';
  outerWrapper.style.flexDirection = '';
  outerWrapper.style.alignItems = '';

  videoWrapper.style.position = '';
  videoWrapper.style.flex = '';
  videoWrapper.style.width = '100%';
  videoWrapper.style.height = 'auto';
  videoWrapper.style.minWidth = '';
  videoWrapper.style.minHeight = '';
  videoWrapper.style.overflow = '';

  panel.style.position = 'absolute';
  panel.style.right = '0px';
  panel.style.top = '0px';
  panel.style.left = '';
  panel.style.flex = '';
  panel.style.width = `${PANEL_WIDTH}px`;
  panel.style.height = 'auto';
  panel.style.maxHeight = '100%';
  panel.style.display = 'none';
  panel.style.alignSelf = '';
}

/**
 * Move an existing UI element into the video wrapper.
 * Useful for elements that were created before the two-wrapper structure existed.
 */
export function moveElementIntoWrapper(element: HTMLElement, wrapper: HTMLElement): void {
  if (element.parentElement !== wrapper) {
    wrapper.appendChild(element);
  }
}

/**
 * Move the panel from the video wrapper into the outer wrapper so it becomes a
 * sibling of the video box (required for flex layout).
 */
export function movePanelToOuterWrapper(panel: HTMLDivElement, outerWrapper: HTMLDivElement): void {
  if (panel.parentElement !== outerWrapper) {
    outerWrapper.appendChild(panel);
  }
}
