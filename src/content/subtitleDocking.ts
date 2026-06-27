/**
 * Docking layout manager for subtitle panel + video.
 *
 * Simplified approach: the video is NEVER moved out of its player container.
 * We find the player's layout box (F0) and the child branch that holds the
 * player (playerContainer). The panel is inserted as a sibling of
 * playerContainer inside F0. When the panel opens, F0 becomes a flex row
 * (or column on mobile): playerContainer shrinks to 70% (desktop) / 60%
 * (mobile), panel takes the remaining 30% / 40%.
 *
 * This preserves the site's player DOM hierarchy (e.g. art-player controls
 * stay above the video via their own z-index), so no z-index / pointer-events
 * hacks are needed.
 *
 * DOM structure (unchanged from the site):
 *   F0 (layout box, e.g. div.w-[75%])
 *     ├── playerContainer (e.g. .artplayer-app → .art-video-player → video + controls)
 *     └── panel (subtitle cue list, inserted by us)
 */

export const DESKTOP_BREAKPOINT = 768;
export const DESKTOP_VIDEO_RATIO = '70%';
export const DESKTOP_PANEL_RATIO = '30%';
export const MOBILE_VIDEO_RATIO = '60%';
export const MOBILE_PANEL_RATIO = '40%';

/** Testid marker for the outer docking wrapper. */
export const DOCKING_WRAPPER_TESTID = 'subtitle-docking-wrapper';
/** Testid marker for the inner video wrapper. */
export const VIDEO_WRAPPER_TESTID = 'subtitle-video-wrapper';

/** Docking context: the layout box (F0) and the player branch inside it. */
export interface DockingContext {
  /** F0 — the farthest ancestor whose width matches the video's width. */
  f0: HTMLElement;
  /** The direct child of F0 that contains the video (e.g. .artplayer-app). */
  playerContainer: HTMLElement;
}

/**
 * Find the video's real layout box (F0).
 *
 * Walks up from the video and returns the *farthest* ancestor whose rendered
 * width matches the video's rendered width (within sub-pixel tolerance). The
 * first ancestor that no longer matches the video's width marks the boundary
 * of the video box, so the last width-matching ancestor is the real layout
 * container.
 */
function findVideoLayoutBox(video: HTMLVideoElement): HTMLElement | null {
  const videoRect = video.getBoundingClientRect();
  const WIDTH_TOLERANCE = 1;
  let f0: HTMLElement | null = null;
  let current: HTMLElement | null = video;

  while (current && current.parentElement) {
    const parent: HTMLElement = current.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const widthMatches = Math.abs(parentRect.width - videoRect.width) < WIDTH_TOLERANCE;

    if (!widthMatches) {
      break;
    }

    f0 = parent;
    current = parent;
  }

  return f0;
}

/**
 * Find the child branch of F0 that contains the video.
 * This is the element we will shrink when the panel opens.
 */
function findVideoBranch(f0: HTMLElement, video: HTMLVideoElement): HTMLElement | null {
  let current: HTMLElement = video;
  while (current.parentElement && current.parentElement !== f0) {
    current = current.parentElement;
  }
  return current.parentElement === f0 ? current : null;
}

/**
 * Set up docking: find F0 and playerContainer. The video is NOT moved.
 * Returns the layout box (f0) and the player branch (playerContainer) so the
 * caller can insert the panel as a sibling of playerContainer inside f0.
 */
export function setupDocking(video: HTMLVideoElement): DockingContext {
  const f0 = findVideoLayoutBox(video);
  const playerContainer = f0 ? findVideoBranch(f0, video) : null;

  if (f0 && playerContainer) {
    return { f0, playerContainer };
  }

  // Fallback: use video's immediate parent as both f0 and playerContainer.
  const fallback = video.parentElement ?? document.body;
  return { f0: fallback, playerContainer: fallback };
}

/** Detect mobile/narrow viewport based on window width. */
export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= DESKTOP_BREAKPOINT;
}

/**
 * Show panel in docked layout: shrink playerContainer to make room for panel.
 * F0 becomes a flex container; playerContainer takes the video ratio, panel
 * takes the panel ratio.
 */
export function showPanelDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
): void {
  const mobile = isMobileViewport();
  panel.setAttribute('data-docking-mode', 'flex');

  f0.style.display = 'flex';
  f0.style.flexDirection = mobile ? 'column' : 'row';
  f0.style.alignItems = 'stretch';
  f0.style.boxSizing = 'border-box';

  playerContainer.style.flex = mobile
    ? `0 0 ${MOBILE_VIDEO_RATIO}`
    : `0 0 ${DESKTOP_VIDEO_RATIO}`;
  playerContainer.style.minWidth = '0';
  playerContainer.style.minHeight = '0';
  playerContainer.style.boxSizing = 'border-box';

  // Panel becomes a flex sibling filling the remaining space.
  // min-width: 0 is required because the default min-width: auto prevents
  // the panel from shrinking below its content width, causing the panel + video
  // to overflow F0.
  panel.style.position = 'relative';
  panel.style.right = 'auto';
  panel.style.top = 'auto';
  panel.style.left = 'auto';
  panel.style.bottom = 'auto';
  panel.style.flex = mobile ? `0 0 ${MOBILE_PANEL_RATIO}` : `0 0 ${DESKTOP_PANEL_RATIO}`;
  panel.style.width = mobile ? '100%' : 'auto';
  panel.style.height = mobile ? MOBILE_PANEL_RATIO : 'auto';
  panel.style.maxHeight = 'none';
  panel.style.minWidth = '0';
  panel.style.overflow = 'hidden';
  panel.style.boxSizing = 'border-box';
  panel.style.display = 'flex';
  panel.style.alignSelf = 'stretch';
}

/**
 * Hide panel and restore playerContainer to its full size.
 */
export function hidePanelDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
): void {
  panel.removeAttribute('data-docking-mode');

  f0.style.display = '';
  f0.style.flexDirection = '';
  f0.style.alignItems = '';
  f0.style.boxSizing = '';

  playerContainer.style.flex = '';
  playerContainer.style.minWidth = '';
  playerContainer.style.minHeight = '';
  playerContainer.style.boxSizing = '';

  // Restore panel to its hidden floating state.
  panel.style.position = 'absolute';
  panel.style.right = '0px';
  panel.style.top = '0px';
  panel.style.left = '';
  panel.style.bottom = '';
  panel.style.flex = '';
  panel.style.width = '280px';
  panel.style.height = 'auto';
  panel.style.maxHeight = '100%';
  panel.style.minWidth = '';
  panel.style.overflow = '';
  panel.style.boxSizing = '';
  panel.style.display = 'none';
  panel.style.alignSelf = '';
}

/**
 * Move the panel into F0 so it becomes a sibling of playerContainer.
 * Required for flex layout to place the panel beside the video.
 */
export function movePanelToOuterWrapper(panel: HTMLDivElement, f0: HTMLElement): void {
  if (panel.parentElement !== f0) {
    f0.appendChild(panel);
  }
}
