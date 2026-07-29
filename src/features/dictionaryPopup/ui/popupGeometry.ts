// popupGeometry — shared popup positioning geometry.
//
// Pure layout helpers and constants used by both the legacy `PopupShell`
// and the React `usePopupPosition` / `mountPopupDictionary` paths.

export const POPUP_Z_INDEX = 'var(--z-overlay-top)'; // top content-script overlay

/** Layout constants — extracted from hardcoded px values (Phase 1 SSOT). */
export const POPUP_MARGIN_PX = 8; // equals --space-2
export const POPUP_POINTER_GAP_PX = 4; // equals --space-1
const POPUP_POINTER_DIRECTION_THRESHOLD_PX = 4; // px
export const POPUP_DEFAULT_POINTER_RADIUS_PX = 6; // px
export const POPUP_MIN_WIDTH_PX = 320;
export const POPUP_MIN_HEIGHT_PX = 200;
export const POPUP_DEFAULT_HEIGHT_PX = 300;
export const POPUP_MAX_HEIGHT_RATIO = 0.7;
export const POPUP_SHEET_BREAKPOINT_PX = 768; // must stay in sync with CSS media queries
export const SHEET_SNAP_THRESHOLD_PX = 40;
export const SHEET_DISMISS_THRESHOLD_PX = 100;

/** Sheet snap tiers as fraction of viewport height (high → low). */
export const SHEET_TIERS = [1.0, 0.75, 0.5, 0.25];

/** Popup position strategy (spec: auto-position tránh overflow). */
export interface PopupPosition {
  readonly left: number;
  readonly top: number;
}

