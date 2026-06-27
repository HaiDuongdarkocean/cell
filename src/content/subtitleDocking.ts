/**
 * Docking layout manager for subtitle panel + video.
 *
 * Direction C: panel is hidden by default; when user toggles it, the video
 * shrinks to make room for the panel inside the same parent container.
 * Desktop: panel on the right, fixed width 280px; video takes the rest.
 * Mobile: panel below the video, video 60% height, panel 40% height.
 *
 * This keeps the panel outside the video and ensures the combined panel + video
 * never overflows the parent container.
 *
 * DOM structure:
 *   outerWrapper (flex or absolute container when panel open)
 *     ├── videoWrapper (contains video + overlay + toggle + import + drag hint)
 *     └── panel (subtitle cue list, stretches to outerWrapper height)
 *
 * ponytail: two-wrapper structure keeps video and its controls in one box, and the
 * panel as a sibling. For out-of-flow players (e.g. art-player absolute video),
 * the outer wrapper is absolute to fill the nearest positioned ancestor so the
 * panel can be placed inside the same box without overflowing it.
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
 * - `outerWrapper` is the container that will hold the video box + panel.
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
 * Mutation observers that re-apply our required video styles when the site's player
 * overwrites them. Keyed by video element.
 */
const videoStyleObservers = new WeakMap<HTMLVideoElement, MutationObserver>();

/** Watch the video's style attribute and re-apply the required absolute-docked styles. */
function startVideoStyleGuard(
  video: HTMLVideoElement,
  applyStyles: () => void,
): void {
  stopVideoStyleGuard(video);

  const observer = new MutationObserver(() => {
    applyStyles();
  });
  observer.observe(video, { attributes: true, attributeFilter: ['style'] });
  videoStyleObservers.set(video, observer);
}

/** Stop guarding the video's style attribute. */
function stopVideoStyleGuard(video: HTMLVideoElement): void {
  const observer = videoStyleObservers.get(video);
  if (observer) {
    observer.disconnect();
    videoStyleObservers.delete(video);
  }
}

/**
 * Show panel in docked layout: shrink video to make room inside the parent.
 *
 * In-flow video: flex layout. Video wrapper takes `calc(100% - 280px)`, panel is
 * `280px`. Both stay inside `outerWrapper` which is the same width as the parent.
 *
 * Out-of-flow video (e.g. art-player absolute): absolute-docked layout. The
 * `outerWrapper` fills the nearest positioned ancestor (the video's player box),
 * video is resized to `calc(100% - 280px)` of that box, and panel occupies the
 * right 280px. No overflow, no fixed viewport pinning.
 */
export function showPanelDocked(
  outerWrapper: HTMLDivElement,
  videoWrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
): void {
  const mobile = isMobileViewport();
  const outOfFlow = isOutOfFlowVideo(video);
  panel.setAttribute('data-docking-mode', outOfFlow ? 'absolute-docked' : 'flex');

  // Reset any previous layout state.
  outerWrapper.style.position = outOfFlow ? 'absolute' : 'relative';
  outerWrapper.style.display = 'flex';
  outerWrapper.style.flexDirection = mobile ? 'column' : 'row';
  outerWrapper.style.width = '100%';
  outerWrapper.style.height = '100%';
  outerWrapper.style.top = '0';
  outerWrapper.style.left = '0';
  outerWrapper.style.alignItems = 'stretch';

  if (outOfFlow) {
    applyAbsoluteDockedLayout(videoWrapper, video, panel, mobile);
  } else {
    applyFlexLayout(videoWrapper, video, panel, mobile);
  }
}

/** Flex layout for normal-flow video. */
function applyFlexLayout(
  videoWrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
  mobile: boolean,
): void {
  videoWrapper.style.position = 'relative';
  videoWrapper.style.flex = mobile ? `0 0 ${MOBILE_VIDEO_RATIO}` : '1 1 auto';
  videoWrapper.style.width = mobile ? '100%' : `calc(100% - ${PANEL_WIDTH}px)`;
  videoWrapper.style.height = mobile ? MOBILE_VIDEO_RATIO : '100%';
  videoWrapper.style.minWidth = '0';
  videoWrapper.style.minHeight = '0';
  videoWrapper.style.overflow = 'hidden';

  video.style.width = '100%';
  video.style.height = mobile ? '100%' : 'auto';
  video.style.maxHeight = '100%';
  video.style.minWidth = '0';
  video.style.minHeight = '0';

  panel.style.position = 'relative';
  panel.style.right = 'auto';
  panel.style.top = 'auto';
  panel.style.left = 'auto';
  panel.style.bottom = 'auto';
  panel.style.flex = mobile ? `0 0 ${MOBILE_PANEL_RATIO}` : '0 0 auto';
  panel.style.width = mobile ? '100%' : `${PANEL_WIDTH}px`;
  panel.style.height = mobile ? MOBILE_PANEL_RATIO : 'auto';
  panel.style.maxHeight = '100%';
  panel.style.display = 'flex';
  panel.style.alignSelf = 'stretch';
}

