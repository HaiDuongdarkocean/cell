const HIDE_STYLE_ID = 'cell-native-caption-hide';

const NATIVE_CAPTION_SELECTORS = [
  '.ytp-caption-window-container',
  '.caption-window',
  '.player-timedtext',
  '.jw-captions',
  '.vjs-text-track-display',
];

/**
 * Suppresses the host player's own caption rendering while Cell's subtitle
 * overlay is active, so native tracks never double-render over Cell cues.
 * Two rendering paths are covered:
 * - DOM caption windows (YouTube `.ytp-caption-window-container`, Netflix
 *   `.player-timedtext`, JWPlayer/Video.js layers) — hidden via an injected
 *   page style; the caption module keeps loading so timedtext harvest still
 *   works.
 * - UA-rendered `<track>` cues inside the <video> — `mode` flipped to
 *   'hidden' (cues stay loaded for extraction; 'disabled' would unload).
 * Returns a cleanup that removes the style and restores track modes.
 */
export function suppressNativeCaptions(
  doc: Document,
  video: HTMLVideoElement,
): () => void {
  const style = doc.createElement('style');
  style.id = HIDE_STYLE_ID;
  style.textContent = `${NATIVE_CAPTION_SELECTORS.join(',')} { display: none !important; }`;
  doc.head.appendChild(style);

  const hiddenTracks: TextTrack[] = [];
  const hideShowingTracks = (): void => {
    for (const track of video.textTracks) {
      if (track.mode === 'showing') {
        track.mode = 'hidden';
        hiddenTracks.push(track);
      }
    }
  };
  hideShowingTracks();
  video.textTracks.addEventListener?.('addtrack', hideShowingTracks);

  return () => {
    video.textTracks.removeEventListener?.('addtrack', hideShowingTracks);
    for (const track of hiddenTracks) {
      if (track.mode === 'hidden') track.mode = 'showing';
    }
    style.remove();
  };
}
