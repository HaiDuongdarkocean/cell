/**
 * VDLT-Predict: map scroll delta to an asymmetric IntersectionObserver
 * rootMargin so the overscan zone is deep in the scroll direction and shallow
 * behind it. This lets prepare-ahead run for content the user is scrolling
 * toward, while soft-unbind reclaims DOM spans behind them.
 *
 * Pure and side-effect free — unit-testable without a DOM. The controller
 * calls this on a rAF-coalesced scroll listener and recreates the
 * ViewportTracker with the returned rootMargin.
 */

export type ScrollDirection = 'up' | 'down' | 'none';

export interface ResolveScrollPredictMarginInput {
  /** Current scrollY (window.scrollY / scrollTop). */
  readonly scrollY: number;
  /** Previous scrollY sample. */
  readonly lastScrollY: number;
  /** Visible viewport height (window.innerHeight). */
  readonly viewportHeight: number;
  /** Multiplier of viewportHeight for the ahead zone. Default 1.0. */
  readonly aheadScreens?: number;
  /** Multiplier of viewportHeight for the behind zone. Default 0.25. */
  readonly behindScreens?: number;
  /** Minimum ahead pixels (floor for short mobile viewports). Default 600. */
  readonly minAheadPx?: number;
  /** Minimum behind pixels. Default 150. */
  readonly minBehindPx?: number;
  /** Ignore deltas smaller than this to avoid thrash on micro-bounce. Default 16. */
  readonly hysteresisPx?: number;
  /** Last known direction — used to keep margin stable through sub-threshold deltas. */
  readonly lastDirection?: ScrollDirection;
}

export interface ResolveScrollPredictMarginResult {
  /** CSS rootMargin string: "top right bottom left". */
  readonly rootMargin: string;
  /** Resolved scroll direction. */
  readonly direction: ScrollDirection;
}

const DEFAULT_AHEAD_SCREENS = 1.0;
const DEFAULT_BEHIND_SCREENS = 0.25;
const DEFAULT_MIN_AHEAD_PX = 600;
const DEFAULT_MIN_BEHIND_PX = 150;
const DEFAULT_HYSTERESIS_PX = 16;

/** Pure: map scroll delta to asymmetric IntersectionObserver rootMargin. */
export function resolveScrollPredictMargin(
  input: ResolveScrollPredictMarginInput,
): ResolveScrollPredictMarginResult {
  const {
    scrollY,
    lastScrollY,
    viewportHeight,
    aheadScreens = DEFAULT_AHEAD_SCREENS,
    behindScreens = DEFAULT_BEHIND_SCREENS,
    minAheadPx = DEFAULT_MIN_AHEAD_PX,
    minBehindPx = DEFAULT_MIN_BEHIND_PX,
    hysteresisPx = DEFAULT_HYSTERESIS_PX,
    lastDirection = 'none',
  } = input;

  const delta = scrollY - lastScrollY;
  let direction: ScrollDirection;
  if (delta > hysteresisPx) direction = 'down';
  else if (delta < -hysteresisPx) direction = 'up';
  else direction = lastDirection;

  const aheadPx = Math.max(aheadScreens * viewportHeight, minAheadPx);
  const behindPx = Math.max(behindScreens * viewportHeight, minBehindPx);

  // rootMargin = "top right bottom left". Deep ahead in the scroll direction,
  // shallow behind. When direction is none without a prior direction, use an
  // isotropic large margin so the first paint covers both ways.
  let topPx: number;
  let bottomPx: number;
  if (direction === 'down') {
    topPx = behindPx;
    bottomPx = aheadPx;
  } else if (direction === 'up') {
    topPx = aheadPx;
    bottomPx = behindPx;
  } else {
    topPx = aheadPx;
    bottomPx = aheadPx;
  }

  return {
    rootMargin: `${Math.round(topPx)}px 0 ${Math.round(bottomPx)}px 0`,
    direction,
  };
}
