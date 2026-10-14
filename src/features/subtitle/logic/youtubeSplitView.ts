// YouTube Split View adapter — isolated-world host behavior (ADR-020).
// youtube-main-world.iife.ts (MAIN world) owns YouTube-internal CSS and
// player APIs; this module holds the isolated side: the hostname gate, the
// split-view height policy, and the CustomEvents driving the bridge.
// Off YouTube every export is a no-op / false — callers stay host-agnostic.
import { isYoutubePage } from '@/shared/lib/dom/youtubePlayer';

export { isYoutubePage };

// The MAIN-world CSS bridge owns the video-fill chain inside the stage on
// YouTube (.ytp-*, .player-size, .html5-video-container) — the generic
// fill loop must not touch those intermediates.
export function youtubeSplitViewOwnsFill(hostname: string = location.hostname): boolean {
  return isYoutubePage(hostname);
}

// The insert parent hands the shell a real definite height (~the player's
// own box) → the wrapper may use height:100% so it follows resizes instead
// of freezing at open-time px. Padding-driven parents (computed height ≤1)
// and oversized parents (body-level columns) don't qualify.
export function youtubeFollowsParentSlot(
  insertParent: HTMLElement,
  playerHeight: number,
  hostname: string = location.hostname,
): boolean {
  if (!isYoutubePage(hostname)) return false;
  const computedHeight = parseFloat(getComputedStyle(insertParent).height);
  return (
    Number.isFinite(computedHeight) &&
    computedHeight > 1 &&
    insertParent.getBoundingClientRect().height <= playerHeight * 1.1
  );
}

// Wrapper cssText variant: height needs !important so the flex parent can't
// stretch the wrapper to full row height (panel would tower over the video);
// flex:0 0 auto fixes the footprint instead of growing into it.
export function youtubeSplitViewWrapperCss(wrapperHeightStyle: string, anchorCss: string): string {
  return `display:flex;flex-direction:row;height:${wrapperHeightStyle}!important;flex:0 0 auto;overflow:hidden;${anchorCss}`;
}

// Wrapper height for the live layout. AC-4.9: the slot height is the one the
// page reserved BEFORE the panel ate width — never re-derive it from the
// post-panel stage width (that shrinks the slot and pulls the feed up).
// Out-of-flow shells measure their live flow-slot keeper (m.youtube's
// .player-placeholder reflows on rotation); without a keeper, re-derive from
// live stage width + video aspect so orientation changes still re-fit.
export function youtubeSplitViewLiveHeight(options: {
  shellOutOfFlow: boolean;
  stageWidth: number;
  videoAspect: number;
  followsParent: boolean;
  fallbackHeight: string;
  measureSlotHeight?: () => number;
  clampVisiblePx: (px: number) => number;
}): string {
  if (options.shellOutOfFlow) {
    const slotHeight = options.measureSlotHeight?.() ?? 0;
    const px = slotHeight > 0
      ? slotHeight
      : options.stageWidth / options.videoAspect;
    return `${options.clampVisiblePx(Math.round(px))}px`;
  }
  return options.followsParent ? '100%' : options.fallbackHeight;
}

export function applyYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_APPLY_CSS'));
}

export function removeYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_REMOVE_CSS'));
}
