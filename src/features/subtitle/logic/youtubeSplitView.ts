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

/** Tell MAIN-world YouTube player Split View fully closed — clear stored size. */
export function closeYoutubeSplitView(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  restoreYoutubePlayerSize(hostname);
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_CLOSE'));
}

/**
 * Ask MAIN-world YouTube adapter to inject YouTube-specific CSS overrides for
 * split view (object-fit, .ytp-chrome-bottom width, progress bar widths).
 * The CSS targets [data-cell-split-view="stage"] descendants — the stage
 * element is created by isolated-world React but lives in light DOM, so MAIN
 * world CSS can target it. No-op off YouTube.
 */
export function applyYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_APPLY_CSS'));
}

/** Ask MAIN-world YouTube adapter to remove split view CSS overrides. */
export function removeYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_REMOVE_CSS'));
}

/**
 * After Split View layout is in the DOM, measure `stage` and tell YouTube
 * to setSize to that box. Returns a restore that asks YouTube to undo it.
 * Uses double-rAF so flex layout settles before measuring (fullscreen
 * stageCell is 0px until flex resolves).
 */
export function applyYoutubeSplitViewLayout(
  stage: HTMLElement,
  hostname: string = location.hostname,
): () => void {
  if (!isYoutubePage(hostname)) return () => undefined;
  const sync = (): void => {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      requestYoutubePlayerSize(rect.width, rect.height, hostname);
    }
  };
  // Double-rAF: first frame lays out flex children, second frame gives
  // stable getBoundingClientRect (single rAF can still read pre-layout).
  requestAnimationFrame(() => requestAnimationFrame(sync));
  return () => {
    restoreYoutubePlayerSize(hostname);
  };
}