/** Anchor rectangle for popup positioning (token's bounding box). */
export interface PopupAnchor {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** Optional pointer hint so the popup can avoid covering the pointer/badge. */
export interface PopupPointerHint {
  readonly tip: { readonly x: number; readonly y: number };
  readonly badgeCenter?: { readonly x: number; readonly y: number };
  readonly badgeRadius?: number;
  readonly pointerRadius?: number;
}

/** Bounding box of the line containing the looked-up token.
 *  The popup must NEVER overlap this rect (hard constraint — "không che chữ
 *  cùng hàng"). If absent, falls back to the anchor rect itself. */
export interface PopupLineRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** Popup size (sticky — persisted to chrome.storage.local). */
export interface PopupSize {
  readonly width: number;
  readonly maxHeight: number;
}

/**
 * Get the appropriate mount parent for the popup host.
 * In fullscreen mode, only the fullscreen element and its descendants render.
 * If fullscreen element is a <video> (replaced element — no DOM children rendered),
 * use its parent instead.
 * ponytail ceiling: if <video> has no wrapper parent, popup won't show in fullscreen.
 */
export function getMountParent(): HTMLElement {
  const fsElement = document.fullscreenElement as HTMLElement | null;
  if (!fsElement) return document.body;
  if (fsElement.tagName === 'VIDEO') {
    return fsElement.parentElement ?? document.body;
  }
  return fsElement;
}

/** Clamp popup size to viewport. */
export function clampPopupSize(size: PopupSize, viewportWidth: number, viewportHeight: number): PopupSize {
  const width = Math.min(size.width, viewportWidth - POPUP_MARGIN_PX * 2);
  const maxHeight = Math.min(size.maxHeight, Math.round(viewportHeight * POPUP_MAX_HEIGHT_RATIO));
  return { width: Math.max(POPUP_MIN_WIDTH_PX, width), maxHeight: Math.max(POPUP_MIN_HEIGHT_PX, maxHeight) };
}

/** Final clamp to keep the popup inside the viewport. */
export function finalizePosition(
  left: number,
  top: number,
  popupWidth: number,
  popupHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PopupPosition {
  const maxFitWidth = viewportWidth - POPUP_MARGIN_PX * 2;
  const maxFitHeight = viewportHeight - POPUP_MARGIN_PX * 2;
  if (popupWidth <= maxFitWidth) {
    if (left < POPUP_MARGIN_PX) left = POPUP_MARGIN_PX;
    if (left + popupWidth > viewportWidth - POPUP_MARGIN_PX) {
      left = viewportWidth - popupWidth - POPUP_MARGIN_PX;
    }
  } else {
    left = POPUP_MARGIN_PX;
  }
  if (popupHeight <= maxFitHeight) {
    if (top + popupHeight > viewportHeight - POPUP_MARGIN_PX) {
      top = viewportHeight - popupHeight - POPUP_MARGIN_PX;
    }
    if (top < POPUP_MARGIN_PX) top = POPUP_MARGIN_PX;
  } else {
    top = POPUP_MARGIN_PX;
  }
  return { left: Math.round(left), top: Math.round(top) };
}

/** Diagonal corner placement (image-1 ideal).
 *  SE = right+below, SW = left+below, NE = right+above, NW = left+above.
 *  Each corner anchors the popup to a diagonal of the word box so the popup
 *  clears BOTH the horizontal band (no left/right cover) AND the vertical
 *  column (no above/below cover) of the looked-up word. */
type CornerPlacement = 'se' | 'sw' | 'ne' | 'nw';

/** Pointer-derived axis preference, mapped to corner candidates below. */
type PreferredPlacement = 'top' | 'bottom' | 'left' | 'right';

function derivePreferredPlacement(
  pointer: PopupPointerHint,
  anchor: PopupAnchor,
): PreferredPlacement | null {
  const originX = pointer.badgeCenter?.x ?? (anchor.left + anchor.right) / 2;
  const originY = pointer.badgeCenter?.y ?? (anchor.top + anchor.bottom) / 2;
  const dx = pointer.tip.x - originX;
  const dy = pointer.tip.y - originY;
  if (Math.hypot(dx, dy) < POPUP_POINTER_DIRECTION_THRESHOLD_PX) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

/** Map an axis preference to the two corners that satisfy it. */
function cornersForPreference(pref: PreferredPlacement | null): readonly CornerPlacement[] {
  switch (pref) {
    case 'right': return ['se', 'ne'];
    case 'left': return ['sw', 'nw'];
    case 'bottom': return ['se', 'sw'];
    case 'top': return ['ne', 'nw'];
    default: return ['se'];
  }
}

function rectContainsPoint(rx: number, ry: number, rw: number, rh: number, px: number, py: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function rectIntersectsCircle(rx: number, ry: number, rw: number, rh: number, cx: number, cy: number, r: number): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  return Math.hypot(closestX - cx, closestY - cy) < r;
}

function rectanglesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

interface ScoredPlacement {
  readonly name: CornerPlacement;
  readonly left: number;
  readonly top: number;
  readonly rawLeft: number;
  readonly rawTop: number;
  readonly score: number;
}

/** Raw (unclamped) position for a diagonal corner. The popup sits in one of
 *  the four quadrants around the word box, never on its axes:
 *    SE: right of word + below word
 *    SW: left  of word + below word
 *    NE: right of word + above word
 *    NW: left  of word + above word
 *  When a line rect is supplied, the vertical offset clears the whole line
 *  band (not just the word) so same-row neighbors stay uncovered. */
function rawCornerPosition(
  name: CornerPlacement,
  anchor: PopupAnchor,
  popupWidth: number,
  popupHeight: number,
  line: PopupLineRect | null,
): { left: number; top: number } {
  const belowTop = line ? Math.max(anchor.bottom + POPUP_POINTER_GAP_PX, line.bottom + POPUP_POINTER_GAP_PX) : anchor.bottom + POPUP_POINTER_GAP_PX;
  const aboveBottom = line ? Math.min(anchor.top - POPUP_POINTER_GAP_PX, line.top - POPUP_POINTER_GAP_PX) : anchor.top - POPUP_POINTER_GAP_PX;
  switch (name) {
    case 'se': return { left: anchor.right + POPUP_POINTER_GAP_PX, top: belowTop };
    case 'sw': return { left: anchor.left - popupWidth - POPUP_POINTER_GAP_PX, top: belowTop };
    case 'ne': return { left: anchor.right + POPUP_POINTER_GAP_PX, top: aboveBottom - popupHeight };
    case 'nw': return { left: anchor.left - popupWidth - POPUP_POINTER_GAP_PX, top: aboveBottom - popupHeight };
  }
}

/** True when the raw corner fits inside the viewport without any clamping. */
function rawCornerFits(
  rawLeft: number,
  rawTop: number,
  popupWidth: number,
  popupHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return rawLeft >= POPUP_MARGIN_PX
    && rawLeft + popupWidth <= viewportWidth - POPUP_MARGIN_PX
    && rawTop >= POPUP_MARGIN_PX
    && rawTop + popupHeight <= viewportHeight - POPUP_MARGIN_PX;
}

function scoreCorner(
  name: CornerPlacement,
  pos: { left: number; top: number },
  rawLeft: number,
  rawTop: number,
  popupWidth: number,
  popupHeight: number,
  preferredCorners: readonly CornerPlacement[],
  pointer: PopupPointerHint | undefined,
  anchor: PopupAnchor,
  line: PopupLineRect | null,
): number {
  let score = 0;

  // Honour pointer-derived preference (mapped to the two matching corners).
  if (preferredCorners.includes(name)) score -= 50;
  // Default (image-1): SE is the ideal anchor — right+below the word.
  if (preferredCorners.length === 0 && name === 'se') score -= 20;
  // Distance from the raw (unclamped) corner — closer is better.
  score += (Math.abs(pos.left - rawLeft) + Math.abs(pos.top - rawTop)) * 0.5;

  // SOFT: avoid covering the pointer tip (treated as a circle with a small gap).
  if (pointer) {
    const pr = Number.isFinite(pointer.pointerRadius) ? pointer.pointerRadius! : POPUP_DEFAULT_POINTER_RADIUS_PX;
    const pointerMargin = pr + POPUP_POINTER_GAP_PX;
    if (rectContainsPoint(pos.left - pointerMargin, pos.top - pointerMargin, popupWidth + pointerMargin * 2, popupHeight + pointerMargin * 2, pointer.tip.x, pointer.tip.y)) {
      score += 1000;
    }
  }

  // SOFT: avoid covering the orbital badge (circle with a small gap).
  if (pointer?.badgeCenter && pointer.badgeRadius != null && pointer.badgeRadius > 0) {
    const r = pointer.badgeRadius + POPUP_POINTER_GAP_PX;
    if (rectIntersectsCircle(pos.left - POPUP_POINTER_GAP_PX, pos.top - POPUP_POINTER_GAP_PX, popupWidth + POPUP_POINTER_GAP_PX * 2, popupHeight + POPUP_POINTER_GAP_PX * 2, pointer.badgeCenter.x, pointer.badgeCenter.y, r)) {
      score += 500;
    }
  }

  // HARD: never overlap the looked-up word itself.
  const anchorW = anchor.right - anchor.left;
  const anchorH = anchor.bottom - anchor.top;
  if (rectanglesOverlap(pos.left, pos.top, popupWidth, popupHeight, anchor.left, anchor.top, anchorW, anchorH)) {
    score += 2000;
  }

  // HARD: never cover the word's horizontal band (left/right) or vertical
  // column (above/below). A true diagonal clears both; clamping that pushes
  // the popup back onto an axis is penalized so a fitting corner wins.
  const clearsHorizontal = pos.left + popupWidth <= anchor.left || pos.left >= anchor.right;
  const clearsVertical = pos.top + popupHeight <= anchor.top || pos.top >= anchor.bottom;
  if (!clearsHorizontal || !clearsVertical) score += 1500;

  // HARD: never overlap the line/cue band (same-row neighbors). A diagonal
  // corner already clears the line vertically; this guards clamped fallbacks.
  if (line) {
    if (pos.top < line.bottom && pos.top + popupHeight > line.top) {
      score += 1500;
    }
  }

  return score;
}

/**
 * Compute popup position anchored to a token's bounding box.
 *
 * Strategy (4 diagonal corners, image-1 ideal):
 * 1. If a pointer hint is supplied, derive the axis the pointer is coming
 *    from (away from the badge) and map it to the two matching corners.
 * 2. For each of the 4 corners (SE/SW/NE/NW):
 *    - Compute the raw diagonal position (right+below, left+below,
 *      right+above, left+above the word).
 *    - Clamp to the viewport via {@link finalizePosition}.
 *    - Score by: HARD (overlap word +2000, cover a word axis +1500,
 *      overlap line band +1500), SOFT (overlap pointer +1000, overlap
 *      badge +500, distance from raw), and preference (pointer/default SE).
 *    - Strongly prefer corners that fit without clamping (+500 penalty).
 * 3. The lowest score wins. This naturally:
 *    - Never covers the looked-up word (HARD).
 *    - Never covers the word's left/right band or above/below column (HARD)
 *      when any corner fits — i.e. the popup sits in a true diagonal.
 *    - Avoids covering the pointer and orbital badge (SOFT).
 *    - Stays close to the word ("bám sát").
 * 4. Fallback: if every corner violates a HARD constraint (tiny viewport),
 *    the least-bad clamped corner is still chosen.
 */
export function computePopupPosition(
  anchorTop: number,
  anchorLeft: number,
  anchorRight: number,
  anchorBottom: number,
  popupWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  popupHeight: number = POPUP_DEFAULT_HEIGHT_PX,
  pointer?: PopupPointerHint,
  lineRect?: PopupLineRect | null,
): PopupPosition {
  const anchor: PopupAnchor = { top: anchorTop, left: anchorLeft, right: anchorRight, bottom: anchorBottom };
  const line = lineRect ?? null;

  const preferred = pointer ? derivePreferredPlacement(pointer, anchor) : null;
  const preferredCorners = cornersForPreference(preferred);

  // Candidate order: preferred corners first, then the rest with SE prioritized
  // (image-1 default). Deterministic tie-breaking for stable output.
  const allCorners: CornerPlacement[] = ['se', 'sw', 'ne', 'nw'];
  const order: CornerPlacement[] = [
    ...preferredCorners,
    ...allCorners.filter(c => !preferredCorners.includes(c)),
  ];

  let best: ScoredPlacement | null = null;

  for (const name of order) {
    const raw = rawCornerPosition(name, anchor, popupWidth, popupHeight, line);
    const fits = rawCornerFits(raw.left, raw.top, popupWidth, popupHeight, viewportWidth, viewportHeight);
    const clamped = finalizePosition(raw.left, raw.top, popupWidth, popupHeight, viewportWidth, viewportHeight);
    const pos = fits ? { left: clamped.left, top: clamped.top } : clamped;
    const score = scoreCorner(
      name, pos, raw.left, raw.top, popupWidth, popupHeight,
      preferredCorners, pointer, anchor, line,
    );
    const finalScore = fits ? score : score + 500;

    if (!best || finalScore < best.score) {
      best = { name, left: pos.left, top: pos.top, rawLeft: raw.left, rawTop: raw.top, score: finalScore };
    }
  }

  return { left: best!.left, top: best!.top };
}
