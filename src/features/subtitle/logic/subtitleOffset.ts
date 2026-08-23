/**
 * Subtitle time offset — pure logic functions (ADR-019 V2 simplified).
 *
 * V2 Direct Offset (2026-07-05, drop lazy/auto-commit/badge):
 * - User bấm offset → apply NGAY + persist NGAY (no lazy mode)
 * - Offset applied at search level: effectiveTime = currentTime + offsetMs
 * - No badge, no auto-commit timer, no "xem thử" concept
 *
 * Pure functions only — no DOM, no side effects, no timers.
 * UI convert sang giây, internal ms (khớp SrtCue).
 *
 * @see docs/adr/019-subtitle-time-offset.md (Amendment V2)
 */

/**
 * Parse user input (giây) → ms.
 * Accept: "0.7", "1.5", "-0.5", "0.7s", "  2  ".
 * Reject (return null): "abc", "", Infinity, NaN.
 *
 * @param input - User input string (giây, optional "s" suffix)
 * @returns offset in ms, or null if invalid
 */
export function parseOffsetInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Strip optional "s" suffix (case-insensitive)
  const cleaned = trimmed.endsWith('s') || trimmed.endsWith('S')
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  if (cleaned === '') return null;

  const seconds = Number(cleaned);
  if (!Number.isFinite(seconds)) return null;

  const ms = Math.round(seconds * 1000);

  return ms;
}

/**
 * Clamp offset to reasonable range. Always returns a number (never null).
 * Rounds to integer ms. No artificial ±60s limit — user can offset freely.
 *
 * @param ms - offset in ms (any range)
 * @returns rounded offset in ms
 */
export function clampOffsetMs(ms: number): number {
  return Math.round(ms);
}

/**
 * Apply offset to currentTime for findCurrentLine.
 * +offset = sub muộn hơn = search time tăng (find cue xuất hiện sau).
 * -offset = sub sớm hơn = search time giảm.
 *
 * @param currentTimeMs - video currentTime in ms
 * @param offsetMs - offset in ms
 * @returns effective time in ms (currentTime + offset)
 */
export function effectiveTime(currentTimeMs: number, offsetMs: number): number {
  return currentTimeMs + offsetMs;
}

/**
 * Format ms → display string (giây).
 * 0 → "0s", 700 → "+0.7s", -500 → "-0.5s", 1000 → "+1s" (trim trailing .0).
 *
 * @param ms - offset in ms
 * @returns formatted string with sign + seconds + "s" unit
 */
export function formatOffsetDisplay(ms: number): number | string {
  if (ms === 0) return '0s';

  const seconds = ms / 1000;
  const sign = ms > 0 ? '+' : '-';
  const absSeconds = Math.abs(seconds);

  // Trim trailing .0 — 1.0s → 1s, 0.5s → 0.5s
  const formatted = absSeconds % 1 === 0
    ? String(absSeconds)
    : String(absSeconds);

  return `${sign}${formatted}s`;
}