/** Absolute-docked layout for out-of-flow players (e.g. art-player). */
function applyAbsoluteDockedLayout(
  videoWrapper: HTMLDivElement,
  video: HTMLVideoElement,
  panel: HTMLDivElement,
  mobile: boolean,
): void {
  videoWrapper.style.position = 'static';
  videoWrapper.style.flex = mobile ? `0 0 ${MOBILE_VIDEO_RATIO}` : '1 1 auto';
  videoWrapper.style.width = mobile ? '100%' : `calc(100% - ${PANEL_WIDTH}px)`;
  videoWrapper.style.height = mobile ? MOBILE_VIDEO_RATIO : '100%';
  videoWrapper.style.minWidth = '0';
  videoWrapper.style.minHeight = '0';
  videoWrapper.style.overflow = 'hidden';

  // Use !important because the site's player (e.g. art-player) repeatedly sets
  // its own inline styles for the video. Without !important our resize is lost.
  const applyVideoStyles = () => {
    const observer = videoStyleObservers.get(video);
    observer?.disconnect();

    if (mobile) {
      video.style.setProperty('position', 'absolute', 'important');
      video.style.setProperty('left', '0', 'important');
      video.style.setProperty('top', '0', 'important');
      video.style.setProperty('right', 'auto', 'important');
      video.style.setProperty('bottom', 'auto', 'important');
      video.style.setProperty('width', '100%', 'important');
      video.style.setProperty('height', MOBILE_VIDEO_RATIO, 'important');
    } else {
      video.style.setProperty('position', 'absolute', 'important');
      video.style.setProperty('left', '0', 'important');
      video.style.setProperty('top', '0', 'important');
      video.style.setProperty('right', 'auto', 'important');
      video.style.setProperty('bottom', 'auto', 'important');
      video.style.setProperty('width', `calc(100% - ${PANEL_WIDTH}px)`, 'important');
      video.style.setProperty('height', '100%', 'important');
    }
    video.style.setProperty('max-width', 'none', 'important');
    video.style.setProperty('max-height', 'none', 'important');
    video.style.setProperty('min-width', '0', 'important');
    video.style.setProperty('min-height', '0', 'important');

    observer?.observe(video, { attributes: true, attributeFilter: ['style'] });
  };

  applyVideoStyles();
  startVideoStyleGuard(video, applyVideoStyles);

  if (mobile) {
    panel.style.position = 'absolute';
    panel.style.left = '0';
    panel.style.right = 'auto';
    panel.style.top = 'auto';
    panel.style.bottom = '0';
    panel.style.width = '100%';
    panel.style.height = MOBILE_PANEL_RATIO;
    panel.style.maxHeight = 'none';
    panel.style.flex = '0 0 auto';
    panel.style.display = 'flex';
    panel.style.alignSelf = '';
  } else {
    panel.style.position = 'absolute';
    panel.style.left = 'auto';
    panel.style.right = '0';
    panel.style.top = '0';
    panel.style.bottom = '0';
    panel.style.width = `${PANEL_WIDTH}px`;
    panel.style.height = 'auto';
    panel.style.maxHeight = 'none';
    panel.style.flex = '0 0 auto';
    panel.style.display = 'flex';
    panel.style.alignSelf = '';
  }
}

/**
 * Hide panel and restore video to its full container size.
 */
export function hidePanelDocked(
  outerWrapper: HTMLDivElement,
  videoWrapper: HTMLDivElement,
  panel: HTMLDivElement,
): void {
  const video = videoWrapper.querySelector('video');
  if (video) {
    stopVideoStyleGuard(video);
  }
  panel.removeAttribute('data-docking-mode');

  outerWrapper.style.display = 'block';
  outerWrapper.style.position = 'static';
  outerWrapper.style.flexDirection = '';
  outerWrapper.style.alignItems = '';
  outerWrapper.style.top = '';
  outerWrapper.style.left = '';

  videoWrapper.style.position = '';
  videoWrapper.style.flex = '';
  videoWrapper.style.width = '100%';
  videoWrapper.style.height = 'auto';
  videoWrapper.style.minWidth = '';
  videoWrapper.style.minHeight = '';
  videoWrapper.style.overflow = '';

  // Restore video to fill its original container. We only clear the inline styles
  // we set; the site's player CSS (or inline styles) will take over again.
  if (video) {
    video.style.removeProperty('position');
    video.style.removeProperty('left');
    video.style.removeProperty('top');
    video.style.removeProperty('right');
    video.style.removeProperty('bottom');
    video.style.removeProperty('width');
    video.style.removeProperty('height');
    video.style.removeProperty('max-width');
    video.style.removeProperty('max-height');
    video.style.removeProperty('min-width');
    video.style.removeProperty('min-height');
  }

  panel.style.position = 'absolute';
  panel.style.right = '0px';
  panel.style.top = '0px';
  panel.style.left = '';
  panel.style.bottom = '';
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
