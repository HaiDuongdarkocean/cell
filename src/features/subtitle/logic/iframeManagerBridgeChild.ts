import { isChildFrame } from './iframePlayerModeBridge';
import { claimRelayNonce, isCurrentWorld } from '@/shared/lib/dom/claimSingletonInstall';
import { resolveParentFrameOrigin } from '@/shared/lib/dom/frameOrigin';
import {
  MGR_OPEN_MSG, MGR_CLOSE_MSG, MGR_STATE_MSG, MGR_ACTION_MSG,
  MGR_OPENED_MSG, MGR_CLOSED_MSG,
} from './iframeManagerBridgeTypes';
import type { SerializedManagerState, ManagerAction } from './iframeManagerBridgeTypes';

let managerOpenedOnHost = false;

function frameSrcSelf(): string {
  return window.location.origin + window.location.pathname;
}

export function requestManagerOpenOnHost(
  state: SerializedManagerState,
  timeoutMs = 3000,
): Promise<boolean> {
  if (!isChildFrame()) return Promise.resolve(false);
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return Promise.resolve(false);
  ensureBeforeunloadListener();
  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === MGR_OPENED_MSG && e.origin === parentOrigin && !settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        managerOpenedOnHost = true;
        resolve(Boolean(e.data.ok));
      }
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent.postMessage(
        { type: MGR_OPEN_MSG, frameSrc: frameSrcSelf(), state },
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

export function sendManagerStateUpdate(state: Partial<SerializedManagerState>): void {
  if (!isChildFrame() || !managerOpenedOnHost) return;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return;
  try {
    window.parent.postMessage(
      { type: MGR_STATE_MSG, frameSrc: frameSrcSelf(), state },
      parentOrigin,
    );
  } catch { /* cross-origin — best effort */ }
}

export function confirmManagerClosed(): void {
  if (!isChildFrame() || !managerOpenedOnHost) return;
  managerOpenedOnHost = false;
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return;
  try {
    window.parent.postMessage(
      { type: MGR_CLOSED_MSG, frameSrc: frameSrcSelf() },
      parentOrigin,
    );
  } catch { /* cross-origin — best effort */ }
}

// Stacked worlds each see the same post. The rid claim happens AFTER the
// handler reports it acted — a stale world whose handler no-ops can't eat
// the action ahead of the live world (message delivery is synchronous per
// world, so the claim is still atomic).
export function onManagerAction(
  handler: (action: ManagerAction, args: Record<string, unknown>) => boolean,
): () => void {
  if (!isChildFrame()) return () => {};
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return () => {};
  const onMessage = (e: MessageEvent): void => {
    if (e.data?.type === MGR_ACTION_MSG && e.data?.action && e.origin === parentOrigin) {
      if (!isCurrentWorld()) return;
      const { action, ...args } = e.data;
      if (handler(action as ManagerAction, args as Record<string, unknown>)) {
        claimRelayNonce('manager-action', e.data.rid);
      }
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

export function onManagerCloseFromHost(handler: () => void): () => void {
  if (!isChildFrame()) return () => {};
  const parentOrigin = resolveParentFrameOrigin();
  if (!parentOrigin) return () => {};
  const onMessage = (e: MessageEvent): void => {
    if (e.data?.type === MGR_CLOSE_MSG && e.origin === parentOrigin) {
      if (!isCurrentWorld()) return;
      handler();
      claimRelayNonce('manager-close', e.data.rid);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

// beforeunload — cleanup if child navigates away while manager open on host.
// Lazy init: this module may be transitively imported by the SW bundle where
// `window` is undefined. Register the listener on first use, not at module load.
let beforeunloadInstalled = false;
function ensureBeforeunloadListener(): void {
  if (beforeunloadInstalled) return;
  beforeunloadInstalled = true;
  window.addEventListener('beforeunload', () => {
    if (managerOpenedOnHost) {
      const parentOrigin = resolveParentFrameOrigin();
      if (!parentOrigin) return;
      try {
        window.parent.postMessage(
          { type: MGR_CLOSED_MSG, frameSrc: frameSrcSelf() },
          parentOrigin,
        );
      } catch { /* best effort */ }
    }
  });
}
