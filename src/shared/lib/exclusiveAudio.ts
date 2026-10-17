// shortcut: registry is per JS context (popup, content script, offscreen
// document each hold their own copy); upgrade to background arbitration if
// cross-context overlap ever matters.

let stopActive: (() => void) | null = null;

/** Stop whatever sound is currently playing, if any. */
export function stopExclusiveAudio(): void {
  const stop = stopActive;
  stopActive = null;
  stop?.();
}

/**
 * Stop the current sound and register `stop` as the way to halt the new one.
 * Returns a release function — call it when playback ends on its own so the
 * registry does not hold a stale stopper.
 */
export function claimExclusiveAudio(stop: () => void): () => void {
  stopExclusiveAudio();
  stopActive = stop;
  return () => {
    if (stopActive === stop) stopActive = null;
  };
}
