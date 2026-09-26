/**
 * chrome.offscreen adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps createDocument.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/offscreen
 *
 * Firefox has no chrome.offscreen — OffscreenManager enables in-process
 * dispatch so runner modules register into a local registry instead of
 * chrome.runtime.onMessage (which would double-fire on the event page).
 */

import { onMessage, removeOnMessageListener } from './runtime';

type OffscreenMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

const inProcessListeners = new Set<OffscreenMessageListener>();
let inProcessDispatch = false;

/** Whether chrome.offscreen exists (Chrome) or heavy work must run in-process (Firefox event page). */
export function isOffscreenSupported(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.offscreen?.createDocument === 'function';
}

/** Switch registerOffscreenListener/dispatchOffscreenMessage to the in-process registry. Call before importing runner modules. */
export function enableInProcessOffscreenDispatch(): void {
  inProcessDispatch = true;
}

/** Register a runner message listener: real onMessage on Chrome offscreen docs, registry on Firefox. */
export function registerOffscreenListener(listener: OffscreenMessageListener): void {
  if (inProcessDispatch) {
    inProcessListeners.add(listener);
    return;
  }
  onMessage(listener);
}

export function unregisterOffscreenListener(listener: OffscreenMessageListener): void {
  if (inProcessDispatch) {
    inProcessListeners.delete(listener);
    return;
  }
  removeOnMessageListener(listener);
}

/** Deliver a request to in-process listeners. First sendResponse wins; resolves undefined when none handle it — mirrors sendMessage. */
export function dispatchOffscreenMessage(request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    let responded = false;
    let waitingAsync = false;
    const sendResponse = (value?: unknown) => {
      if (!responded) {
        responded = true;
        resolve(value);
      }
    };
    const sender = {} as chrome.runtime.MessageSender;
    for (const listener of inProcessListeners) {
      if (responded) break;
      let keepAlive: boolean;
      try {
        keepAlive = (listener(request, sender, sendResponse) as boolean | void) === true;
      } catch {
        continue;
      }
      if (keepAlive && !responded) waitingAsync = true;
    }
    if (!responded && !waitingAsync) resolve(undefined);
  });
}

/** Create an offscreen document with the given reason + justification. */
export async function createOffscreenDocument(
  url: string,
  reasons: chrome.offscreen.Reason[],
  justification: string,
): Promise<void> {
  await chrome.offscreen.createDocument({ url, reasons, justification });
}

/** Check if an offscreen document already exists. */
export function hasOffscreenDocument(): Promise<boolean> {
  return chrome.offscreen.hasDocument();
}

/** Close the offscreen document if one exists. */
export async function closeOffscreenDocument(): Promise<void> {
  await chrome.offscreen.closeDocument();
}

/** Get the offscreen Reason enum values (WORKERS, BLOBS, etc). */
export function getOffscreenReasons(): typeof chrome.offscreen.Reason {
  return chrome.offscreen.Reason;
}
