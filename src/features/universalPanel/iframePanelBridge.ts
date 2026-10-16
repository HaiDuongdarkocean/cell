// Iframe universal-panel bridge — a child frame's PanelMountController proxy
// that opens the real universal panel on the TOP document (the panel is a
// full-viewport surface; inside a cross-origin player iframe it clips to the
// embed bounds). Covers settings, dictionary tab, and sendToCard.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import { resolveParentFrameOrigin } from '@/shared/lib/dom/frameOrigin';
import type { PanelMountController, PanelTab } from '@/features/dictionaryPopup';
import type { DictionaryPanelPrefill } from '@/entities/dictionary';

export const UP_OPEN_MSG = '__Tihoka_UP_OPEN';
export const UP_CLOSE_MSG = '__Tihoka_UP_CLOSE';
export const UP_SEND_TO_CARD_MSG = '__Tihoka_UP_SEND_TO_CARD';
export const UP_NAV_MSG = '__Tihoka_UP_NAV';
export const UP_STATE_MSG = '__Tihoka_UP_STATE';

/** Child-frame stand-in for the real panel mount. State (open/closed) is
 *  synced from host UP_STATE messages; sendToCard forwards the serialized
 *  prefill so the top panel's Dictionary tab opens the card creator. */
export function createRemotePanelController(): PanelMountController | null {
  if (!isChildFrame()) return null;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return null;

  let open = false;
  const listeners = new Set<(open: boolean) => void>();
  runOncePerDocument('up-state-listener', () => {
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.origin !== parentOrigin) return;
      if (e.data?.type !== UP_STATE_MSG) return;
      open = Boolean(e.data.open);
      for (const l of [...listeners]) l(open);
    });
  });

  const post = (msg: Record<string, unknown>): void => {
    try {
      window.parent.postMessage(msg, parentOrigin);
    } catch { /* dead parent */ }
  };

  return {
    open: (tab?: PanelTab) => { post({ type: UP_OPEN_MSG, tab }); return Promise.resolve(); },
    close: () => { post({ type: UP_CLOSE_MSG }); },
    isOpen: () => open,
    getHosts: () => [],
    sendToCard: (prefill: DictionaryPanelPrefill) => {
      // Strip the DOM video element — structured clone throws on it and the
      // host-side card creator can't use a child-frame video anyway (media
      // already arrives captured in initialMedia).
      const { video: _video, ...cloneable } = prefill;
      post({ type: UP_SEND_TO_CARD_MSG, prefill: cloneable });
      return Promise.resolve();
    },
    openSection: (sectionId: string) => {
      post({ type: UP_NAV_MSG, sectionId });
      return Promise.resolve();
    },
    onOpenChange: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
