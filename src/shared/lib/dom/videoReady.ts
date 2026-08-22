// videoReady — gate for "SPA framework finished rendering this video".
// ADR-012: SPA frameworks (Angular on kisskh) render <video> in two phases —
// first mount with src="" (template), then assign the real source (blob: URL)
// after fetch. Injecting foreign elements during phase 1 gets wiped by the
// framework's continued render. Waiting for a real source signal ensures the
// append persists. Covers blob-streaming SPAs (kisskh) and direct-MP4 sites
// (themoviebox.org — readyState>=2 is immediate). Child <source>/<track> src
// also counts: HLS players (hls.js / vidstack) leave video.src empty and set
// currentSrc only after metadata loads, while <track> is already in the DOM.

/** True when the video has a non-empty child <source>/<track> src. */
export function hasRealChildSrc(v: HTMLVideoElement): boolean {
  return !!v.querySelector('source[src]:not([src=""]), track[src]:not([src=""])');
}

/** True when the video element is past the SPA template phase (safe to attach UI). */
export function isVideoReady(v: HTMLVideoElement): boolean {
  return (
    (v.src !== '' && v.src.startsWith('blob:')) ||
    v.currentSrc !== '' ||
    v.readyState >= 2 ||
    hasRealChildSrc(v)
  );
}
