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
export const FULLSCREEN_VIDEO_RATIO = '70%';
export const FULLSCREEN_PANEL_RATIO = '30%';

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

  // Preserve F0's natural height so the video does not shrink vertically when
  // playerContainer width is reduced. Without this, the site's aspect-ratio
  // CSS on the player would force the height to shrink proportionally with
  // the width, making the video smaller in both dimensions.
  f0.style.height = `${f0.getBoundingClientRect().height}px`;

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
  // Fill the preserved F0 height instead of letting aspect-ratio decide.
  playerContainer.style.height = mobile ? MOBILE_VIDEO_RATIO : '100%';
  playerContainer.style.setProperty('aspect-ratio', 'auto', 'important');

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
  panel.style.height = mobile ? MOBILE_PANEL_RATIO : '100%';
  panel.style.maxHeight = 'none';
  panel.style.minWidth = '0';
  panel.style.minHeight = '0';
  panel.style.overflow = 'hidden';
  panel.style.boxSizing = 'border-box';
  panel.style.display = 'flex';
  panel.style.alignSelf = 'stretch';

  // The panel body has a 400px max-height for the floating panel. When docked
  // it should fill the full panel height so the subtitle list extends to the
  // bottom of the video.
  const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
  if (panelBody) {
    panelBody.style.maxHeight = 'none';
  }
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
  f0.style.height = '';

  playerContainer.style.flex = '';
  playerContainer.style.minWidth = '';
  playerContainer.style.minHeight = '';
  playerContainer.style.boxSizing = '';
  playerContainer.style.height = '';
  playerContainer.style.removeProperty('aspect-ratio');

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
  panel.style.minHeight = '';
  panel.style.overflow = '';
  panel.style.boxSizing = '';
  panel.style.display = 'none';
  panel.style.alignSelf = '';

  // Restore the floating panel body's max-height limit.
  const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
  if (panelBody) {
    panelBody.style.maxHeight = '400px';
  }
}

/**
 * Apply docked 70/30 layout when F0 is the fullscreen element.
 * In fullscreen the viewport is always wide, so we always use horizontal split.
 */
export function enterFullscreenDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
): void {
  // Ensure panel is a sibling of playerContainer inside F0.
  movePanelToOuterWrapper(panel, f0);
  panel.setAttribute('data-docking-mode', 'flex');

  f0.style.display = 'flex';
  f0.style.flexDirection = 'row';
  f0.style.alignItems = 'stretch';
  f0.style.boxSizing = 'border-box';
  f0.style.height = '100%';

  playerContainer.style.flex = `0 0 ${FULLSCREEN_VIDEO_RATIO}`;
  playerContainer.style.minWidth = '0';
  playerContainer.style.minHeight = '0';
  playerContainer.style.boxSizing = 'border-box';
  playerContainer.style.height = '100%';
  playerContainer.style.setProperty('aspect-ratio', 'auto', 'important');

  panel.style.position = 'relative';
  panel.style.right = 'auto';
  panel.style.top = 'auto';
  panel.style.left = 'auto';
  panel.style.bottom = 'auto';
  panel.style.flex = `0 0 ${FULLSCREEN_PANEL_RATIO}`;
  panel.style.width = 'auto';
  panel.style.height = '100%';
  panel.style.maxHeight = 'none';
  panel.style.minWidth = '0';
  panel.style.minHeight = '0';
  panel.style.overflow = 'hidden';
  panel.style.boxSizing = 'border-box';
  panel.style.display = 'flex';
  panel.style.alignSelf = 'stretch';

  const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
  if (panelBody) {
    panelBody.style.maxHeight = 'none';
  }
}

/**
 * Restore normal docked or hidden layout after exiting F0 fullscreen.
 */
