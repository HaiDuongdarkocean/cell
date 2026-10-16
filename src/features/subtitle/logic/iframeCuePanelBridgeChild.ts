import { isChildFrame } from './iframePlayerModeBridge';
import { isCurrentWorld } from '@/shared/lib/dom/claimSingletonInstall';
import { resolveParentFrameOrigin } from '@/shared/lib/dom/frameOrigin';
import {
  CUE_PANEL_STATE_MSG,
  CUE_PANEL_ACTION_MSG,
} from './iframeCuePanelBridgeTypes';
import type {
  CuePanelAction,
  CuePanelActionMessage,
  SerializedCuePanelState,
} from './iframeCuePanelBridgeTypes';

let panelOpenOnHost = false;

export function cuePanelRemoteCapable(): boolean {
  return isChildFrame() && resolveParentFrameOrigin() !== undefined;
}

/** Push the whole serialized state — the host re-renders on each message.
 *  Called on open and on every state change (including ~4Hz time ticks). */
export function sendCuePanelState(state: SerializedCuePanelState): void {
  if (!cuePanelRemoteCapable()) return;
  const parentOrigin = resolveParentFrameOrigin()!;
  panelOpenOnHost = state.open;
  try {
    window.parent.postMessage({ type: CUE_PANEL_STATE_MSG, state }, parentOrigin);
  } catch { /* cross-origin — best effort */ }
}

// Every stacked-injection world sees the same post. The rid nonce cannot be
// claimed HERE — a stale world whose handler params lack the callback would
// eat the action while the live world sits ready. The claim must happen at
// act-point inside the subscriber's switch (claimRelayNonce before fn()).
export function onCuePanelAction(
  handler: (action: CuePanelAction, args: CuePanelActionMessage) => void,
): () => void {
  if (!isChildFrame()) return () => {};
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return () => {};
  const onMessage = (e: MessageEvent): void => {
    if (e.data?.type !== CUE_PANEL_ACTION_MSG || !e.data?.action) return;
    if (e.origin !== parentOrigin) return;
    // Stale-world gate: only the latest-injected world may act — a stale
    // world's handler would run dead-bundle code or eat the action silently.
    if (!isCurrentWorld()) return;
    handler(e.data.action as CuePanelAction, e.data as CuePanelActionMessage);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

export function isCuePanelOpenOnHost(): boolean {
  return panelOpenOnHost;
}
