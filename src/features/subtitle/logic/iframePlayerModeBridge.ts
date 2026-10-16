import { handleShortcutKey, isEditableEvent } from '@/features/subtitle/ui/subtitleShortcuts';
import { dedupeGlobalKeydown, isCurrentWorld } from '@/shared/lib/dom/claimSingletonInstall';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { isResolvableHttpOrigin, resolveParentFrameOrigin, resolveIframeOrigin, isIframeContentWindow } from '@/shared/lib/dom/frameOrigin';
import { setIframeVideo, IFRAME_MEDIA_CHANGED_EVENT, IFRAME_PM_CHANGED_EVENT } from '@/shared/lib/dom/iframeVideoRegistry';

export { isChildFrame };

// Iframe Player Mode bridge — top-frame coordinator.
//
// When the host video lives inside a cross-origin iframe (AnimeKai/megaplay,
// moviepire/vidnest, etc.), the child-frame Tihoka overlay cannot cover the
// top-level viewport because `position:fixed` is bounded by the iframe's
// browsing context. The top frame uses the native Fullscreen API on the host
// container (e.g. `.player-wrap`) — no DOM move, no iframe reload, and the
// browser top-layer guarantees nothing can z-index over it. The iframe fills
// the fullscreen element → the child-frame Tihoka overlay (already
// `position:fixed; inset:0` inside the iframe) covers the full viewport.
//
// Message protocol (postMessage, cross-origin safe):
//   child → top:  { type: '__Tihoka_PLAYER_MODE_ENTER', frameSrc: string }
//   child → top:  { type: '__Tihoka_PLAYER_MODE_EXIT',  frameSrc: string }
//   top → child:  { type: '__Tihoka_PLAYER_MODE_ENTERED' }
//   top → child:  { type: '__Tihoka_PLAYER_MODE_EXITED' }
//
// The bridge is a no-op when the current frame IS the top frame and no child
// ever requests entry — same-origin sites (YouTube, themoviebox) keep using
// the existing in-frame Player Mode flow unchanged.

const ENTER_MSG = '__Tihoka_PLAYER_MODE_ENTER';
const EXIT_MSG = '__Tihoka_PLAYER_MODE_EXIT';
const ENTERED_MSG = '__Tihoka_PLAYER_MODE_ENTERED';
const EXITED_MSG = '__Tihoka_PLAYER_MODE_EXITED';
// Child → parent: the child document found/lost its playable <video>.
const IFRAME_MEDIA_MSG = '__Tihoka_IFRAME_MEDIA';

// Manager sheet — child iframe requests host page to render a bottom sheet.
// The host page creates a portal on document.body and the child sends manager
// state + receives actions via postMessage.

interface TopFrameState {
  host: HTMLElement;
  fillStyle: HTMLStyleElement;
  fallbackStyle: HTMLStyleElement | null;
}

let topState: TopFrameState | null = null;

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
 * iframe's rect (same width AND height). Stop at the deepest direct child of
 * <body> that matches — do not consider <body> or <html>, because fullscreen on
 * body/html can reload the page or cause layout bugs (e.g. moviepire has
 * #root/body/html all matching the iframe size).
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
      // Do not walk above the deepest direct child of <body>. That child is the
      // real top-level player container; <body> and <html> are too broad and
      // can cause full-page fullscreen or iframe reloads.
      if (el.parentElement === document.body) break;
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
  // .player-main + iframe only — Tihoka's own overlay hosts (#Tihoka-universal-
  // panel-host, .js-Tihoka-orbital-badge-host) must NOT be stretched, otherwise
  // they cover the iframe and block pointer events on the video.
  const fillStyle = document.createElement('style');
  fillStyle.setAttribute('data-tihoka-player-mode', 'fill');
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
    topState = { host, fillStyle, fallbackStyle: null };
    window.dispatchEvent(new Event(IFRAME_PM_CHANGED_EVENT));
    return true;
  } catch {
    // A child iframe's `postMessage` cannot carry the user's activation to the
    // top frame. Keep the same carefully selected host and use a reversible
    // fixed fallback instead of showing a failure toast. This path is scoped to
    // the matched player container, not body/html or Tihoka's own hosts.
    const fallbackStyle = document.createElement('style');
    fallbackStyle.setAttribute('data-tihoka-player-mode', 'fallback');
    fallbackStyle.textContent = [
      '[data-tihoka-player-mode-host] {',
      '  position:fixed!important;inset:0!important;',
      '  width:100vw!important;height:100dvh!important;',
      '  max-width:none!important;max-height:none!important;',
      '  /* max-int: intentional top-most overlay */',
      '  z-index:2147483647!important /* max-int: intentional top-most overlay vs host page */;',
      '  overflow:hidden!important;',
      '}',
      '[data-tihoka-player-mode-host] iframe {',
      '  position:absolute!important;inset:0!important;',
      '  width:100%!important;height:100%!important;',
      '  border:none!important;display:block!important;',
      '}',
    ].join('');
    host.setAttribute('data-tihoka-player-mode-host', '');
    document.head.appendChild(fallbackStyle);
    topState = { host, fillStyle, fallbackStyle };
    // No fullscreenchange fires on the fallback path — notify listeners
    // (orbital badge) to re-evaluate attachment now that PM is active.
    window.dispatchEvent(new Event(IFRAME_PM_CHANGED_EVENT));
    return true;
  }
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
  s.fallbackStyle?.remove();
  s.host.removeAttribute('data-tihoka-player-mode-host');
  s.fillStyle.remove();
  window.dispatchEvent(new Event(IFRAME_PM_CHANGED_EVENT));
  return true;
}

