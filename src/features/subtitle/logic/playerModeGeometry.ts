// Player Mode geometry — pure layout helpers (no DOM, no side effects). O(1).
//
// Layout contract (see tasks/plan.md):
//   VideoStage (top, intrinsic aspect) → ContentOther (flex:1) → DictionarySheet (optional, above dock) → PlayerActionDock (bottom, fixed).
//   The dock must always remain visible; the dictionary sheet may cover the video but never the dock.

/** Player Mode on/off state. */
export type PlayerModeActive = boolean;

/** Toggle Player Mode. Pure — caller stores the result. */
export function togglePlayerMode(active: PlayerModeActive): PlayerModeActive {
  return !active;
}

/** Resolve video width/height to an aspect ratio with a safe fallback. */
export function resolveVideoAspectRatio(
  videoWidth: number,
  videoHeight: number,
  fallback = 16 / 9,
): number {
  if (Number.isFinite(videoWidth) && Number.isFinite(videoHeight) && videoWidth > 0 && videoHeight > 0) {
    return videoWidth / videoHeight;
  }
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 16 / 9;
}

/** Inline styles applied temporarily to the host player container. */
export function resolvePlayerModeHostStyles(videoStageHeight: number): Readonly<Record<string, string>> {
  const safeHeight = Number.isFinite(videoStageHeight) && videoStageHeight > 0 ? videoStageHeight : 0;
  return {
    position: 'fixed',
    inset: '0 auto auto 0',
    width: '100vw',
    height: `${safeHeight}px`,
    'max-width': 'none',
    'max-height': 'none',
    margin: '0',
    transform: 'none',
  };
}

/** Inline styles applied temporarily to the video inside the host container. */
export function resolvePlayerModeVideoStyles(): Readonly<Record<string, string>> {
  return {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    'max-width': 'none',
    'max-height': 'none',
    margin: '0',
    transform: 'none',
    'object-fit': 'contain',
  };
}

/** Minimum Player Action Dock height in px (touch targets + 2 rows of controls). */
export const DOCK_MIN_HEIGHT_PX = 160;
/** Maximum Player Action Dock height as percent of viewport (avoid eating the video). */
export const DOCK_MAX_HEIGHT_PERCENT = 35;

/** Minimum dictionary sheet height in px (handle + header + 1 candidate). */
export const SHEET_MIN_HEIGHT_PX = 160;
/** Maximum dictionary sheet height as percent of viewport above the dock. */
export const SHEET_MAX_HEIGHT_PERCENT = 100;

/**
 * Clamp Player Action Dock height to [DOCK_MIN_HEIGHT_PX, DOCK_MAX_HEIGHT_PERCENT% of viewport].
 * Returns px. NaN/degenerate viewport → DOCK_MIN_HEIGHT_PX.
 */
export function clampDockHeight(
  dockHeightPx: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(dockHeightPx) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return DOCK_MIN_HEIGHT_PX;
  }
  const maxPx = Math.round((viewportHeight * DOCK_MAX_HEIGHT_PERCENT) / 100);
  return Math.min(Math.max(dockHeightPx, DOCK_MIN_HEIGHT_PX), Math.max(maxPx, DOCK_MIN_HEIGHT_PX));
}

/**
 * Clamp dictionary sheet height so it never covers the dock.
 * Sheet lives in the region [0, viewportHeight - dockHeightPx].
 * @param sheetHeightPx - requested sheet height in px
 * @param viewportHeight - current viewport height in px (use 100dvh at runtime)
 * @param dockHeightPx - current dock height in px
 * @returns clamped sheet height in px
 */
export function clampDictionarySheetHeight(
  sheetHeightPx: number,
  viewportHeight: number,
  dockHeightPx: number,
): number {
  if (!Number.isFinite(sheetHeightPx) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return SHEET_MIN_HEIGHT_PX;
  }
  const safeDock = Number.isFinite(dockHeightPx) && dockHeightPx >= 0 ? dockHeightPx : 0;
  const available = viewportHeight - safeDock;
  const maxPx = Math.round((available * SHEET_MAX_HEIGHT_PERCENT) / 100);
  const upperBound = Math.max(maxPx, SHEET_MIN_HEIGHT_PX);
  return Math.min(Math.max(sheetHeightPx, SHEET_MIN_HEIGHT_PX), upperBound);
}

/** Player Mode layout regions (all in px). */
export interface PlayerModeLayout {
  /** Video stage height — intrinsic aspect ratio based, capped to a share of viewport. */
  videoStageHeight: number;
  /** ContentOther height — fills the remaining space between video and sheet/dock. */
  contentOtherHeight: number;
  /** Dock height — clamped. */
  dockHeight: number;
}

/**
 * Resolve the three fixed regions for a given viewport + dock height.
 * Video keeps its intrinsic aspect ratio but is capped at 60% of viewport so the dock + content stay usable on tall videos.
 * @param viewportWidth - px
 * @param viewportHeight - px (use 100dvh at runtime)
 * @param videoAspectRatio - width / height (e.g. 16/9). Falls back to 16/9 when invalid.
 * @param dockHeightPx - requested dock height in px (will be clamped)
 */
export function resolvePlayerModeLayout(
  viewportWidth: number,
  viewportHeight: number,
  videoAspectRatio: number,
  dockHeightPx: number,
): PlayerModeLayout {
  const safeAspect = Number.isFinite(videoAspectRatio) && videoAspectRatio > 0 ? videoAspectRatio : 16 / 9;
  const dockHeight = clampDockHeight(dockHeightPx, viewportHeight);
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportHeight <= 0 || viewportWidth <= 0) {
    return { videoStageHeight: 0, contentOtherHeight: 0, dockHeight };
  }
  const intrinsicHeight = viewportWidth / safeAspect;
  const cap = Math.round(viewportHeight * 0.6);
  const videoStageHeight = Math.min(intrinsicHeight, cap);
  const contentOtherHeight = Math.max(viewportHeight - videoStageHeight - dockHeight, 0);
  return { videoStageHeight, contentOtherHeight, dockHeight };
}
