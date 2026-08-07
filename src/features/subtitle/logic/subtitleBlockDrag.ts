// ADR-025: pure drag logic cho subtitle block reposition (trục Y).
// Tách hàm thuần → dễ test, không side effect. O(1).
// Snap-to-point đã bỏ theo yêu cầu: release ở đâu giữ nguyên đó, chỉ clamp.

const MIN_Y = 0;
const MAX_Y = 95;

/** Clamp yOffsetPercent về [0, 95]. */
export function clampYOffset(value: number): number {
  if (Number.isNaN(value)) return MIN_Y;
  return Math.min(Math.max(value, MIN_Y), MAX_Y);
}

/**
 * Convert pixel delta → percent of container height, apply offset, clamp.
 * Không snap — drag tự do, release ở đâu giữ nguyên đó (chỉ clamp 0-95%).
 * @param startOffset - yOffsetPercent lúc bắt đầu drag
 * @param deltaY - pixel delta theo trục Y (pointermove)
 * @param containerHeight - chiều cao container (video) px
 * @returns yOffsetPercent mới (chỉ clamped)
 */
export function dragDeltaToYOffset(
  startOffset: number,
  deltaY: number,
  containerHeight: number,
): number {
  if (containerHeight <= 0) return clampYOffset(startOffset);
  const deltaPercent = (deltaY / containerHeight) * 100;
  return clampYOffset(startOffset + deltaPercent);
}
