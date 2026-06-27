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

/** Width of the draggable resize handle between video and panel (px). */
export const RESIZE_HANDLE_WIDTH = 8;
/** Class name for the resize handle element. */
export const RESIZE_HANDLE_CLASS = 'vd-subtitle-resize-handle';

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
 * Check whether the fullscreen element can host a flex layout.
 * A <video> element is a void/replaced element and cannot contain rendered
 * siblings, so side-by-side is impossible there. Any other HTMLElement is
 * treated as a container.
 */
function isContainerFullscreenElement(fsElement: Element): boolean {
  return fsElement instanceof HTMLElement && fsElement.tagName !== 'VIDEO';
}

/** Find the <video> element inside the fullscreen element. */
function findVideoInFullscreen(fsElement: Element): HTMLVideoElement | null {
  return fsElement.querySelector('video');
}

/**
 * Find player UI elements that need to be constrained to the video area.
 * We target the known art-player layer classes and any absolutely positioned
 * direct children of the fullscreen element that span the full viewport.
 */
function findPlayerUiElements(fsElement: HTMLElement): HTMLElement[] {
  const selectors = [
    '.art-bottom',
    '.art-layers',
    '.art-mask',
    '.art-subtitle',
    '.art-danmuku',
    '.art-poster',
    '.art-loading',
    '.art-notice',
    '.art-settings',
    '.art-info',
    '.art-contextmenus',
    '.art-state',
  ];
  const artElements = selectors
    .flatMap((selector) => Array.from(fsElement.querySelectorAll(selector)))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);

  // Also catch any direct absolute children that span full width/height.
  const absoluteChildren = Array.from(fsElement.children).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    const spansFull =
      style.position === 'absolute' &&
      (parseFloat(style.width) >= fsElement.clientWidth - 1 ||
        parseFloat(style.height) >= fsElement.clientHeight - 1);
    return spansFull && !el.classList.contains(RESIZE_HANDLE_CLASS);
  });

  return [...new Set([...artElements, ...absoluteChildren])];
}

/** Saved inline styles for a single element. */
interface SavedElementStyles {
  el: HTMLElement;
  cssText: string;
}

/**
 * Common state for any resize-draggable split layout (normal or fullscreen).
 * The container is the flex parent; leftEl is the video/player side, rightEl
 * is the panel. ratio is the video fraction (0.2–0.8).
 */
interface ResizeState {
  container: HTMLElement;
  leftEl: HTMLElement;
  rightEl: HTMLElement;
  handle: HTMLElement;
  ratio: number;
  isVertical: boolean;
  /** Optional callback invoked after ratio is applied (e.g. constrain UI). */
  onRatioApplied?: () => void;
}

/** Saved state for an active fullscreen side-by-side layout. */
interface FullscreenSideBySideState extends ResizeState {
  fsElement: HTMLElement;
  video: HTMLVideoElement;
  savedPanelStyles: { parent: HTMLElement | null; cssText: string };
  savedFsCssText: string;
  savedVideoCssText: string;
  savedUiStyles: SavedElementStyles[];
}

/** The currently active resize-draggable layout (normal or fullscreen). */
let activeResizeState: ResizeState | null = null;

/** The currently active fullscreen side-by-side layout, if any. */
let activeFullscreenSideBySide: FullscreenSideBySideState | null = null;

/**
 * Persisted split ratio from the last fullscreen side-by-side session.
 * Kept separate from the active state so it survives hide/show cycles.
 */
let lastFullscreenRatio: number | null = null;

/**
 * Persisted split ratio from the last normal docked session.
 * Kept separate from the active state so it survives hide/show cycles.
 */
let lastNormalRatio: number | null = null;

/** Remove a resize handle from its parent, if it still exists. */
function removeResizeHandle(handle: HTMLElement): void {
  handle.parentElement?.removeChild(handle);
}