export function exitFullscreenDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
  panelVisible: boolean,
): void {
  playerContainer.classList.remove('art-fullscreen');

  if (!panelVisible) {
    hidePanelDocked(f0, playerContainer, panel);
    return;
  }

  // Clear fullscreen styles so the browser can reflow to natural size before
  // showPanelDocked captures it. Otherwise we lock the collapsing transition
  // height and the layout stays broken.
  f0.style.display = '';
  f0.style.flexDirection = '';
  f0.style.alignItems = '';
  f0.style.boxSizing = '';
  f0.style.height = '';

  playerContainer.style.flex = '';
  playerContainer.style.minWidth = '';
  playerContainer.style.minHeight = '';
  playerContainer.style.boxSizing = '';
  playerContainer.style.height = '';
  playerContainer.style.removeProperty('aspect-ratio');

  // Force reflow so the next measurement sees the natural post-fullscreen size.
  void f0.offsetHeight;

  showPanelDocked(f0, playerContainer, panel);
}

/**
 * When the art-video-player enters fullscreen, overlay the subtitle panel
 * on top of the fullscreen video (right side, 30% width). This is the only
 * approach that works because:
 *
 * 1. Content scripts run in an isolated world — can't override
 *    requestFullscreen() on the art-video-player element (page can't see it).
 * 2. Injecting <script> tags is blocked by the page's CSP.
 * 3. Reactive redirect (exitFullscreen → f0.requestFullscreen) fails because
 *    requestFullscreen() requires a user gesture, which is consumed by the
 *    time fullscreenchange fires.
 *
 * So we let the art-video-player be fullscreen, move the panel INTO it as
 * a fixed-position overlay, and restore it when fullscreen exits.
 *
 * Returns a cleanup function that removes the listeners.
 */
export function setupFullscreenHandlers(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
  isPanelVisible: () => boolean,
): () => void {
  let cleaned = false;
  let panelOriginalParent: HTMLElement | null = null;
  let savedPanelStyles = '';

  const onFullscreenChange = () => {
    const fsEl = document.fullscreenElement;

    if (fsEl && fsEl !== f0) {
      // Some element other than F0 entered fullscreen (e.g. art-video-player).
      // Only overlay if the panel is visible.
      if (!isPanelVisible()) return;

      // Save the panel's original parent and styles so we can restore them.
      if (!panelOriginalParent) {
        panelOriginalParent = panel.parentElement;
        savedPanelStyles = panel.style.cssText;
      }

      // Move the panel into the fullscreen element so it's visible.
      // Elements outside the fullscreen element are NOT rendered.
      fsEl.appendChild(panel);

      // Style the panel as a fixed overlay on the right side.
      panel.style.position = 'fixed';
      panel.style.right = '0';
      panel.style.top = '0';
      panel.style.left = 'auto';
      panel.style.bottom = 'auto';
      panel.style.width = '30vw';
      panel.style.height = '100vh';
      panel.style.maxHeight = 'none';
      panel.style.zIndex = '2147483647';
      panel.style.display = 'flex';
      panel.style.flexDirection = 'column';
      panel.style.borderRadius = '8px 0 0 8px';
      panel.style.boxSizing = 'border-box';
      panel.style.overflow = 'hidden';

      const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
      if (panelBody) {
        panelBody.style.maxHeight = 'none';
      }
    } else if (fsEl === null) {
      // Exited fullscreen: restore the panel to its original parent and styles.
      if (panelOriginalParent && panel.parentElement !== panelOriginalParent) {
        panelOriginalParent.appendChild(panel);
        panel.style.cssText = savedPanelStyles;
        panelOriginalParent = null;
        savedPanelStyles = '';
      }

      // Restore normal docked or hidden layout.
      exitFullscreenDocked(f0, playerContainer, panel, isPanelVisible());
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);

  return () => {
    if (cleaned) return;
    cleaned = true;
    // If still in fullscreen, restore panel to original parent.
    if (panelOriginalParent && panel.parentElement !== panelOriginalParent) {
      panelOriginalParent.appendChild(panel);
      panel.style.cssText = savedPanelStyles;
    }
    panelOriginalParent = null;
    savedPanelStyles = '';
    document.removeEventListener('fullscreenchange', onFullscreenChange);
  };
}

/**
 * Move the panel into F0 so it becomes a sibling of playerContainer.
 * Required for flex layout to place the panel beside the video.
 */
export function movePanelToOuterWrapper(panel: HTMLElement, f0: HTMLElement): void {
  if (panel.parentElement !== f0) {
    f0.appendChild(panel);
  }
}
