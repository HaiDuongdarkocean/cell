/**
 * Multi-tap detector for the orbital badge.
 *
 * Uses pointer timestamps. A tap window of 300 ms groups consecutive taps.
 * Single and double taps are emitted after the window expires — delayed so a
 * higher tap count can cancel them. Triple tap fires immediately on the third
 * tap (there is no higher count to wait for). This prevents a multi-tap from
 * firing lower-count actions on touch screens where each tap fires a click
 * event instantly.
 *
 * Tap mapping (see createOrbitalBadge for the actions bound to each):
 * - 1 tap: onSingleTap (open settings panel — open-only, never toggles)
 * - 2 taps: onDoubleTap (cycle vertical presets)
 * - 3 taps: onTripleTap (cycle horizontal presets)
 */

const TAP_WINDOW_MS = 300;

export interface GestureDetector {
  /** Call on pointerdown. */
  onPointerDown(timestamp?: number): void;
  /** Call on pointerup. Returns true if the event was consumed (reset happened). */
  onPointerUp(timestamp?: number): boolean;
  /** Reset any pending tap sequence (clears the timer + tap count). Used when
   *  a tap is handled out-of-band (e.g. instant open when collapsed) so a
   *  later tap does not count as a continuation. */
  reset(): void;
  /** Destroy clears any pending timer. */
  destroy(): void;
}

export interface GestureDetectorDeps {
  /** Fired after TAP_WINDOW_MS if no second tap arrives. */
  readonly onSingleTap: () => void;
  /** Fired after TAP_WINDOW_MS if no third tap arrives. */
  readonly onDoubleTap: () => void;
  /** Fired immediately on the third tap. */
  readonly onTripleTap: () => void;
}

export function createGestureDetector(deps: GestureDetectorDeps): GestureDetector {
  let tapCount = 0;
  let lastTapTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function reset(): void {
    tapCount = 0;
    lastTapTime = 0;
    clearTimer();
  }

  return {
    onPointerDown(_timestamp?: number): void {
      // No-op: state advances on pointerup to avoid counting drag/press holds.
    },

    onPointerUp(timestamp?: number): boolean {
      const now = timestamp ?? performance.now();
      clearTimer();

      if (now - lastTapTime > TAP_WINDOW_MS) {
        // Start a new tap sequence.
        tapCount = 1;
      } else {
        tapCount += 1;
      }
      lastTapTime = now;

      if (tapCount === 1) {
        timer = setTimeout(() => {
          timer = null;
          tapCount = 0;
          deps.onSingleTap();
        }, TAP_WINDOW_MS);
        return false;
      }

      if (tapCount === 2) {
        timer = setTimeout(() => {
          timer = null;
          tapCount = 0;
          deps.onDoubleTap();
        }, TAP_WINDOW_MS);
        return false;
      }

      // Triple tap confirmed (no higher count to wait for); reset immediately.
      tapCount = 0;
      lastTapTime = 0;
      deps.onTripleTap();
      return true;
    },

    reset,

    destroy(): void {
      reset();
    },
  };
}
