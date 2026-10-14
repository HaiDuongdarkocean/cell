// YouTube host facts for player discovery — the one shared-lib module that
// knows YouTube selectors (netflixPlayback.ts precedent). Isolated-world
// DOM reads only; player-API calls live in youtube-main-world.iife.ts.

export function isYoutubePage(hostname: string = location.hostname): boolean {
  return hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
}

// #movie_player is the real player shell — it owns native controls + the
// video. The generic same-size walk overshoots to #player, a layout wrapper
// with no controls, so the bounds effect walks #cinematics-container instead
// of .html5-video-container → video height collapses to 0.
//
// Structural escape: m.youtube's #player.player-size derives its box from
// %-padding (content height 0) — #movie_player is then a floating surface,
// not the flow box, and wrapping it collapses the stage to h:0. Returning
// null lets the generic walk reach the outer same-size shell
// (#player-container-id) instead.
export function pickYoutubePlayerShell(video: HTMLVideoElement): HTMLElement | null {
  const moviePlayer = document.getElementById('movie_player');
  if (!moviePlayer || !moviePlayer.contains(video)) return null;
  const parent = moviePlayer.parentElement;
  const parentHeight = parent ? parseFloat(getComputedStyle(parent).height) : 0;
  if (Number.isFinite(parentHeight) && parentHeight <= 1) return null;
  return moviePlayer;
}

// m.youtube keeps native controls + scrim as siblings of #player inside
// #player-container-id — no z-index inside the video subtree can paint
// above them (#movie_player is a z:0 stacking context, so a z:10000 root
// inside it still loses hit-testing to the control overlay siblings). The
// Tihoka root must be a direct child of the shared parent: its z-overlay-video
// beats every control sibling regardless of mount order, even when the
// controls subtree mounts later. The same-size guard keeps inset:0 anchored
// to the video box; divergence falls back to the nearest container.
const OVERLAY_MOUNT_TOLERANCE = 0.1;

export function pickYoutubeOverlayMount(video: HTMLVideoElement): HTMLElement | null {
  const shell = document.getElementById('player-container-id');
  if (!shell || !shell.contains(video)) {
    return null;
  }
  const videoRect = video.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  if (videoRect.width <= 0 || videoRect.height <= 0) return null;
  const wDiff = Math.abs(shellRect.width - videoRect.width) / videoRect.width;
  const hDiff = Math.abs(shellRect.height - videoRect.height) / videoRect.height;
  if (wDiff > OVERLAY_MOUNT_TOLERANCE || hDiff > OVERLAY_MOUNT_TOLERANCE) return null;
  return shell;
}
