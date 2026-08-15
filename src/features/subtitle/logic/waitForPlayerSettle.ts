import { findPlayerContainer } from './findPlayerContainer';

export const SETTLE_FRAMES = 2;
export const SETTLE_MAX_WAIT_MS = 2000;

export function updateStableCount(
  prevW: number,
  prevH: number,
  currW: number,
  currH: number,
  currentStable: number,
): number {
  return currW === prevW && currH === prevH ? currentStable + 1 : 0;
}

export function waitForPlayerSettle(
  onSettled: () => void,
  maxWaitMs = SETTLE_MAX_WAIT_MS,
): () => void {
  let lastW = -1;
  let lastH = -1;
  let stableFrames = 0;
  let cancelled = false;
  let rafId = 0;
  let startTime = 0;

  const cleanup = (): void => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };

  const poll = (now: number): void => {
    if (cancelled) return;
    if (!startTime) startTime = now;
    if (now - startTime > maxWaitMs) {
      cleanup();
      onSettled();
      return;
    }
    const player = findPlayerContainer();
    if (!player) {
      rafId = requestAnimationFrame(poll);
      return;
    }
    const rect = player.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    stableFrames = updateStableCount(lastW, lastH, w, h, stableFrames);
    lastW = w;
    lastH = h;
    if (stableFrames >= SETTLE_FRAMES) {
      cleanup();
      onSettled();
      return;
    }
    rafId = requestAnimationFrame(poll);
  };

  rafId = requestAnimationFrame(poll);
  return cleanup;
}
