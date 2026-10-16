// Child-frame side of the popup bridge — `mountPopupDictionaryRemote` returns
// a PopupDictionaryMountController that proxies the real mount living in the
// top frame document. The child's popup lifecycle stays intact (highlight,
// stack, trail, video pause); only the surface is remote.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import { resolveParentFrameOrigin } from '@/shared/lib/dom/frameOrigin';
import { isReanchorPointerDown } from '../controller/lookupTargetDom';
import type {
  MountPopupDictionaryOptions,
  PopupDictionaryMountController,
} from '../ui/mountPopupDictionary';
import {
  POPUP_CB_MSG,
  POPUP_CALL_MSG,
  POPUP_CLOSE_MSG,
  POPUP_OPENED_MSG,
  POPUP_OPEN_MSG,
  POPUP_PDOWN_MSG,
  type RemotePopupOptions,
} from './iframePopupBridgeTypes';

let nextPopupId = 0;
// Per-frame nonce — sibling frames' counters both start at 0, so ids would
// collide in the parent's maps without it.
const frameNonce = Math.random().toString(36).slice(2, 8);
/** Once a remote mount has failed, stop trying — the parent can't host us
 *  (shadow-DOM iframe, no content script, CSP) and local mounts still work. */
let remoteMountBroken = false;

/** How long the child waits for the host's OPENED ack before giving up and
 *  reporting close — covers "top frame has no content script" without
 *  leaving a phantom open state in the child's stack. */
const OPEN_ACK_TIMEOUT_MS = 1200;

interface ActiveProxy {
  readonly callbacks: MountPopupDictionaryOptions;
}
const activeProxies = new Map<string, ActiveProxy>();

// Module-level flags don't survive stacked reinjections (separate isolated
// worlds) — the DOM-attribute guard does.
let listenerInstalled = false;
function ensureListener(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  const parentOrigin = resolveParentFrameOrigin();
  runOncePerDocument('popup-cb-listener', () => {
    window.addEventListener('message', (e: MessageEvent) => {
      if (parentOrigin && e.origin !== parentOrigin) return;
      const data = e.data;
      if (!data || typeof data !== 'object' || typeof data.id !== 'string') return;
      if (data.type === POPUP_CB_MSG) {
        const proxy = activeProxies.get(data.id);
        if (!proxy) return;
        const cb = proxy.callbacks[data.name as keyof MountPopupDictionaryOptions];
        if (typeof cb === 'function') {
          (cb as (...a: unknown[]) => void)(...(data.args as unknown[] ?? []));
        }
      }
    });
  });
}

/** Forward child-document pointerdowns to the host so outside clicks inside
 *  the iframe dismiss the remote popup exactly like host-document clicks do.
 *  `reanchor` marks clicks on lookup triggers — the subsequent lookup's
 *  setAnchor is the real continuation, no dismiss. */
function installPointerdownForwarder(id: string, post: (msg: Record<string, unknown>) => void): () => void {
  const onPointerDown = (e: PointerEvent): void => {
    post({ type: POPUP_PDOWN_MSG, id, reanchor: isReanchorPointerDown(e) });
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  return () => document.removeEventListener('pointerdown', onPointerDown, true);
}

/**
 * Mount the popup on the top frame. Returns null when no parent context is
 * resolvable — the caller falls back to a local in-iframe mount.
 */
export function mountPopupDictionaryRemote(
  options: MountPopupDictionaryOptions,
  sheetHeightVh?: number,
  hostAnchored = false,
  /** Fires when the host can't render (rejected ack or ack timeout) — the
   *  caller should swap in a local in-iframe mount. */
  onUnavailable?: () => void,
): PopupDictionaryMountController | null {
  if (!isChildFrame() || remoteMountBroken) return null;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return null;

  ensureListener();
  const id = `rp${frameNonce}-${++nextPopupId}`;
  let destroyed = false;
  let opened = false;
  const pendingCalls: Record<string, unknown>[] = [];

  const post = (msg: Record<string, unknown>): void => {
    try {
      window.parent.postMessage(msg, parentOrigin);
    } catch { /* dead parent */ }
  };

  const serialized: RemotePopupOptions = {
    anchor: options.anchor,
    pointer: options.pointer,
    lineRect: options.lineRect ?? null,
    langCode: options.langCode,
    sourceLang: options.sourceLang,
    targetLang: options.targetLang,
    initialTerm: options.initialTerm,
    contextSentence: options.contextSentence,
    cursorOffset: options.cursorOffset,
    initialResult: options.initialResult,
    initialCandidates: options.initialCandidates,
    isLoading: options.isLoading,
    initialSize: options.initialSize,
    initialSheetHeight: options.initialSheetHeight,
    sheetHeightVh,
    trail: options.trail,
    defaultActiveTab: options.defaultActiveTab,
    anchorInTopCoords: hostAnchored,
  };

  post({ type: POPUP_OPEN_MSG, id, opts: serialized });
  const removePointerForwarder = installPointerdownForwarder(id, post);

  const fail = (): void => {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(ackTimer);
    window.removeEventListener('message', onOpened);
    activeProxies.delete(id);
    removePointerForwarder();
    remoteMountBroken = true;
    if (onUnavailable) onUnavailable();
    else options.onClose?.();
  };

  const ackTimer = setTimeout(() => {
    if (opened || destroyed) return;
    // No host answered — surface never appeared. Fall back locally instead
    // of leaking an invisible popup.
    fail();
  }, OPEN_ACK_TIMEOUT_MS);

  const onOpened = (e: MessageEvent): void => {
    const data = e.data;
    if (e.origin !== parentOrigin) return;
    if (!data || data.type !== POPUP_OPENED_MSG || data.id !== id) return;
    window.removeEventListener('message', onOpened);
    if (destroyed) {
      // Ack arrived after the timeout — the host just mounted a ghost.
      post({ type: POPUP_CLOSE_MSG, id });
      return;
    }
    if (data.ok === false) {
      fail();
      return;
    }
    opened = true;
    for (const call of pendingCalls) post(call);
    pendingCalls.length = 0;
  };
  window.addEventListener('message', onOpened);

  const sendCall = (method: string, args: unknown[], topCoords = false): void => {
    if (destroyed) return;
    const msg = { type: POPUP_CALL_MSG, id, method, args, topCoords };
    if (opened) post(msg);
    else pendingCalls.push(msg);
  };

  const doDestroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(ackTimer);
    window.removeEventListener('message', onOpened);
    activeProxies.delete(id);
    removePointerForwarder();
    post({ type: POPUP_CLOSE_MSG, id });
  };

  activeProxies.set(id, { callbacks: options });

  // A detached placeholder host — never inserted into the child document.
  // The real host lives on the top frame; this satisfies the controller
  // contract for code paths that read `mount.host` (z-index writes go
  // through setZIndex instead).
  const host = document.createElement('div');
  host.classList.add('js-Tihoka-popup-host-remote');

  return {
    host,
    focus: () => { sendCall('focus', []); },
    destroy: () => { doDestroy(); },
    setZIndex: (zIndex: string) => { sendCall('setZIndex', [zIndex]); },
    setLoading: (isLoading) => { sendCall('setLoading', [isLoading]); },
    setResult: (result, candidates = []) => { sendCall('setResult', [result, candidates]); },
    setStatus: (term, status) => { sendCall('setStatus', [term, status]); },
    setOptions: (updates) => { sendCall('setOptions', [updates]); },
    setAnchor: (anchor, pointer, lineRect, topCoords) => {
      sendCall('setAnchor', [anchor, pointer, lineRect ?? null], topCoords ?? false);
    },
  };
}
