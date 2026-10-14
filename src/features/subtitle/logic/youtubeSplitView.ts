// YouTube Split View adapter — isolated-world host behavior (ADR-020).
// youtube-main-world.iife.ts (MAIN world) owns YouTube-internal CSS and
// player APIs; this module holds the isolated side: the CustomEvents
// driving the bridge. Off YouTube every export is a no-op — callers stay
// host-agnostic.
import { isYoutubePage } from '@/shared/lib/dom/youtubePlayer';

export { isYoutubePage };

export function applyYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_APPLY_CSS'));
}

export function removeYoutubeSplitViewCss(hostname: string = location.hostname): void {
  if (!isYoutubePage(hostname)) return;
  document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_REMOVE_CSS'));
}
