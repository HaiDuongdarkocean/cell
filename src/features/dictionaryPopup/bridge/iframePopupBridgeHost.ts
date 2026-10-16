// Host-frame side of the popup bridge — installed in EVERY frame.
//
// Middle frames: translate rect-bearing payloads by the sender iframe's
// bounding rect and repost upward (nested embeds accumulate offsets).
// Top frame: mount the real dictionary popup via mountPopupDictionary with
// callbacks relayed back to the child as POPUP_CB messages.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import {
  findIframeByWindow,
  isIframeContentWindow,
  isResolvableHttpOrigin,
  resolveParentFrameOrigin,
} from '@/shared/lib/dom/frameOrigin';
import type {
  MountPopupDictionaryOptions,
  PopupDictionaryMountController,
} from '../ui/mountPopupDictionary';
import {
  POPUP_SHEET_BREAKPOINT_PX,
  type PopupAnchor,
  type PopupLineRect,
  type PopupPointerHint,
} from '../ui/popupGeometry';
import { getViewportContentWidth } from '../ui/viewportContentSize';
import {
  POPUP_CB_MSG,
  POPUP_CALL_MSG,
  POPUP_CLOSE_MSG,
  POPUP_OPENED_MSG,
  POPUP_OPEN_MSG,
  POPUP_PDOWN_MSG,
  type RemotePopupCallbackName,
  type RemotePopupOptions,
} from './iframePopupBridgeTypes';

type MountFn = typeof import('../ui/mountPopupDictionary').mountPopupDictionary;

interface HostEntry {
  readonly childWin: Window;
  readonly childOrigin: string;
  mount: PopupDictionaryMountController | null;
  /** Dismiss policy follows the HOST viewport, not the iframe's.
   *  false = sheet layout → outside clicks never dismiss. */
  readonly dismissOnOutsideClick: boolean;
  removeEscape: () => void;
}

/** Route down-map for middle frames: popupId → which child window owns it. */
const childRoutes = new Map<string, { childWin: Window; childOrigin: string }>();
const mounted = new Map<string, HostEntry>();

let mountFnPromise: Promise<MountFn> | null = null;
const loadMountFn = (): Promise<MountFn> =>
  (mountFnPromise ??= import('../ui/mountPopupDictionary').then((m) => m.mountPopupDictionary));

