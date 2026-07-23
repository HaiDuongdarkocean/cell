/**
 * Pure geometry for the orbital badge pointer.
 *
 * Screen coordinate system: x grows right, y grows down.
 * For direction math we invert y so that "up" is positive; this makes
 * `Math.atan2(-dy, dx)` behave like standard polar coordinates:
 * 0 = right, PI/2 = up, PI = left, 3PI/2 = down.
 */

export type PointerPreset = 'top' | 'left' | 'right' | 'bottom' | 'center';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Gap between badge edge and pointer edge in px. */
export const POINTER_EDGE_GAP_PX = 4;

/** Compute pointer center offset from badge center so the pointer sits just outside the badge. */
export function computePointerOffset(
  badgeSize: number,
  pointerSize: number,
  gap: number = POINTER_EDGE_GAP_PX,
): number {
  return badgeSize / 2 + pointerSize / 2 + gap;
}

/** @deprecated Use computePointerOffset + badge/pointer sizes. Kept for tests that pass an explicit radius. */
export const DEFAULT_POINTER_RADIUS_PX = 18;

/** Convert radians to degrees in [0, 360). */
function normalizeAngleDeg(rad: number): number {
  let deg = (rad * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

/**
 * Map a direction angle to the nearest pointer preset.
 *
 * Sectors (clockwise from right, polar y-up):
 * - right:  [315, 360) ∪ [0, 45)
 * - top:    [45, 135)
 * - left:   [135, 225]
 * - bottom: (225, 315)   // downward-ish.
 */
export function angleToPreset(angleRad: number): PointerPreset {
  const deg = normalizeAngleDeg(angleRad);
  if (deg >= 315 || deg < 45) return 'right';
  if (deg >= 45 && deg < 135) return 'top';
  if (deg >= 135 && deg <= 225) return 'left';
  return 'bottom';
}

/** Compute the pointer tip offset from the badge center for a given preset. */
export function getPresetOffset(preset: PointerPreset, radius: number = DEFAULT_POINTER_RADIUS_PX): Point {
  switch (preset) {
    case 'top': return { x: 0, y: -radius };
    case 'left': return { x: -radius, y: 0 };
    case 'right': return { x: radius, y: 0 };
    case 'bottom': return { x: 0, y: radius };
    case 'center': return { x: 0, y: 0 };
  }
}

/**
 * Compute the angle (radians) from the badge to the viewport center.
 * Returns 0 when badge and center coincide (rare, defaults to right).
 */
export function angleToViewportCenter(badgeX: number, badgeY: number, viewportWidth: number, viewportHeight: number): number {
  const dx = viewportWidth / 2 - badgeX;
  // Invert y so that "up" is positive in polar terms.
  const dy = -(viewportHeight / 2 - badgeY);
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(dy, dx);
}

/** Compute the pointer tip coordinate given badge center + preset. */
export function getPointerTip(badgeCenter: Point, preset: PointerPreset, radius: number = DEFAULT_POINTER_RADIUS_PX): Point {
  const offset = getPresetOffset(preset, radius);
  return { x: badgeCenter.x + offset.x, y: badgeCenter.y + offset.y };
}
