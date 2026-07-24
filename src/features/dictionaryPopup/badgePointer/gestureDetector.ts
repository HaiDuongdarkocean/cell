/**
 * Multi-tap detector for the orbital badge.
 *
 * Uses pointer timestamps. A tap window of 300 ms is used to group consecutive
 * taps. Single, double, triple, and quadruple taps are all emitted after the
 * tap window expires — each action is delayed so that a higher tap count can
 * cancel it. This prevents a multi-tap from firing lower-count actions on
 * touch screens where each tap fires a click event immediately.
 *
 * Tap mapping:
 * - 1 tap: onSingleTap (no-op for panel — used for future single-tap actions)
 * - 2 taps: onDoubleTap (cycle vertical presets)
 * - 3 taps: onTripleTap (cycle horizontal presets)
 * - 4 taps: onQuadrupleTap (open settings panel)
 */

const TAP_WINDOW_MS = 300;

export interface GestureDetector {
  /** Call on pointerdown. */
  onPointerDown(timestamp?: number): void;
  /** Call on pointerup. Returns true if the event was consumed (reset happened). */
  onPointerUp(timestamp?: number): boolean;
  /** Destroy clears any pending timer. */
  destroy(): void;
}

export interface GestureDetectorDeps {
  /** Fired after TAP_WINDOW_MS if no second tap arrives. */
  readonly onSingleTap: () => void;
  /** Fired after TAP_WINDOW_MS if no third tap arrives. */
  readonly onDoubleTap: () => void;
  /** Fired after TAP_WINDOW_MS if no fourth tap arrives. */
  readonly onTripleTap: () => void;
  /** Fired immediately on the fourth tap. */
  readonly onQuadrupleTap: () => void;
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

      if (tapCount === 3) {
        timer = setTimeout(() => {
          timer = null;
          tapCount = 0;
          deps.onTripleTap();
        }, TAP_WINDOW_MS);
        return false;
      }

      // Quadruple tap confirmed; reset immediately.
      tapCount = 0;
      lastTapTime = 0;
      deps.onQuadrupleTap();
      return true;
    },

    destroy(): void {
      reset();
    },
  };
}