/** Clean up resize-handle drag listeners on the document. */
function removeResizeListeners(): void {
  document.removeEventListener('mousemove', onResizeMouseMove);
  document.removeEventListener('mouseup', onResizeMouseUp);
  document.removeEventListener('touchmove', onResizeTouchMove);
  document.removeEventListener('touchend', onResizeTouchEnd);
}

/** Create a resize handle element between video and panel. */
function createResizeHandle(isVertical: boolean): HTMLElement {
  const handle = document.createElement('div');
  handle.className = RESIZE_HANDLE_CLASS;
  handle.style.flex = `0 0 ${RESIZE_HANDLE_WIDTH}px`;
  handle.style.cursor = isVertical ? 'ns-resize' : 'ew-resize';
  handle.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
  handle.style.zIndex = '2147483647';
  if (isVertical) {
    handle.style.width = '100%';
    handle.style.height = `${RESIZE_HANDLE_WIDTH}px`;
  } else {
    handle.style.width = `${RESIZE_HANDLE_WIDTH}px`;
    handle.style.height = '100%';
  }
  return handle;
}

/** Calculate the current video ratio from an active drag position. */
function calculateDragRatio(
  state: ResizeState,
  clientPos: number,
): number {
  const { container, isVertical } = state;
  const rect = container.getBoundingClientRect();
  const total = isVertical ? rect.height : rect.width;
  const offset = isVertical ? rect.top : rect.left;
  const ratio = total > 0 ? (clientPos - offset) / total : 0.5;
  // Clamp between 20% and 80% to keep both areas usable.
  return Math.min(Math.max(ratio, 0.2), 0.8);
}

/** Apply the current ratio to the left element, handle, and right element. */
function applySplitRatio(state: ResizeState): void {
  const { leftEl, rightEl, ratio, isVertical } = state;
  const leftBasis = `calc(${(ratio * 100).toFixed(2)}% - ${RESIZE_HANDLE_WIDTH / 2}px)`;
  const rightBasis = `calc(${((1 - ratio) * 100).toFixed(2)}% - ${RESIZE_HANDLE_WIDTH / 2}px)`;
  if (isVertical) {
    leftEl.style.setProperty('flex', `0 0 ${leftBasis}`, 'important');
    leftEl.style.setProperty('height', leftBasis, 'important');
    rightEl.style.setProperty('flex', `0 0 ${rightBasis}`, 'important');
    rightEl.style.setProperty('height', rightBasis, 'important');
  } else {
    leftEl.style.setProperty('flex', `0 0 ${leftBasis}`, 'important');
    leftEl.style.setProperty('width', leftBasis, 'important');
    rightEl.style.setProperty('flex', `0 0 ${rightBasis}`, 'important');
    rightEl.style.setProperty('width', rightBasis, 'important');
  }
  state.onRatioApplied?.();
  void state.container.offsetHeight;
}

