// Child iframe context detection.
//
// Cell content scripts run in all frames (`all_frames: true`). Many subtitle
// flows differ between the top-level page and a cross-origin iframe that hosts
// the actual player (e.g. AnimeKai/megaplay, moviepire/vidnest). This tiny
// helper is the single source of truth for that branch.

/** True when the current frame is a child iframe (not the top frame). */
export function isChildFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin window.top access throws — definitely a child frame.
    return true;
  }
}