/** Notify the child frame that top-frame Player Mode entered/exited. */
function notifyChild(entered: boolean, childSource: Window, childOrigin: string): void {
  try {
    childSource.postMessage(
      { type: entered ? ENTERED_MSG : EXITED_MSG },
      childOrigin,
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
  const targetOrigin = resolveIframeOrigin(iframe);
  if (!targetOrigin) return;
  try {
    iframe?.contentWindow?.postMessage(
      { type: entered ? ENTERED_MSG : EXITED_MSG },
      targetOrigin,
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

/** True when a frameSrc self-report corroborates the event's real origin. */
function frameSrcMatchesOrigin(frameSrc: unknown, origin: string): boolean {
  if (typeof frameSrc !== 'string' || !isResolvableHttpOrigin(origin)) return false;
  try {
    return new URL(frameSrc).origin === origin;
  } catch {
    return false;
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
    if (!isIframeContentWindow(childSource)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;

    if (data.type === ENTER_MSG && typeof data.frameSrc === 'string') {
      if (!frameSrcMatchesOrigin(data.frameSrc, e.origin)) return;
      void enterTopFramePlayerMode(data.frameSrc).then((ok) => {
        if (ok) notifyChild(true, childSource, e.origin);
      });
    } else if (data.type === EXIT_MSG) {
      if (!frameSrcMatchesOrigin(data.frameSrc, e.origin)) return;
      void exitTopFramePlayerMode().then((ok) => {
        if (ok) notifyChild(false, childSource, e.origin);
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

  // The top document has no <video>, so its content-script controller is not
  // mounted. Capture G here for cross-origin iframe players (AnimeKai, Moviepire,
  // etc.) and route it through the same top-frame Player Mode flow.
  let shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
  void loadSettings().then((settings) => {
    if (settings.keyboardShortcuts?.length) shortcuts = settings.keyboardShortcuts;
  });
  const onKeydown = (e: KeyboardEvent): void => {
    if (!isCurrentWorld()) return;
    if (isEditableEvent(e)) return;
    if (document.querySelector('video')) return;
    if (!document.querySelector('iframe')) return;
    const realTarget = e.composedPath()[0] ?? e.target;
    const action = handleShortcutKey(e.key.toLowerCase(), shortcuts, realTarget, {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });
    if (action !== 'toggle-player-mode') return;
    if (!dedupeGlobalKeydown(e)) return;
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
 * Iframe media bridge — installed in EVERY frame (content scripts run
 * all_frames). A frame with a playable video announces it upward; each
 * intermediate frame forwards, so the top frame's registry ends up keyed by
 * its direct-child iframes.
 *
 *   child → parent: { type: IFRAME_MEDIA_MSG, state: 'present' | 'absent' }
 *
 * Top frame marks the sending iframe in the registry and dispatches
 * IFRAME_MEDIA_CHANGED_EVENT so the universal panel re-renders its Video
 * toggle. A marked iframe that navigates is unmarked on its 'load' event —
 * the new document re-announces if it still has a video.
 */
export function installIframeMediaBridge(): void {
  const findIframeByWindow = (win: Window | null): HTMLIFrameElement | null => {
    if (!win) return null;
    for (const f of document.querySelectorAll('iframe')) {
      if (f.contentWindow === win) return f;
    }
    return null;
  };

  const isTop = window.self === window.top;
  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object' || data.type !== IFRAME_MEDIA_MSG) return;
    if (!isIframeContentWindow(e.source as Window | null)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;
    if (isTop) {
      const iframe = findIframeByWindow(e.source as Window | null);
      if (iframe) setIframeVideo(iframe, data.state === 'present');
      window.dispatchEvent(new Event(IFRAME_MEDIA_CHANGED_EVENT));
      return;
    }
    const parentOrigin = resolveParentFrameOrigin();
    if (parentOrigin) {
      try { window.parent.postMessage(data, parentOrigin); } catch { /* dead parent */ }
    }
  };
  window.addEventListener('message', onMessage);

  if (isTop) {
    // A navigated iframe gets a fresh content script — unmark until the new
    // document re-announces its video (or stays silent when there is none).
    document.addEventListener('load', (e) => {
      if (e.target instanceof HTMLIFrameElement) {
        setIframeVideo(e.target, false);
        window.dispatchEvent(new Event(IFRAME_MEDIA_CHANGED_EVENT));
      }
    }, true);
  }
}

/** Child frame → parent: announce a playable video appeared/disappeared. */
export function postIframeMediaState(present: boolean): void {
  if (window.self === window.top) return;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return;
  try {
    window.parent.postMessage({ type: IFRAME_MEDIA_MSG, state: present ? 'present' : 'absent' }, parentOrigin);
  } catch { /* cross-origin parent — best effort */ }
}

/**
 * Request Player Mode entry from a child frame. Resolves true if the top frame
 * acknowledged (entered), false if no top frame or it did not respond within
 * timeout. In same-origin top frames (no parent), returns false immediately so
 * the caller falls back to the existing in-frame Player Mode flow.
 */
export function requestIframePlayerModeEnter(timeoutMs = 2000): Promise<boolean> {
  if (!isChildFrame()) return Promise.resolve(false);
  const parentOrigin = resolveParentFrameOrigin();
  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === ENTERED_MSG && e.origin === parentOrigin && !settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(true);
      }
    };
    window.addEventListener('message', onMessage);
    if (!parentOrigin) {
      window.removeEventListener('message', onMessage);
      resolve(false);
      return;
    }
    try {
      window.parent.postMessage(
        { type: ENTER_MSG, frameSrc: window.location.origin + window.location.pathname },
        parentOrigin,
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
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return;
  try {
    window.parent.postMessage(
      { type: EXIT_MSG, frameSrc: window.location.origin + window.location.pathname },
      parentOrigin,
    );
  } catch { /* cross-origin — best effort */ }
}
