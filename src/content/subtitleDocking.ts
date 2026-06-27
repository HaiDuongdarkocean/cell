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

/** Cleanup callbacks for active fixed-panel observers, keyed by panel element. */
const fixedPanelSyncCleanups = new WeakMap<HTMLDivElement, () => void>();

/** Find all ancestors with scrollable overflow (auto/scroll on either axis). */
function getScrollableAncestors(element: HTMLElement): HTMLElement[] {
  const containers: HTMLElement[] = [];
  let parent = element.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    if (
      style.overflow === 'auto' ||
      style.overflow === 'scroll' ||
      style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll'
    ) {
      containers.push(parent);
    }
    parent = parent.parentElement;
  }
  return containers;
}

/**
 * Continuously sync a fixed panel to the video's current bounding box.
 * Triggered by video resize, window resize, scroll on any scrollable ancestor,
 * and fullscreen changes. Throttled by requestAnimationFrame.
 */
function startFixedPanelSync(video: HTMLVideoElement, panel: HTMLDivElement): void {
  stopFixedPanelSync(panel);

  let rafId: number | null = null;
  let pending = false;

  const update = () => {
    if (!pending) return;
    pending = false;
    // Only update if panel is still in fixed mode and attached to DOM.
    if (!document.body.contains(panel)) return;
    if (panel.getAttribute('data-docking-mode') !== 'fixed') return;

    const rect = video.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = PANEL_WIDTH;
    const isFullscreen = !!document.fullscreenElement;
    let left = rect.right;
    let top = rect.top;
    let panelWidth = width;
    let panelHeight = rect.height;

    if (isFullscreen || left + width > viewportWidth) {
      left = Math.max(0, rect.left - width);
    }
    if (isFullscreen || (left === 0 && rect.left <= 0)) {
      left = 0;
      top = Math.max(0, viewportHeight - Math.floor(viewportHeight * 0.3));
      panelWidth = viewportWidth;
      panelHeight = Math.floor(viewportHeight * 0.3);
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.height = `${panelHeight}px`;
  };

  const schedule = () => {
    pending = true;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    }
  };

  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(video);

  const scrollContainers = getScrollableAncestors(video);
  const scrollOptions: AddEventListenerOptions = { passive: true };
  scrollContainers.forEach((container) => {
    container.addEventListener('scroll', schedule, scrollOptions);
  });
  window.addEventListener('scroll', schedule, scrollOptions);
  window.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);

  fixedPanelSyncCleanups.set(panel, () => {
    resizeObserver.disconnect();
    scrollContainers.forEach((container) => {
      container.removeEventListener('scroll', schedule);
    });
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('fullscreenchange', schedule);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });
}

/** Stop syncing a fixed panel and remove all observers/listeners. */
function stopFixedPanelSync(panel: HTMLDivElement): void {
  const cleanup = fixedPanelSyncCleanups.get(panel);
  if (cleanup) {
    cleanup();
    fixedPanelSyncCleanups.delete(panel);
  }
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
  const viewportHeight = window.innerHeight;
  const width = PANEL_WIDTH;

  // In fullscreen the video often fills the viewport, so there is no room beside it.
  // Fallback to a bottom bar that spans the width and uses a fraction of the height.
  const isFullscreen = !!document.fullscreenElement;
  let left = rect.right;
  let top = rect.top;
  let panelWidth = width;
  let panelHeight = rect.height;

  if (isFullscreen || left + width > viewportWidth) {
    left = Math.max(0, rect.left - width);
  }

  // If still no room on the left, or we are in fullscreen with video filling width,
  // dock the panel to the bottom of the viewport.
  if (isFullscreen || (left === 0 && rect.left <= 0)) {
    left = 0;
    top = Math.max(0, viewportHeight - Math.floor(viewportHeight * 0.3));
    panelWidth = viewportWidth;
    panelHeight = Math.floor(viewportHeight * 0.3);
  }

  panel.setAttribute('data-docking-mode', 'fixed');
  panel.style.position = 'fixed';
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = 'auto';
  panel.style.width = `${panelWidth}px`;
  panel.style.height = `${panelHeight}px`;
  panel.style.maxHeight = `${panelHeight}px`;
  panel.style.display = 'flex';
  panel.style.alignSelf = '';

  // ponytail: fixed positioning is set once, but site layout can change (scroll,
  // resize, player transitions) → keep panel pinned beside the video.
  startFixedPanelSync(video, panel);
}

/**
 * Hide panel and restore video to its full container size.
 */
export function hidePanelDocked(
  outerWrapper: HTMLDivElement,
  videoWrapper: HTMLDivElement,
  panel: HTMLDivElement,
): void {
  stopFixedPanelSync(panel);
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
