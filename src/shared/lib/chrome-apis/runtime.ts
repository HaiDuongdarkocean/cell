/**
 * chrome.runtime adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps sendMessage, onMessage, getURL, id.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/runtime
 */

export function sendMessage<T = unknown>(
  message: unknown,
): Promise<T> {
  const override = (typeof globalThis !== 'undefined' && (globalThis as { __cellSendMessage?: (m: unknown) => Promise<unknown> }).__cellSendMessage);
  if (override) {
    return override(message) as Promise<T>;
  }
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve(undefined as T);
  }
  return Promise.resolve(chrome.runtime.sendMessage(message) as Promise<T>).catch(
    (error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      if (!detail.includes('Could not establish connection')) {
        throw error;
      }
      const type = (message as { type?: unknown } | undefined)?.type;
      throw new Error(
        `sendMessage(${typeof type === 'string' ? type : 'unknown'}): no receiving end — ${detail}`,
      );
    },
  );
}

type MessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

/** Non-extension contexts (design showcase, jsdom) keep listeners here so a
 *  mock backend can push messages (e.g. JOB_EVENT). */
function listenerRegistry(): Set<MessageListener> {
  const g = globalThis as { __cellOnMessageListeners?: Set<MessageListener> };
  if (!g.__cellOnMessageListeners) g.__cellOnMessageListeners = new Set();
  return g.__cellOnMessageListeners;
}

export function onMessage(callback: MessageListener): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    listenerRegistry().add(callback);
    return;
  }
  chrome.runtime.onMessage.addListener(callback);
}

export function getURL(path: string): string {
  return chrome.runtime.getURL(path);
}

export function getExtensionId(): string {
  return chrome.runtime.id;
}

/** Add a listener for chrome.runtime.onStartup (browser startup). */
export function onStartup(callback: () => void): void {
  chrome.runtime.onStartup.addListener(callback);
}

/** Add a listener for chrome.runtime.onInstalled (extension install/update). */
export function onInstalled(
  callback: (details: chrome.runtime.InstalledDetails) => void,
): void {
  chrome.runtime.onInstalled.addListener(callback);
}

/** Remove a message listener. */
export function removeOnMessageListener(callback: MessageListener): void {
  const g = globalThis as { __cellOnMessageListeners?: Set<MessageListener> };
  if (g.__cellOnMessageListeners) g.__cellOnMessageListeners.delete(callback);
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
  chrome.runtime.onMessage.removeListener(callback);
}
