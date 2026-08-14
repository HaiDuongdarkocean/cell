// YouTube Split View adapter — isolated-world event bridge (ADR-020 pattern).
//
// Mirror netflixPlayback.ts: isolated world MUST NOT touch YouTube's player
// internals. YouTube JS writes inline pixel sizes on <video>,
// .html5-video-container, and .ytp-chrome-bottom. Isolated-world CSS loses
// to that JS. Isolated world dispatches CustomEvents; youtube-main-world.iife.ts
// (MAIN world) calls #movie_player.setSize(w, h) so video + chrome reflow
// together.
//
// ponytail: 3 thin wrappers. Off YouTube they no-op. Ceiling: if MAIN-world
// listener isn't registered yet, the event no-ops for that one call.

export function isYoutubePage(hostname: string = location.hostname): boolean {
  return hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
}

/** Wrapper height = video height so the panel matches the player, not the tall watch page. */
export function resolveYoutubeSplitViewWrapperHeight(
  videoHeight: number,
  playerHeight: number,
): string {
  const height = videoHeight > 0 ? videoHeight : playerHeight;
  return `${Math.round(Math.max(height, 0))}px`;
}

/** Ask MAIN-world YouTube player to resize video + control chrome to `width`×`height`. */
export function requestYoutubePlayerSize(
  width: number,
  height: number,
  hostname: string = location.hostname,
): void {
  if (!isYoutubePage(hostname)) return;
  if (!(width > 0 && height > 0)) return;
  document.dispatchEvent(new CustomEvent('__YT_SET_SIZE', {
    detail: { width: Math.round(width), height: Math.round(height) },
  }));
}

/** Ask MAIN-world YouTube player to restore the pre-split size. */
export function restoreYoutubePlayerSize(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_RESTORE_SIZE'));
}

/**
 * After Split View layout is in the DOM, measure `stage` and tell YouTube
 * to setSize to that box. Returns a restore that asks YouTube to undo it.
 */
export function applyYoutubeSplitViewLayout(
  stage: HTMLElement,
  hostname: string = location.hostname,
): () => void {
  if (!isYoutubePage(hostname)) return () => undefined;
  const sync = (): void => {
    const rect = stage.getBoundingClientRect();
    requestYoutubePlayerSize(rect.width, rect.height, hostname);
  };
  sync();
  requestAnimationFrame(sync);
  return () => {
    restoreYoutubePlayerSize(hostname);
  };
}
