// ADR-025: pure drag logic cho subtitle block reposition (trục Y).
// Tách hàm thuần → dễ test, không side effect. O(1).

const MIN_Y = 0;
const MAX_Y = 95;
const SNAP_POINTS = [25, 50, 75];
const SNAP_THRESHOLD = 8; // percent — snap nếu trong ±8% của snap point

/** Clamp yOffsetPercent về [0, 95]. */
export function clampYOffset(value: number): number {
  if (Number.isNaN(value)) return MIN_Y;
  return Math.min(Math.max(value, MIN_Y), MAX_Y);
}

/** Snap về 25/50/75% nếu trong SNAP_THRESHOLD, ngược lại giữ nguyên. */
export function snapYOffset(value: number): number {
  for (const point of SNAP_POINTS) {
    if (Math.abs(value - point) <= SNAP_THRESHOLD) return point;
  }
  return value;
}

/**
 * Convert pixel delta → percent of container height, apply offset, clamp, snap.
 * @param startOffset - yOffsetPercent lúc bắt đầu drag
 * @param deltaY - pixel delta theo trục Y (pointermove)
 * @param containerHeight - chiều cao container (video) px
 * @returns yOffsetPercent mới (clamped + snapped)
 */
export function dragDeltaToYOffset(
  startOffset: number,
  deltaY: number,
  containerHeight: number,
): number {
  if (containerHeight <= 0) return clampYOffset(startOffset);
  const deltaPercent = (deltaY / containerHeight) * 100;
  return snapYOffset(clampYOffset(startOffset + deltaPercent));
}
