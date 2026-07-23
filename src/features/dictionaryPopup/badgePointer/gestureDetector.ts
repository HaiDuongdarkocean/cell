/**
 * Double / triple tap detector for the orbital badge.
 *
 * Uses pointer timestamps. A tap window of 300 ms is used to group consecutive
 * taps. Only double and triple taps are emitted; single taps are ignored.
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
  readonly onDoubleTap: () => void;
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
      if (timer) {
        // A previous tap already scheduled a double-tap check.
        clearTimer();
      }

      if (now - lastTapTime > TAP_WINDOW_MS) {
        // Start a new tap sequence.
        tapCount = 1;
      } else {
        tapCount += 1;
      }
      lastTapTime = now;

      if (tapCount === 2) {
        // Wait briefly to see if a third tap arrives.
        timer = setTimeout(() => {
          timer = null;
          tapCount = 0;
          deps.onDoubleTap();
        }, TAP_WINDOW_MS);
        return false;
      }

      if (tapCount >= 3) {
        // Triple tap confirmed; reset immediately.
        tapCount = 0;
        lastTapTime = 0;
        deps.onTripleTap();
        return true;
      }

      return false;
    },

    destroy(): void {
      reset();
    },
  };
}