interface RectLike {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

function offsetRect<T extends RectLike | null | undefined>(rect: T, dx: number, dy: number): T {
  if (!rect) return rect;
  return {
    ...rect,
    top: rect.top + dy,
    left: rect.left + dx,
    right: rect.right + dx,
    bottom: rect.bottom + dy,
  };
}

function offsetPoint<T extends { x: number; y: number } | null | undefined>(p: T, dx: number, dy: number): T {
  if (!p) return p;
  return { ...p, x: p.x + dx, y: p.y + dy };
}

function offsetPointer(pointer: PopupPointerHint | undefined, dx: number, dy: number): PopupPointerHint | undefined {
  if (!pointer) return pointer;
  return {
    ...pointer,
    tip: offsetPoint(pointer.tip, dx, dy)!,
    badgeCenter: offsetPoint(pointer.badgeCenter, dx, dy),
  };
}

function offsetOpts(opts: RemotePopupOptions, dx: number, dy: number): RemotePopupOptions {
  return {
    ...opts,
    anchor: offsetRect(opts.anchor, dx, dy)!,
    lineRect: offsetRect(opts.lineRect, dx, dy),
    pointer: offsetPointer(opts.pointer, dx, dy),
  };
}

function postTo(win: Window | null, origin: string | undefined, msg: Record<string, unknown>): void {
  if (!win || !origin) return;
  try {
    win.postMessage(msg, origin);
  } catch { /* dead frame */ }
}

function sendCallback(id: string, entry: HostEntry, name: RemotePopupCallbackName, args: unknown[]): void {
  postTo(entry.childWin, entry.childOrigin, { type: POPUP_CB_MSG, id, name, args });
}

function destroyEntry(id: string): void {
  const entry = mounted.get(id);
  if (!entry) return;
  mounted.delete(id);
  childRoutes.delete(id);
  entry.removeEscape();
  entry.mount?.destroy();
}

function buildHostOptions(
  id: string,
  entry: HostEntry,
  opts: RemotePopupOptions,
): MountPopupDictionaryOptions {
  const cb = (name: RemotePopupCallbackName) =>
    (...args: unknown[]) => sendCallback(id, entry, name, args);
  return {
    anchor: opts.anchor,
    pointer: opts.pointer,
    lineRect: opts.lineRect ?? null,
    langCode: opts.langCode,
    sourceLang: opts.sourceLang,
    targetLang: opts.targetLang,
    initialTerm: opts.initialTerm,
    contextSentence: opts.contextSentence,
    cursorOffset: opts.cursorOffset,
    initialResult: opts.initialResult,
    initialCandidates: opts.initialCandidates,
    isLoading: opts.isLoading,
    initialSize: opts.initialSize,
    initialSheetHeight: opts.sheetHeightVh != null
      ? Math.round(window.innerHeight * (opts.sheetHeightVh / 100))
      : opts.initialSheetHeight,
    trail: opts.trail,
    defaultActiveTab: opts.defaultActiveTab,
    dismissOnOutsideClick: entry.dismissOnOutsideClick,
    // The child's stack hosts never live in this document — only a popup
    // mounted on this same document (local or another remote level) counts.
    isInsideOtherHost: (e: PointerEvent) => e.composedPath().some(
      (el) => el instanceof HTMLElement && el.classList.contains('js-Tihoka-popup-host'),
    ),
    onClose: cb('onClose'),
    onResult: cb('onResult'),
    // Third arg = the HOST viewport height — the child's own innerHeight is
    // the iframe's and would corrupt the persisted vh ratio.
    onSizeChange: (w, h) => sendCallback(id, entry, 'onSizeChange', [w, h, window.innerHeight]),
    onSendToCard: cb('onSendToCard'),
    onQuickAdd: cb('onQuickAdd'),
    onStatusChange: cb('onStatusChange'),
    onCandidateChange: cb('onCandidateChange'),
    onOpenSettings: cb('onOpenSettings'),
    onTrailNavigate: cb('onTrailNavigate'),
    onOutsidePointerDown: cb('onOutsidePointerDown'),
  };
}

function applyCall(mount: PopupDictionaryMountController, method: string, args: unknown[]): void {
  switch (method) {
    case 'setLoading': mount.setLoading(args[0] as boolean); break;
    case 'setResult': mount.setResult(args[0] as never, (args[1] as never) ?? []); break;
    case 'setStatus': mount.setStatus(args[0] as string, args[1] as never); break;
    case 'setOptions': mount.setOptions(args[0] as never); break;
    case 'setAnchor':
      mount.setAnchor(args[0] as PopupAnchor, args[1] as PopupPointerHint | undefined, (args[2] as PopupLineRect | null) ?? null);
      break;
    case 'setZIndex': mount.host.style.zIndex = args[0] as string; break;
    case 'focus': mount.focus(); break;
    case 'destroy': mount.destroy(); break;
  }
}

export function installIframePopupBridge(): () => void {
  let dispose: (() => void) | null = null;
  runOncePerDocument('popup-bridge', () => { dispose = installIframePopupBridgeOnce(); });
  return () => dispose?.();
}

function installIframePopupBridgeOnce(): () => void {
  const isTop = !isChildFrame();

  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object' || typeof data.id !== 'string') return;

    // Host → child direction: forward OPENED/CB down the recorded route.
    // Only a message from our own parent counts — a sibling iframe could
    // otherwise forge callbacks (close, quick-add, status changes).
    if (isChildFrame()) {
      if (data.type === POPUP_OPENED_MSG || data.type === POPUP_CB_MSG) {
        if (e.source !== window.parent) return;
        if (e.origin !== resolveParentFrameOrigin()) return;
        const route = childRoutes.get(data.id);
        if (route) postTo(route.childWin, route.childOrigin, data);
        return;
      }
    }

    // Child → host direction. Sender must be a real iframe in this document.
    if (!isIframeContentWindow(e.source as Window | null)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;
    const childWin = e.source as Window;
    const childOrigin = e.origin;
    // Every receiving frame (including the top) adds the sender iframe's
    // rect — anchor coords arrive in the sender's viewport space and must be
    // translated into this document's space hop by hop. The flag stays false
    // after each hop so the next frame adds its own iframe's offset.
    const iframeEl = findIframeByWindow(childWin);
    const rect = iframeEl?.getBoundingClientRect();
    const dx = rect?.x ?? 0;
    const dy = rect?.y ?? 0;
    const alreadyTop = data.topCoords === true
      || (data.opts as RemotePopupOptions | undefined)?.anchorInTopCoords === true;

    // Middle frames translate anchor-bearing payloads and repost upward.
    if (!isTop) {
      const parentOrigin = resolveParentFrameOrigin();
      if (!parentOrigin) return;
      switch (data.type) {
        case POPUP_OPEN_MSG: {
          if (!rect) return;
          childRoutes.set(data.id, { childWin, childOrigin });
          const raw = data.opts as RemotePopupOptions;
          postTo(window.parent, parentOrigin, {
            type: POPUP_OPEN_MSG,
            id: data.id,
            opts: alreadyTop ? raw : offsetOpts(raw, dx, dy),
          });
          return;
        }
        case POPUP_CALL_MSG:
        case POPUP_PDOWN_MSG:
        case POPUP_CLOSE_MSG: {
          // Ownership check — a sibling iframe must not drive another
          // frame's popup.
          if (childRoutes.get(data.id)?.childWin !== childWin) return;
          let args = data.args as unknown[];
          if (data.type === POPUP_CALL_MSG && data.method === 'setAnchor'
            && rect && Array.isArray(args) && !alreadyTop) {
            args = [
              offsetRect(args[0] as PopupAnchor, dx, dy),
              offsetPointer(args[1] as PopupPointerHint | undefined, dx, dy),
              offsetRect(args[2] as PopupLineRect | null, dx, dy),
            ];
          }
          if (data.type === POPUP_CLOSE_MSG) childRoutes.delete(data.id);
          postTo(window.parent, parentOrigin, { ...data, args });
          return;
        }
        default:
          return;
      }
    }

    // ── Top frame ──
    switch (data.type) {
      case POPUP_OPEN_MSG: {
        const rawOpts = data.opts as RemotePopupOptions;
        if (!rawOpts?.anchor) return;
        // The sender iframe is the fullscreen element → a top-doc mount is
        // appended inside that iframe and never paints. Tell the child to
        // fall back to an in-iframe mount.
        if (document.fullscreenElement === iframeEl) {
          postTo(childWin, childOrigin, { type: POPUP_OPENED_MSG, id: data.id, ok: false });
          return;
        }
        const opts = alreadyTop ? rawOpts : offsetOpts(rawOpts, dx, dy);
        if (!opts?.anchor) return;
        const entry: HostEntry = {
          childWin,
          childOrigin,
          mount: null,
          dismissOnOutsideClick: getViewportContentWidth() >= POPUP_SHEET_BREAKPOINT_PX,
          removeEscape: () => undefined,
        };
        void loadMountFn().then((mountPopupDictionary) => {
          // Child may have closed while the chunk loaded — don't leave a
          // ghost mount nobody can reach.
          if (mounted.get(data.id) !== entry) return;
          const mount = mountPopupDictionary(buildHostOptions(data.id, entry, opts));
          entry.mount = mount;
          // Escape on the host document — the child's escape-layer stack never
          // sees host keydowns.
          const onKey = (ev: KeyboardEvent): void => {
            if (ev.key === 'Escape') sendCallback(data.id, entry, 'onClose', []);
          };
          window.addEventListener('keydown', onKey, true);
          entry.removeEscape = () =>
            window.removeEventListener('keydown', onKey, true);
          postTo(childWin, childOrigin, { type: POPUP_OPENED_MSG, id: data.id, ok: true });
        }).catch(() => {
          mounted.delete(data.id);
          postTo(childWin, childOrigin, { type: POPUP_OPENED_MSG, id: data.id, ok: false });
        });
        mounted.set(data.id, entry);
        break;
      }

      case POPUP_CALL_MSG: {
        const entry = mounted.get(data.id);
        if (!entry?.mount || entry.childWin !== childWin) return;
        let args = data.args as unknown[];
        if (data.method === 'setAnchor' && !alreadyTop && Array.isArray(args)) {
          args = [
            offsetRect(args[0] as PopupAnchor, dx, dy),
            offsetPointer(args[1] as PopupPointerHint | undefined, dx, dy),
            offsetRect(args[2] as PopupLineRect | null, dx, dy),
          ];
        }
        applyCall(entry.mount, data.method as string, args);
        break;
      }

      case POPUP_PDOWN_MSG: {
        const entry = mounted.get(data.id);
        if (!entry?.mount || entry.childWin !== childWin) return;
        if (data.reanchor === true) return;
        if (!entry.dismissOnOutsideClick) return;
        sendCallback(data.id, entry, 'onOutsidePointerDown', []);
        break;
      }

      case POPUP_CLOSE_MSG:
        if (mounted.get(data.id)?.childWin !== childWin) return;
        destroyEntry(data.id);
        break;
    }
  };
  window.addEventListener('message', onMessage);

  // Child frame navigated/reloaded → its remote popups are orphaned.
  const onIframeLoad = (e: Event): void => {
    if (!(e.target instanceof HTMLIFrameElement)) return;
    for (const [id, route] of childRoutes) {
      if (route.childWin === e.target.contentWindow) childRoutes.delete(id);
    }
    for (const [id, entry] of mounted) {
      if (entry.childWin === e.target.contentWindow) destroyEntry(id);
    }
  };
  document.addEventListener('load', onIframeLoad, true);

  return () => {
    window.removeEventListener('message', onMessage);
    document.removeEventListener('load', onIframeLoad, true);
  };
}
