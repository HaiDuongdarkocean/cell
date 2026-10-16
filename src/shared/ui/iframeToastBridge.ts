// Iframe toast bridge — a child frame's createToastHost renders toasts on the
// TOP document instead (a fixed host inside a cross-origin player iframe is
// clipped to the embed bounds). Same postMessage pattern as the popup bridge.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import {
  isIframeContentWindow,
  isResolvableHttpOrigin,
  resolveParentFrameOrigin,
} from '@/shared/lib/dom/frameOrigin';
import type { IconCatalogKey } from '@/shared/icons';
import type { ToastHost, ToastHandle } from './mountToast';
import type { ToastKind } from './Toast';

export const TOAST_SHOW_MSG = '__Tihoka_TOAST_SHOW';
export const TOAST_UPDATE_MSG = '__Tihoka_TOAST_UPDATE';

let nextToastId = 0;

/** Remote ToastHost — each toast gets a local id; updates route by id. */
export function createRemoteToastHost(): ToastHost | null {
  if (!isChildFrame()) return null;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return null;
  const post = (msg: Record<string, unknown>): void => {
    try {
      window.parent.postMessage(msg, parentOrigin);
    } catch { /* dead parent */ }
  };
  return {
    showToast(message, kind: ToastKind = 'success', opts = {}) {
      const id = nextToastId++;
      post({ type: TOAST_SHOW_MSG, id, message, kind, actionId: opts.actionId, icon: opts.icon });
      return {
        id,
        update(nextMessage, nextKind = 'success', nextIcon?: IconCatalogKey) {
          post({ type: TOAST_UPDATE_MSG, id, message: nextMessage, kind: nextKind, icon: nextIcon });
        },
      } satisfies ToastHandle;
    },
  };
}

type RealToastHost = typeof import('./mountToast').createToastHost;
let realHostPromise: Promise<ReturnType<RealToastHost>> | null = null;
/** remoteId → handle, scoped per source iframe window (ids collide across frames). */
const remoteHandles = new Map<Window, Map<number, ToastHandle>>();

/** Install in every frame — top mounts a real toast host; middle frames
 *  forward toast messages upward. */
export function installIframeToastBridge(): () => void {
  let dispose: (() => void) | null = null;
  runOncePerDocument('toast-bridge', () => { dispose = installIframeToastBridgeOnce(); });
  return () => dispose?.();
}

function installIframeToastBridgeOnce(): () => void {
  const isTop = !isChildFrame();
  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object' || typeof data.id !== 'number') return;
    if (data.type !== TOAST_SHOW_MSG && data.type !== TOAST_UPDATE_MSG) return;
    if (!isIframeContentWindow(e.source as Window | null)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;

    if (!isTop) {
      const parentOrigin = resolveParentFrameOrigin();
      if (parentOrigin) {
        try {
          window.parent.postMessage(data, parentOrigin);
        } catch { /* dead parent */ }
      }
      return;
    }

    void (realHostPromise ??= import('./mountToast').then((m) =>
      m.createToastHost(),
    )).then((host) => {
      const src = e.source as Window;
      let map = remoteHandles.get(src);
      if (!map) {
        map = new Map();
        remoteHandles.set(src, map);
      }
      if (data.type === TOAST_SHOW_MSG) {
        map.set(
          data.id,
          host.showToast(data.message as string, data.kind as ToastKind, {
            actionId: data.actionId as string | undefined,
            icon: data.icon as IconCatalogKey | undefined,
          }),
        );
      } else {
        map
          .get(data.id)
          ?.update(data.message as string, data.kind as ToastKind, data.icon as IconCatalogKey | undefined);
      }
    });
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
