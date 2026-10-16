// Host-side universal panel bridge — opens the real universal panel on the
// top document when a cross-origin child iframe requests it (settings,
// dictionary tab, sendToCard). Middle frames forward up / relay state down.

import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { runOncePerDocument } from '@/shared/lib/dom/claimSingletonInstall';
import {
  isIframeContentWindow,
  isResolvableHttpOrigin,
  resolveParentFrameOrigin,
} from '@/shared/lib/dom/frameOrigin';
import {
  UP_CLOSE_MSG,
  UP_NAV_MSG,
  UP_OPEN_MSG,
  UP_SEND_TO_CARD_MSG,
  UP_STATE_MSG,
} from '@/features/universalPanel/iframePanelBridge';
import { openSettingsSection } from '@/features/dictionaryPopup';
import type { PanelMountController } from '@/features/dictionaryPopup';
import type { DictionaryPanelPrefill } from '@/entities/dictionary';

interface Route {
  win: Window;
  origin: string;
}

export function installHostUniversalPanel(): () => void {
  let dispose: (() => void) | null = null;
  runOncePerDocument('host-universal-panel', () => { dispose = installHostUniversalPanelOnce(); });
  return () => dispose?.();
}

function installHostUniversalPanelOnce(): () => void {
  const isTop = !isChildFrame();
  const routes = new Set<Route>();
  let panelPromise: Promise<PanelMountController> | null = null;
  let stateWired = false;

  const broadcastState = (open: boolean): void => {
    for (const r of routes) {
      try {
        r.win.postMessage({ type: UP_STATE_MSG, open }, r.origin);
      } catch { /* dead child */ }
    }
  };

  const getPanel = (): Promise<PanelMountController> => {
    if (!panelPromise) {
      panelPromise = import('./featureInit').then((m) => {
        const panel = m.ensureUniversalPanelMount() as PanelMountController;
        if (!stateWired) {
          stateWired = true;
          panel.onOpenChange?.((open) => broadcastState(open));
        }
        return panel;
      });
    }
    return panelPromise;
  };

  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;

    // Host → child direction (middle frames forward state down).
    if (isChildFrame() && data.type === UP_STATE_MSG) {
      broadcastState(Boolean(data.open));
      return;
    }

    if (!isIframeContentWindow(e.source as Window | null)) return;
    if (!isResolvableHttpOrigin(e.origin)) return;
    const src = e.source as Window;

    if (!isTop) {
      const parentOrigin = resolveParentFrameOrigin();
      if (!parentOrigin) return;
      routes.add({ win: src, origin: e.origin });
      try {
        window.parent.postMessage(data, parentOrigin);
      } catch { /* dead parent */ }
      return;
    }

    const route: Route = { win: src, origin: e.origin };
    routes.add(route);
    switch (data.type) {
      case UP_OPEN_MSG:
        void getPanel().then((p) => { void p.open(data.tab as Parameters<PanelMountController['open']>[0]); });
        break;
      case UP_CLOSE_MSG:
        void getPanel().then((p) => p.close());
        break;
      case UP_SEND_TO_CARD_MSG:
        void getPanel().then((p) => { void p.sendToCard(data.prefill as DictionaryPanelPrefill); });
        break;
      case UP_NAV_MSG:
        void getPanel().then((p) => { void openSettingsSection(p, data.sectionId as string); });
        break;
    }
  };
  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
    routes.clear();
  };
}
