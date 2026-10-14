/**
 * Top-frame registry of direct-child iframes whose document hosts a playable
 * <video>. Child frames announce presence via postMessage (__Tihoka_IFRAME_MEDIA);
 * intermediate frames forward upward, so entries always key the DIRECT child
 * iframe of this document.
 *
 * Drives: universal panel Video toggle enablement (hasMedia) and hiding the
 * top-frame orbital badge when a fullscreen/PM host contains a video iframe.
 */
export const IFRAME_MEDIA_CHANGED_EVENT = 'tihoka:iframe-media-changed';
/** Re-eval event for PM transitions that don't fire fullscreenchange
 *  (the CSS-fallback path sets data-tihoka-player-mode-host, not fullscreen). */
export const IFRAME_PM_CHANGED_EVENT = 'tihoka:iframe-pm-changed';

const videoIframes = new Set<HTMLIFrameElement>();

export function setIframeVideo(iframe: HTMLIFrameElement, present: boolean): void {
  if (present) videoIframes.add(iframe);
  else videoIframes.delete(iframe);
}

export function iframeHasVideo(iframe: HTMLIFrameElement): boolean {
  return videoIframes.has(iframe);
}

/** True when any still-connected child iframe reported a video. Prunes
 *  entries for iframes removed from the document. */
export function hasIframeVideo(): boolean {
  for (const el of videoIframes) {
    if (!el.isConnected) videoIframes.delete(el);
  }
  return videoIframes.size > 0;
}
