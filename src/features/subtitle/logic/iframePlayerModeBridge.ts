import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { handleShortcutKey, isEditableTarget } from '@/features/subtitle/ui/subtitleShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/shared/config/config';

// Iframe Player Mode bridge — top-frame coordinator.
//
// When the host video lives inside a cross-origin iframe (AnimeKai/megaplay,
// moviepire/vidnest, etc.), the child-frame Cell overlay cannot cover the
// top-level viewport because `position:fixed` is bounded by the iframe's
// browsing context. The top frame uses the native Fullscreen API on the host
// container (e.g. `.player-wrap`) — no DOM move, no iframe reload, and the
// browser top-layer guarantees nothing can z-index over it. The iframe fills
// the fullscreen element → the child-frame Cell overlay (already
// `position:fixed; inset:0` inside the iframe) covers the full viewport.
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
  host: HTMLElement;
  fillStyle: HTMLStyleElement;
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

/**
 * Find the farthest ancestor of `iframe` whose bounding rect matches the
 * iframe's rect (same width AND height). This is the outermost container that
 * wraps the player without extra padding — e.g. `.player-wrap` on AnimeKai.
 * Generic: no hardcoded class names, adapts to any site layout.
 * Ponytail: O(depth) walk, depth is typically < 10 in player DOM.
 */
function findFarthestSameSizeContainer(iframe: HTMLIFrameElement): HTMLElement {
  const iw = Math.round(iframe.getBoundingClientRect().width);
  const ih = Math.round(iframe.getBoundingClientRect().height);
  let el: HTMLElement | null = iframe.parentElement;
  let farthest: HTMLElement | null = null;
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    if (Math.round(r.width) === iw && Math.round(r.height) === ih) {
      farthest = el;
    }
    el = el.parentElement;
  }
  return farthest ?? iframe;
}

/**
 * Enter top-frame Player Mode using the native Fullscreen API. No DOM move →
 * no iframe reload. Browser top-layer guarantees nothing can z-index over it.
 * If the site already has its own fullscreen active, requestFullscreen() on
 * our host auto-exits the old fullscreen and enters ours in one step — no
 * need to exitFullscreen() first (which would consume the user gesture and
 * block the subsequent requestFullscreen()).
 */
async function enterTopFramePlayerMode(frameSrc: string): Promise<boolean> {
  if (topState) return true; // already active
  const iframe = findIframeBySource(frameSrc);
  if (!iframe) return false;

  const host = findFarthestSameSizeContainer(iframe);

  // Force the player container chain to fill the fullscreen host. Scope to
  // .player-main + iframe only — Cell's own overlay hosts (#cell-universal-
  // panel-host, .js-cell-orbital-badge-host) must NOT be stretched, otherwise
  // they cover the iframe and block pointer events on the video.
  const fillStyle = document.createElement('style');
  fillStyle.setAttribute('data-cell-player-mode', 'fill');
  fillStyle.textContent = [
    ':fullscreen .player-main,',
    ':fullscreen .player-main iframe,',
    ':fullscreen iframe {',
    '  width:100%!important;height:100%!important;',
    '  position:absolute!important;inset:0!important;',
    '  border:none!important;display:block!important;',
    '}',
  ].join('');
  document.head.appendChild(fillStyle);

  try {
    // requestFullscreen() auto-exits any existing fullscreen (site's own)
    // and enters ours in one step — same user gesture, no Chrome block.
    await host.requestFullscreen();
  } catch {
    fillStyle.remove();
    return false;
  }

  topState = { host, fillStyle };
  return true;
}

/** Exit top-frame Player Mode: exit fullscreen + remove fill style. */
async function exitTopFramePlayerMode(): Promise<boolean> {
  if (!topState) return false;
  const s = topState;
  topState = null;

  if (document.fullscreenElement === s.host) {
    try { await document.exitFullscreen(); }
    catch { /* best effort */ }
  }
  s.fillStyle.remove();
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
 * Notify the child iframe via its contentWindow (used when top frame triggers
 * PM itself, without receiving a request from the child first).
 */
function notifyChildByIframe(entered: boolean): void {
  const iframe = topState?.host?.querySelector('iframe')
    ?? document.querySelector('iframe');
  try {
    iframe?.contentWindow?.postMessage(
      { type: entered ? ENTERED_MSG : EXITED_MSG },
      '*',
    );
  } catch { /* cross-origin — best effort */ }
}

/**
 * Toggle top-frame Player Mode from the top frame itself (user pressed `g`
 * while focus is on the top document, not inside the iframe). Enter if idle,
 * exit if active. Notifies the child iframe so it can mount/unmount its
 * subtitle overlay.
 */
export async function toggleTopFramePlayerMode(): Promise<void> {
  if (window.self !== window.top) return; // only top frame
  if (topState) {
    const ok = await exitTopFramePlayerMode();
    if (ok) notifyChildByIframe(false);
  } else {
    const iframe = document.querySelector('iframe');
    if (!iframe?.src) return;
    const ok = await enterTopFramePlayerMode(iframe.src);
    if (ok) notifyChildByIframe(true);
  }
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
      void enterTopFramePlayerMode(data.frameSrc).then((ok) => {
        if (ok) notifyChild(true, childSource);
      });
    } else if (data.type === EXIT_MSG) {
      void exitTopFramePlayerMode().then((ok) => {
        if (ok) notifyChild(false, childSource);
      });
    }
  };
  window.addEventListener('message', handler);

  // Esc (browser native fullscreen exit) → notify child EXITED.
  const onFullscreenChange = (): void => {
    if (!document.fullscreenElement && topState) {
      void exitTopFramePlayerMode();
      notifyChildByIframe(false);
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // Top-frame keyboard handler: when the video lives in a cross-origin iframe,
  // SubtitlePanels doesn't mount on the top frame (no <video> here), so the
  // regular content-script keyboard handler is never registered. Listen for the
  // configured 'toggle-player-mode' shortcut directly and toggle PM via the
  // bridge. Skipped when a <video> exists on the top frame (same-origin sites
  // use the regular SubtitlePanels flow).
  let shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
  void loadSettings().then((s) => {
    if (s.keyboardShortcuts?.length) shortcuts = s.keyboardShortcuts;
  });
  const onKeydown = (e: KeyboardEvent): void => {
    if (isEditableTarget(e.target)) return;
    if (document.querySelector('video')) return; // has video → SubtitlePanels handles
    if (!document.querySelector('iframe')) return; // no iframe → nothing to do
    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, e.target, {
      ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey,
    });
    if (action !== 'toggle-player-mode') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    void toggleTopFramePlayerMode();
  };
  window.addEventListener('keydown', onKeydown, true);

  return () => {
    window.removeEventListener('message', handler);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('keydown', onKeydown, true);
  };
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
