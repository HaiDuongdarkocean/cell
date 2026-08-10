// Iframe Player Mode bridge — top-frame coordinator.
//
// When the host video lives inside a cross-origin iframe (AnimeKai/megaplay,
// moviepire/vidnest, etc.), the child-frame Cell overlay cannot cover the
// top-level viewport because `position:fixed` is bounded by the iframe's
// browsing context. The child frame posts a request to the top frame; the top
// frame creates a fullscreen overlay and reparents the <iframe> element itself
// (which lives in the top document) into the overlay's video stage. The iframe
// fills the stage → the child-frame Cell overlay (already `position:fixed;
// inset:0` inside the iframe) now covers the full iframe = full viewport.
//
// Message protocol (postMessage, cross-origin safe):
//   child → top:  { type: '__CELL_PLAYER_MODE_ENTER', frameSrc: string }
//   child → top:  { type: '__CELL_PLAYER_MODE_EXIT',  frameSrc: string }
//   top → child:  { type: '__CELL_PLAYER_MODE_ENTERED' }
//   top → child:  { type: '__CELL_PLAYER_MODE_EXITED' }
//
// The bridge is a no-op when the current frame IS the top frame and no child
// ever requests entry — same-origin sites (YouTube, themoviebox) keep using
// the existing in-frame Player Mode flow unchanged.

const ENTER_MSG = '__CELL_PLAYER_MODE_ENTER';
const EXIT_MSG = '__CELL_PLAYER_MODE_EXIT';
const ENTERED_MSG = '__CELL_PLAYER_MODE_ENTERED';
const EXITED_MSG = '__CELL_PLAYER_MODE_EXITED';

interface TopFrameState {
  iframe: HTMLIFrameElement;
  savedStyle: {
    width: string;
    height: string;
    position: string;
    zIndex: string;
    top: string;
    left: string;
    margin: string;
    border: string;
    inset: string;
  };
}

let topState: TopFrameState | null = null;

/** True when the current frame is a child iframe (not the top frame). */
export function isChildFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin window.top access throws — definitely a child frame.
    return true;
  }
}

/** Find the iframe element in the top document whose contentWindow posted. */
function findIframeBySource(src: string): HTMLIFrameElement | null {
  const iframes = document.querySelectorAll('iframe');
  for (const f of iframes) {
    if (f.src === src) return f;
  }
  // Fallback: match by origin/path if full URL differs (e.g. query params).
  try {
    const target = new URL(src);
    for (const f of iframes) {
      if (!f.src) continue;
      try {
        const fUrl = new URL(f.src);
        if (fUrl.origin === target.origin && fUrl.pathname === target.pathname) {
          return f;
        }
      } catch { /* ignore malformed */ }
    }
  } catch { /* ignore malformed */ }
  return null;
}

/** Enter top-frame Player Mode: set iframe to position:fixed;inset:0; fullscreen.
 *  Changing width/height triggers a resize event inside the iframe → megaplay
 *  players pause the video. The child frame handles this by calling video.play()
 *  after receiving the ENTERED acknowledgement (see SubtitlePanels auto-resume). */
function enterTopFramePlayerMode(frameSrc: string): boolean {
  if (topState) return true; // already active
  const iframe = findIframeBySource(frameSrc);
  if (!iframe) return false;

  const savedStyle = {
    width: iframe.style.width,
    height: iframe.style.height,
    position: iframe.style.position,
    zIndex: iframe.style.zIndex,
    top: iframe.style.top,
    left: iframe.style.left,
    margin: iframe.style.margin,
    border: iframe.style.border,
    inset: iframe.style.inset,
  };

  // Iframe: position:fixed fullscreen — NO DOM move, NO reload, NO backdrop.
  // The iframe covers 100vw x 100dvh so there's nothing to mask. A separate
  // backdrop div would paint on top of the iframe because the iframe's
  // z-index is relative to its parent's stacking context (nested), while the
  // backdrop's z-index is root-level — they don't compare.
  iframe.style.setProperty('position', 'fixed', 'important');
  iframe.style.setProperty('inset', '0', 'important');
  iframe.style.setProperty('width', '100vw', 'important');
  iframe.style.setProperty('height', '100dvh', 'important');
  iframe.style.setProperty('z-index', '2147483647', 'important');
  iframe.style.setProperty('margin', '0', 'important');
  iframe.style.setProperty('border', 'none', 'important');

  topState = { iframe, savedStyle };
  return true;
}

/** Exit top-frame Player Mode: restore iframe inline styles. */
function exitTopFramePlayerMode(): boolean {
  if (!topState) return false;
  const s = topState;
  topState = null;

  s.iframe.style.width = s.savedStyle.width;
  s.iframe.style.height = s.savedStyle.height;
  s.iframe.style.position = s.savedStyle.position;
  s.iframe.style.zIndex = s.savedStyle.zIndex;
  s.iframe.style.top = s.savedStyle.top;
  s.iframe.style.left = s.savedStyle.left;
  s.iframe.style.margin = s.savedStyle.margin;
  s.iframe.style.border = s.savedStyle.border;
  s.iframe.style.inset = s.savedStyle.inset;

  return true;
}

/** Notify the child frame that top-frame Player Mode entered/exited. */
function notifyChild(entered: boolean, childSource: Window): void {
  try {
    childSource.postMessage(
      { type: entered ? ENTERED_MSG : EXITED_MSG },
      '*',
    );
  } catch { /* cross-origin — best effort */ }
}

/**
 * Install the top-frame listener. Call once at content-script init in the top
 * frame. Returns a cleanup function. Safe to call in child frames (no-op).
 */
export function installIframePlayerModeBridge(): () => void {
  if (window.self !== window.top) return () => undefined;

  const handler = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    const childSource = e.source as Window | null;
    if (!childSource) return;

    if (data.type === ENTER_MSG && typeof data.frameSrc === 'string') {
      const ok = enterTopFramePlayerMode(data.frameSrc);
      if (ok) notifyChild(true, childSource);
    } else if (data.type === EXIT_MSG) {
      const ok = exitTopFramePlayerMode();
      if (ok) notifyChild(false, childSource);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/**
 * Request Player Mode entry from a child frame. Resolves true if the top frame
 * acknowledged (entered), false if no top frame or it did not respond within
 * timeout. In same-origin top frames (no parent), returns false immediately so
 * the caller falls back to the existing in-frame Player Mode flow.
 */
export function requestIframePlayerModeEnter(timeoutMs = 2000): Promise<boolean> {
  if (!isChildFrame()) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === ENTERED_MSG && !settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(true);
      }
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent.postMessage(
        { type: ENTER_MSG, frameSrc: window.location.href },
        '*',
      );
    } catch {
      window.removeEventListener('message', onMessage);
      resolve(false);
      return;
    }
    setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(false);
      }
    }, timeoutMs);
  });
}

/**
 * Notify the top frame to exit Player Mode. Fire-and-forget — the child frame
 * also tears down its own in-frame overlay regardless of the top response.
 */
export function requestIframePlayerModeExit(): void {
  if (!isChildFrame()) return;
  try {
    window.parent.postMessage(
      { type: EXIT_MSG, frameSrc: window.location.href },
      '*',
    );
  } catch { /* cross-origin — best effort */ }
}