/** Constrain player UI layers to the current video area (fullscreen only). */
function constrainPlayerUiElements(state: FullscreenSideBySideState): void {
  const { video, isVertical, savedUiStyles } = state;
  const videoRect = video.getBoundingClientRect();
  savedUiStyles.forEach(({ el }) => {
    if (isVertical) {
      const height = `${videoRect.height}px`;
      el.style.setProperty('height', height, 'important');
      el.style.setProperty('top', '0', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('left', '0', 'important');
    } else {
      const width = `${videoRect.width}px`;
      el.style.setProperty('width', width, 'important');
      el.style.setProperty('left', '0', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('top', '0', 'important');
      el.style.setProperty('height', '100%', 'important');
    }
  });
}

/** Restore saved UI styles. */
function restorePlayerUiElements(state: FullscreenSideBySideState): void {
  const { savedUiStyles } = state;
  savedUiStyles.forEach(({ el, cssText }) => {
    el.style.cssText = cssText;
  });
}

function onResizeMouseMove(e: MouseEvent): void {
  if (!activeResizeState) return;
  const ratio = calculateDragRatio(activeResizeState, e.clientX);
  activeResizeState.ratio = ratio;
  if (activeFullscreenSideBySide) lastFullscreenRatio = ratio;
  else lastNormalRatio = ratio;
  applySplitRatio(activeResizeState);
}

function onResizeMouseUp(): void {
  removeResizeListeners();
}

function onResizeTouchMove(e: TouchEvent): void {
  if (!activeResizeState || e.touches.length === 0) return;
  const touch = e.touches[0];
  const pos = activeResizeState.isVertical ? touch.clientY : touch.clientX;
  const ratio = calculateDragRatio(activeResizeState, pos);
  activeResizeState.ratio = ratio;
  if (activeFullscreenSideBySide) lastFullscreenRatio = ratio;
  else lastNormalRatio = ratio;
  applySplitRatio(activeResizeState);
}

function onResizeTouchEnd(): void {
  removeResizeListeners();
}

function startResizeDrag(e: MouseEvent | TouchEvent): void {
  e.preventDefault();
  if (!activeFullscreenSideBySide) return;
  removeResizeListeners();
  document.addEventListener('mousemove', onResizeMouseMove);
  document.addEventListener('mouseup', onResizeMouseUp);
  document.addEventListener('touchmove', onResizeTouchMove, { passive: false });
  document.addEventListener('touchend', onResizeTouchEnd);
}

/**
 * Apply the panel as a side-by-side flex layout inside the fullscreen element.
 * Video takes the video ratio, panel takes the panel ratio, separated by a
 * draggable handle. Player UI layers are constrained to the video area.
 */
function applyFullscreenSideBySide(
  panel: HTMLElement,
  fsElement: HTMLElement,
  savedStyles: { parent: HTMLElement | null; cssText: string } | null,
): { parent: HTMLElement | null; cssText: string } | null {
  const video = findVideoInFullscreen(fsElement);
  if (!video) {
    // Fallback to overlay if there is no video inside the fullscreen element.
    return applyFullscreenOverlay(panel, fsElement, savedStyles);
  }

  // Save the very first panel state before any fullscreen styling is applied.
  const savedPanelStyles = savedStyles ?? {
    parent: panel.parentElement,
    cssText: panel.style.cssText,
  };

  // Move panel into the fullscreen element.
  if (panel.parentElement !== fsElement) {
    fsElement.appendChild(panel);
  }

  const isVertical = isMobileViewport();
  const defaultRatio = isVertical ? 0.6 : 0.7;
  const ratio = lastFullscreenRatio ?? defaultRatio;

  const handle = createResizeHandle(isVertical);
  fsElement.insertBefore(handle, panel);

  const uiElements = findPlayerUiElements(fsElement);
  const savedUiStyles: SavedElementStyles[] = uiElements.map((el) => ({
    el,
    cssText: el.style.cssText,
  }));

  activeFullscreenSideBySide = {
    container: fsElement,
    leftEl: video,
    rightEl: panel,
    handle,
    ratio,
    isVertical,
    onRatioApplied: () => constrainPlayerUiElements(activeFullscreenSideBySide!),
    fsElement,
    video,
    savedPanelStyles,
    savedFsCssText: fsElement.style.cssText,
    savedVideoCssText: video.style.cssText,
    savedUiStyles,
  };
  activeResizeState = activeFullscreenSideBySide;

  // Set up the fullscreen container as a flex box.
  fsElement.style.setProperty('display', 'flex', 'important');
  fsElement.style.setProperty('flex-direction', isVertical ? 'column' : 'row', 'important');
  fsElement.style.setProperty('align-items', 'stretch', 'important');
  fsElement.style.setProperty('justify-content', 'flex-start', 'important');
  fsElement.style.setProperty('box-sizing', 'border-box', 'important');

  // Make the video element participate in the flex layout.
  video.style.setProperty('position', 'relative', 'important');
  video.style.setProperty('flex', '0 0 0', 'important');
  video.style.setProperty('min-width', '0', 'important');
  video.style.setProperty('min-height', '0', 'important');
  video.style.setProperty('box-sizing', 'border-box', 'important');
  video.style.setProperty('aspect-ratio', 'auto', 'important');

  // Reset any absolute/floating panel styles, then set it as a flex item.
  panel.style.cssText = '';
  panel.style.setProperty('position', 'relative', 'important');
  panel.style.setProperty('flex', '0 0 0', 'important');
  panel.style.setProperty('min-width', '0', 'important');
  panel.style.setProperty('min-height', '0', 'important');
  panel.style.setProperty('box-sizing', 'border-box', 'important');
  panel.style.setProperty('overflow', 'hidden', 'important');
  panel.style.setProperty('display', 'flex', 'important');
  panel.style.setProperty('flex-direction', 'column', 'important');
  panel.style.setProperty('align-self', 'stretch', 'important');
  panel.style.setProperty('border-radius', '0', 'important');
  panel.style.setProperty('max-height', 'none', 'important');
  panel.setAttribute('data-docking-mode', 'flex');

  const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
  if (panelBody) {
    panelBody.style.setProperty('max-height', 'none', 'important');
  }

  applySplitRatio(activeFullscreenSideBySide);

  handle.addEventListener('mousedown', startResizeDrag);
  handle.addEventListener('touchstart', startResizeDrag, { passive: false });

  return savedPanelStyles;
}

/**
 * Restore the panel from fullscreen side-by-side to its saved parent/styles.
 */
function restoreFullscreenSideBySide(): void {
  if (!activeFullscreenSideBySide) return;

  const { fsElement, video, rightEl: panel, handle, savedPanelStyles, savedFsCssText, savedVideoCssText } =
    activeFullscreenSideBySide;

  handle.removeEventListener('mousedown', startResizeDrag);
  handle.removeEventListener('touchstart', startResizeDrag);
  removeResizeListeners();
  removeResizeHandle(handle);

  restorePlayerUiElements(activeFullscreenSideBySide);

  fsElement.style.cssText = savedFsCssText;
  video.style.cssText = savedVideoCssText;

  if (savedPanelStyles.parent && panel.parentElement !== savedPanelStyles.parent) {
    savedPanelStyles.parent.appendChild(panel);
  }
  panel.style.cssText = savedPanelStyles.cssText;

  activeFullscreenSideBySide = null;
  activeResizeState = null;
}

/**
 * Apply the panel as a fixed overlay inside the fullscreen element.
 * The panel is moved into fsElement so it renders (elements outside the
 * fullscreen element are hidden). Called both from fullscreenchange and from
 * showPanelDocked/hidePanelDocked when the user toggles the panel while in
 * fullscreen.
 */
function applyFullscreenOverlay(
  panel: HTMLElement,
  fsElement: Element,
  savedStyles: { parent: HTMLElement | null; cssText: string } | null,
): { parent: HTMLElement | null; cssText: string } {
  const savedParent = panel.parentElement;
  const savedCssText = panel.style.cssText;

  // Move panel into the fullscreen element only if it's not already there.
  if (panel.parentElement !== fsElement) {
    fsElement.appendChild(panel);
  }

  // Reset any flex/relative styles from the normal docked layout, then apply
  // the fixed overlay styles. Use inline styles (not !important) so the
  // fullscreenchange handler can override them later.
  panel.style.position = 'fixed';
  panel.style.right = '0';
  panel.style.top = '0';
  panel.style.left = 'auto';
  panel.style.bottom = 'auto';
  panel.style.width = '30vw';
  panel.style.height = '100vh';
  panel.style.maxHeight = 'none';
  panel.style.minWidth = '0';
  panel.style.minHeight = '0';
  panel.style.zIndex = '2147483647';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.flex = '0 0 auto';
  panel.style.alignSelf = 'auto';
  panel.style.borderRadius = '8px 0 0 8px';
  panel.style.boxSizing = 'border-box';
  panel.style.overflow = 'hidden';
  panel.style.setProperty('aspect-ratio', 'auto', 'important');

  const panelBody = panel.querySelector('[data-testid="panel-body"]') as HTMLElement | null;
  if (panelBody) {
    panelBody.style.maxHeight = 'none';
  }

  // Return the previously saved styles so we only capture the very first state
  // before any overlay was applied. If we already have saved styles, keep them.
  return savedStyles ?? { parent: savedParent, cssText: savedCssText };
}

/**
 * Restore the panel from fullscreen overlay to its saved parent/styles.
 */
function restoreFullscreenOverlay(
  panel: HTMLElement,
  savedStyles: { parent: HTMLElement | null; cssText: string },
): void {
  if (savedStyles.parent && panel.parentElement !== savedStyles.parent) {
    savedStyles.parent.appendChild(panel);
  }
  panel.style.cssText = savedStyles.cssText;
}

/**
 * Show panel in docked layout: shrink playerContainer to make room for panel.
 * F0 becomes a flex container; playerContainer takes the video ratio, panel
 * takes the panel ratio.
 *
 * If the browser is currently in fullscreen on an element other than F0, this
 * applies the overlay layout instead so the panel remains visible on top of the
 * fullscreen video.
 */
export function showPanelDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
  savedStyles?: { parent: HTMLElement | null; cssText: string } | null,
): { parent: HTMLElement | null; cssText: string } | null {
  const fsElement = document.fullscreenElement;
  if (fsElement && fsElement !== f0) {
    // We are in fullscreen on the player (or another element). Use side-by-side
    // flex layout if the fullscreen element is a container; otherwise fall back
    // to the fixed overlay.
    if (isContainerFullscreenElement(fsElement)) {
      return applyFullscreenSideBySide(panel, fsElement as HTMLElement, savedStyles ?? null);
    }
    return applyFullscreenOverlay(panel, fsElement, savedStyles ?? null);
  }

  const mobile = isMobileViewport();
  const isVertical = mobile;
  panel.setAttribute('data-docking-mode', 'flex');

  // Preserve F0's natural height so the video does not shrink vertically when
  // playerContainer width is reduced. Without this, the site's aspect-ratio
  // CSS on the player would force the height to shrink proportionally with
  // the width, making the video smaller in both dimensions.
  f0.style.height = `${f0.getBoundingClientRect().height}px`;

  f0.style.display = 'flex';
  f0.style.flexDirection = isVertical ? 'column' : 'row';
  f0.style.alignItems = 'stretch';
  f0.style.boxSizing = 'border-box';

  playerContainer.style.minWidth = '0';
  playerContainer.style.minHeight = '0';
  playerContainer.style.boxSizing = 'border-box';
  // Fill the preserved F0 height instead of letting aspect-ratio decide.
  playerContainer.style.height = isVertical ? '' : '100%';
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
  panel.style.width = isVertical ? '100%' : 'auto';
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

  // Insert a draggable resize handle between playerContainer and panel.
  // Remove any stale handle first (e.g. from a previous show without hide).
  const staleHandle = f0.querySelector(`.${RESIZE_HANDLE_CLASS}`);
  if (staleHandle) staleHandle.remove();

  const defaultRatio = isVertical ? 0.6 : 0.7;
  const ratio = lastNormalRatio ?? defaultRatio;
  const handle = createResizeHandle(isVertical);
  f0.insertBefore(handle, panel);

  activeResizeState = {
    container: f0,
    leftEl: playerContainer,
    rightEl: panel,
    handle,
    ratio,
    isVertical,
  };

  applySplitRatio(activeResizeState);

  handle.addEventListener('mousedown', startResizeDrag);
  handle.addEventListener('touchstart', startResizeDrag, { passive: false });

  return null;
}

/**
 * Hide panel and restore playerContainer to its full size.
 *
 * If the browser is currently in fullscreen on an element other than F0, the
 * panel stays inside the fullscreen element but is hidden with display:none so
 * it will re-appear correctly when the user reopens it.
 */
export function hidePanelDocked(
  f0: HTMLElement,
  playerContainer: HTMLElement,
  panel: HTMLElement,
  savedStyles?: { parent: HTMLElement | null; cssText: string } | null,
): void {
  const fsElement = document.fullscreenElement;
  if (fsElement && fsElement !== f0) {
    // Fullscreen mode: restore the natural fullscreen layout (video 100%) and
    // hide the panel. If side-by-side is active, tear it down; otherwise just
    // hide the overlay.
    void savedStyles;
    if (activeFullscreenSideBySide) {
      restoreFullscreenSideBySide();
    }
    panel.style.display = 'none';
    return;
  }

  panel.removeAttribute('data-docking-mode');

  // Remove the resize handle and clear drag state (normal mode only).
  if (activeResizeState && !activeFullscreenSideBySide) {
    const { handle } = activeResizeState;
    handle.removeEventListener('mousedown', startResizeDrag);
    handle.removeEventListener('touchstart', startResizeDrag);
    removeResizeListeners();
    removeResizeHandle(handle);
    activeResizeState = null;
  }

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
  playerContainer.style.width = '';
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

  // Reset panel to floating state first so its leftover fullscreen styles
  // (display:flex, height:100%, max-height:none, align-self:stretch) don't
  // inflate F0's auto height during the reflow. hidePanelDocked also clears
  // F0 + playerContainer inline styles and forces a reflow via getBoundingClientRect
  // in showPanelDocked, so the captured F0 height is the natural post-fullscreen
  // size, not one inflated by stale panel styles.
  hidePanelDocked(f0, playerContainer, panel);
  showPanelDocked(f0, playerContainer, panel);
}

/**
 * When any element enters fullscreen (the video player, not F0), place the
 * subtitle panel beside the video in a side-by-side flex layout. If the
 * fullscreen element is a <video> element (which cannot host rendered siblings),
 * fall back to the fixed overlay approach.
 *
 * This is generic: it uses `document.fullscreenElement` directly instead of
 * hardcoding the art-player class, so it works on any site that puts the video
 * container in fullscreen via the native Fullscreen API.
 *
 * Why this approach is needed:
 * 1. Content scripts run in an isolated world — can't override
 *    requestFullscreen() on the video element (page can't see it).
 * 2. Injecting <script> tags is blocked by many pages' CSP.
 * 3. Reactive redirect (exitFullscreen → f0.requestFullscreen) fails because
 *    requestFullscreen() requires a user gesture, which is consumed by the
 *    time fullscreenchange fires.
 *
 * So we let the player's element be fullscreen, move the panel INTO it as a
 * flex item, and restore it when fullscreen exits.
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
  let savedPanelStyles: { parent: HTMLElement | null; cssText: string } | null = null;

  const onFullscreenChange = () => {
    const fsEl = document.fullscreenElement;

    if (fsEl && fsEl !== f0) {
      // Some element other than F0 entered fullscreen (e.g. the native player).
      // Only layout if the panel is visible.
      if (!isPanelVisible()) return;

      if (isContainerFullscreenElement(fsEl)) {
        // Container fullscreen: use side-by-side flex layout.
        savedPanelStyles = applyFullscreenSideBySide(panel, fsEl as HTMLElement, savedPanelStyles) ?? savedPanelStyles;
      } else {
        // <video> fullscreen: fallback to fixed overlay.
        savedPanelStyles = applyFullscreenOverlay(panel, fsEl, savedPanelStyles);
      }
    } else if (fsEl === null) {
      // Exited fullscreen: restore the panel to its original parent and styles.
      if (activeFullscreenSideBySide) {
        restoreFullscreenSideBySide();
      } else if (savedPanelStyles) {
        restoreFullscreenOverlay(panel, savedPanelStyles);
        savedPanelStyles = null;
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
    if (activeFullscreenSideBySide) {
      restoreFullscreenSideBySide();
    } else if (savedPanelStyles) {
      restoreFullscreenOverlay(panel, savedPanelStyles);
      savedPanelStyles = null;
    }
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
