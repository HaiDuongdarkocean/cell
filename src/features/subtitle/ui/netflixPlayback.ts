// Netflix playback routing — ADR-030 M7375 fix.
//
// Netflix anti-tampering throws M7375 ("Pardon the interruption") when
// scripts set `video.currentTime` / `video.play()` / `video.pause()`
// directly. Route through the Netflix player API instead via CustomEvents
// dispatched to the MAIN-world script (netflix-main-world.iife.ts), which
// has access to `netflix.appContext.state.playerApp.getAPI().videoPlayer`.
//
// Verified on Netflix 2026-07-13:
//   `video.currentTime = 60` → M7375 (video dies, must reload)
//   `player.seek(120000)`    → OK (video plays normally)
//
// ponytail: 3 thin wrappers. Non-Netflix sites fall back to direct
// HTMLMediaElement API (the original behavior). Ceiling: if MAIN-world
// listener isn't registered yet (player not ready), the CustomEvent
// no-ops — caller's intent is lost for that one call. Acceptable because
// user-initiated seek/play/pause happens after player load.

/** True on www.netflix.com (where netflix-main-world.iife.ts is injected). */
export function isNetflixPage(): boolean {
  return location.hostname.includes('netflix.com');
}

/**
 * Seek video to `targetSeconds`. On Netflix, dispatches `__NF_SEEK`
 * CustomEvent with `{ detail: targetMs }` → MAIN-world `player.seek(ms)`.
 * Off Netflix, sets `video.currentTime` directly (original behavior).
 */
export function seekVideo(video: HTMLVideoElement, targetSeconds: number): void {
  if (isNetflixPage()) {
    document.dispatchEvent(new CustomEvent('__NF_SEEK', { detail: targetSeconds * 1000 }));
    return;
  }
  video.currentTime = targetSeconds;
}

/**
 * Play video. On Netflix, dispatches `__NF_PLAY` → MAIN-world `player.play()`.
 * Off Netflix, calls `video.play()` directly. Returns the same Promise shape
 * as `HTMLMediaElement.play()` so callers can `.catch()` autoplay blocks.
 */
export function playVideo(video: HTMLVideoElement): Promise<void> {
  if (isNetflixPage()) {
    document.dispatchEvent(new CustomEvent('__NF_PLAY'));
    // Netflix player.play() is fire-and-forget (no play promise exposed).
    // Resolve immediately — caller's .catch() is a no-op on Netflix.
    return Promise.resolve();
  }
  return video.play();
}

/**
 * Pause video. On Netflix, dispatches `__NF_PAUSE` → MAIN-world `player.pause()`.
 * Off Netflix, calls `video.pause()` directly.
 */
export function pauseVideo(video: HTMLVideoElement): void {
  if (isNetflixPage()) {
    document.dispatchEvent(new CustomEvent('__NF_PAUSE'));
    return;
  }
  video.pause();
}

/**
 * ADR-031: Netflix UI z-index fix — move Cell UI elements to `.watch-video`
 * (parent of Netflix's active/inactive wrappers) + set z-index max.
 *
 * Netflix has 2 sibling wrappers (`active`/`inactive`, class
 * `default-ltr-iqcdef-cache-fntwn3`). On hover, Netflix activates the
 * `active` wrapper which covers the `inactive` one — blocking clicks on
 * Cell UI appended into the `inactive` branch. Moving UI to their common
 * parent (`.watch-video`, position:fixed) + z-index 2147483645 puts Cell
 * UI above both wrappers in the same stacking context, but below the
 * dictionary popup (2147483647) and Card Creator (2147483646).
 *
 * Theme tokens (`--color-surface` etc.) are scoped to `[data-theme]`
 * boundaries (themeTokens.ts). The original container carries
 * `data-theme="dark"`, but `.watch-video` does not. We copy the attribute
 * so CSS variables still resolve after re-parenting.
 *
 * Non-Netflix: no-op (UI stays in original container).
 *
 * @param el - Top-level Cell UI element (subtitle-block, toolbar, panel, etc.)
 * @param container - Original video container (source of `data-theme`)
 */
export function mountToWatchVideo(el: HTMLElement, container: HTMLElement): void {
  if (!isNetflixPage()) return;
  const watchVideo = document.querySelector('.watch-video');
  if (!watchVideo || watchVideo === el.parentElement) return;
  const theme = container.getAttribute('data-theme') ?? 'dark';
  el.setAttribute('data-theme', theme);
  watchVideo.appendChild(el);
  el.style.zIndex = '2147483645';
}
