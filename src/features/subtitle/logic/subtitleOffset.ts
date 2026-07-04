/**
 * Subtitle time offset — pure logic functions + state type (ADR-019).
 *
 * V1 Manual Offset Management (revised 2026-07-04, drop C2):
 * - User bấm offset → lazy mode (apply all ngay, chưa persist)
 * - 2 phút wall-clock không action → auto-commit (persist per-URL)
 * - Offset applied at search level: effectiveTime = currentTime + offsetMs
 *
 * Pure functions only — no DOM, no side effects, no timers.
 * UI convert sang giây, internal ms (khớp SrtCue).
 *
 * @see docs/specs/spec-subtitle-time-offset.md
 * @see docs/adr/019-subtitle-time-offset.md
 */

/** Offset mode — lazy = apply all ngay (chưa persist), committed = đã persist. */
export type OffsetMode = 'lazy' | 'committed';

/** Pure state — không chứa DOM, không chứa timer handle. */
export interface OffsetState {
  readonly valueMs: number;        // current offset (ms) — UI convert sang giây
  readonly mode: OffsetMode;
  readonly lastActionAt: number;   // Date.now() lúc action gần nhất (wall-clock, ms) — for 2-phút auto-commit timer
}

/** Initial state — committed, offset 0. */
export const INITIAL_OFFSET_STATE: OffsetState = {
  valueMs: 0,
  mode: 'committed',
  lastActionAt: 0,
};

/** Max offset ±60s (ms). Ngoài khoảng này = sub hỏng, không phải offset. */
const MAX_OFFSET_MS = 60_000;

/** Auto-commit timeout — 2 phút (ms) wall-clock không action. */
export const AUTO_COMMIT_MS = 120_000;

/**
 * Parse user input (giây) → ms.
 * Accept: "0.7", "1.5", "-0.5", "0.7s", "  2  ".
 * Reject (return null): "abc", "", out-of-range ±60s, Infinity, NaN.
 *
 * @param input - User input string (giây, optional "s" suffix)
 * @returns offset in ms, or null if invalid/out-of-range
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
  if (ms < -MAX_OFFSET_MS || ms > MAX_OFFSET_MS) return null;

  return ms;
}

/**
 * Clamp offset to ±60s. Always returns a number (never null).
 * Use for internal accumulate (button clicks). Rounds to integer ms.
 *
 * @param ms - offset in ms (any range)
 * @returns clamped offset in ms [-60000, 60000]
 */
export function clampOffsetMs(ms: number): number {
  const rounded = Math.round(ms);
  if (rounded > MAX_OFFSET_MS) return MAX_OFFSET_MS;
  if (rounded < -MAX_OFFSET_MS) return -MAX_OFFSET_MS;
  return rounded;
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

// NOTE: isInLazyWindow() + LAZY_WINDOW_MS đã xóa 2026-07-04 (C2 dropped).
// Lazy mode = apply all ngay (chưa persist), không window constraint. Xem ADR-019 Amendment.

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

/**
 * Check if should auto-commit: lazy mode AND > 2 phút since last action.
 *
 * @param state - current offset state
 * @param nowMs - current Date.now() in ms
 * @returns true if mode=lazy AND (nowMs - lastActionAt) >= AUTO_COMMIT_MS
 */
export function shouldAutoCommit(state: OffsetState, nowMs: number): boolean {
  if (state.mode !== 'lazy') return false;
  return nowMs - state.lastActionAt >= AUTO_COMMIT_MS;
}
