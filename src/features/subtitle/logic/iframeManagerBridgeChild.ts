import { isChildFrame } from './iframePlayerModeBridge';
import {
  MGR_OPEN_MSG, MGR_CLOSE_MSG, MGR_STATE_MSG, MGR_ACTION_MSG,
  MGR_OPENED_MSG, MGR_CLOSED_MSG,
} from './iframeManagerBridgeTypes';
import type { SerializedManagerState, ManagerAction } from './iframeManagerBridgeTypes';

let managerOpenedOnHost = false;

export function requestManagerOpenOnHost(
  state: SerializedManagerState,
  timeoutMs = 3000,
): Promise<boolean> {
  if (!isChildFrame()) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === MGR_OPENED_MSG && !settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        managerOpenedOnHost = true;
        resolve(Boolean(e.data.ok));
      }
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent.postMessage(
        { type: MGR_OPEN_MSG, frameSrc: window.location.href, state },
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

export function sendManagerStateUpdate(state: Partial<SerializedManagerState>): void {
  if (!isChildFrame() || !managerOpenedOnHost) return;
  try {
    window.parent.postMessage(
      { type: MGR_STATE_MSG, frameSrc: window.location.href, state },
      '*',
    );
  } catch { /* cross-origin — best effort */ }
}

export function confirmManagerClosed(): void {
  if (!isChildFrame() || !managerOpenedOnHost) return;
  managerOpenedOnHost = false;
  try {
    window.parent.postMessage(
      { type: MGR_CLOSED_MSG, frameSrc: window.location.href },
      '*',
    );
  } catch { /* cross-origin — best effort */ }
}

export function onManagerAction(
  handler: (action: ManagerAction, args: Record<string, unknown>) => void,
): () => void {
  if (!isChildFrame()) return () => {};
  const onMessage = (e: MessageEvent): void => {
    if (e.data?.type === MGR_ACTION_MSG && e.data?.action) {
      const { action, ...args } = e.data;
      handler(action as ManagerAction, args as Record<string, unknown>);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

export function onManagerCloseFromHost(handler: () => void): () => void {
  if (!isChildFrame()) return () => {};
  const onMessage = (e: MessageEvent): void => {
    if (e.data?.type === MGR_CLOSE_MSG) {
      handler();
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

// beforeunload — cleanup if child navigates away while manager open on host
if (isChildFrame()) {
  window.addEventListener('beforeunload', () => {
    if (managerOpenedOnHost) {
      try {
        window.parent.postMessage(
          { type: MGR_CLOSED_MSG, frameSrc: window.location.href },
          '*',
        );
      } catch { /* best effort */ }
    }
  });
}
