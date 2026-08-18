import {
  MGR_OPEN_MSG, MGR_CLOSE_MSG, MGR_STATE_MSG, MGR_ACTION_MSG,
  MGR_OPENED_MSG, MGR_CLOSED_MSG,
} from './iframeManagerBridgeTypes';
import type { SerializedManagerState, ManagerAction } from './iframeManagerBridgeTypes';

interface HostSheetCallbacks {
  onOpen: (state: SerializedManagerState, frameSrc: string) => void;
  onStateUpdate: (state: Partial<SerializedManagerState>, frameSrc: string) => void;
  onClose: (frameSrc: string) => void;
}

let callbacks: HostSheetCallbacks | null = null;

export function setHostSheetCallbacks(cbs: HostSheetCallbacks): void {
  callbacks = cbs;
}

/** Find the iframe element whose src origin matches the given origin string. */
function findIframeByOrigin(origin: string): HTMLIFrameElement | null {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (new URL(iframe.src).origin === origin) return iframe;
    } catch { /* skip invalid src */ }
  }
  return null;
}

/** Check if any iframe on the page has a matching origin. */
function hasIframeWithOrigin(origin: string): boolean {
  return findIframeByOrigin(origin) !== null;
}

/** Send a message to a specific iframe by matching its origin. */
function postToIframe(origin: string, message: Record<string, unknown>): void {
  const iframe = findIframeByOrigin(origin);
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(message, '*');
  } catch { /* cross-origin — best effort */ }
}

export function sendManagerActionToChild(
  frameSrc: string,
  action: ManagerAction,
  args: Record<string, unknown>,
): void {
  try {
    const origin = new URL(frameSrc).origin;
    postToIframe(origin, { type: MGR_ACTION_MSG, action, ...args });
  } catch { /* invalid frameSrc */ }
}

export function sendManagerCloseToChild(frameSrc: string): void {
  try {
    const origin = new URL(frameSrc).origin;
    postToIframe(origin, { type: MGR_CLOSE_MSG, frameSrc });
  } catch { /* invalid frameSrc */ }
}

export function installManagerSheetBridge(): () => void {
  // Always install — iframes may be added after content script loads.
  // Origin validation (hasIframeWithOrigin) handles the no-iframe case
  // by rejecting messages when no matching iframe exists.

  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data?.type) return;

    // Validate origin — must match an iframe on the page
    if (!hasIframeWithOrigin(e.origin)) return;

    switch (data.type) {
      case MGR_OPEN_MSG: {
        if (callbacks?.onOpen) {
          callbacks.onOpen(data.state as SerializedManagerState, data.frameSrc as string);
        }
        // Acknowledge
        postToIframe(e.origin, { type: MGR_OPENED_MSG, ok: true });
        break;
      }
      case MGR_STATE_MSG: {
        if (callbacks?.onStateUpdate) {
          callbacks.onStateUpdate(data.state as Partial<SerializedManagerState>, data.frameSrc as string);
        }
        break;
      }
      case MGR_CLOSED_MSG: {
        if (callbacks?.onClose) {
          callbacks.onClose(data.frameSrc as string);
        }
        break;
      }
      // MGR_CLOSE_MSG, MGR_ACTION_MSG are host→child, ignore on host side
    }
  };

  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    callbacks = null;
  };
}
