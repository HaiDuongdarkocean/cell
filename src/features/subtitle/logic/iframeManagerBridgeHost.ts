import {
  MGR_OPEN_MSG, MGR_CLOSE_MSG, MGR_STATE_MSG, MGR_ACTION_MSG,
  MGR_OPENED_MSG, MGR_CLOSED_MSG,
} from './iframeManagerBridgeTypes';
import type { SerializedManagerState, ManagerAction } from './iframeManagerBridgeTypes';
import {
  isIframeContentWindow,
  isResolvableHttpOrigin,
  resolveIframeOrigin,
} from '@/shared/lib/dom/frameOrigin';

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
    if (resolveIframeOrigin(iframe) === origin) return iframe;
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
    iframe.contentWindow.postMessage(message, origin);
  } catch { /* cross-origin — best effort */ }
}

// Unique per send — stacked child worlds dedupe by rid so exactly one acts.
let relaySeq = 0;
const nextRid = (): string => `${Date.now()}-${++relaySeq}`;

export function sendManagerActionToChild(
  frameSrc: string,
  action: ManagerAction,
  args: Record<string, unknown>,
): void {
  try {
    const origin = new URL(frameSrc).origin;
    postToIframe(origin, { type: MGR_ACTION_MSG, action, rid: nextRid(), ...args });
  } catch { /* invalid frameSrc */ }
}

export function sendManagerCloseToChild(frameSrc: string): void {
  try {
    const origin = new URL(frameSrc).origin;
    postToIframe(origin, { type: MGR_CLOSE_MSG, frameSrc, rid: nextRid() });
  } catch { /* invalid frameSrc */ }
}

export function installManagerSheetBridge(): () => void {
  // Always install — iframes may be added after content script loads.
  // Origin validation (hasIframeWithOrigin) handles the no-iframe case
  // by rejecting messages when no matching iframe exists.

  const onMessage = (e: MessageEvent): void => {
    const data = e.data;
    if (!data?.type) return;

    // The sender must be an iframe actually present in the document — drops
    // forged posts from the top window itself or detached/opaque frames.
    if (!isIframeContentWindow(e.source as Window | null)) return;

    // Origin must be a resolvable http(s) origin AND match an iframe on the
    // page — 'null' (opaque/sandboxed) and foreign origins fail closed.
    if (!isResolvableHttpOrigin(e.origin)) return;
    if (!hasIframeWithOrigin(e.origin)) return;

    // Corroborate self-reported frameSrc against the real event origin —
    // a hostile embed can pass hasIframeWithOrigin but must not lie about
    // which frame it speaks for.
    const frameSrc = data.frameSrc as string | undefined;
    if (typeof frameSrc === 'string') {
      try {
        if (new URL(frameSrc).origin !== e.origin) return;
      } catch { return; }
    }

    switch (data.type) {
      case MGR_OPEN_MSG: {
        if (callbacks?.onOpen) {
          callbacks.onOpen(data.state as SerializedManagerState, frameSrc as string);
        }
        // Acknowledge
        postToIframe(e.origin, { type: MGR_OPENED_MSG, ok: true });
        break;
      }
      case MGR_STATE_MSG: {
        if (callbacks?.onStateUpdate) {
          callbacks.onStateUpdate(data.state as Partial<SerializedManagerState>, frameSrc as string);
        }
        break;
      }
      case MGR_CLOSED_MSG: {
        if (callbacks?.onClose) {
          callbacks.onClose(frameSrc as string);
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
