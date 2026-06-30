/**
 * chrome.runtime adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps sendMessage, onMessage, getURL, id.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/runtime
 */

export async function sendMessage<T = unknown>(
  message: unknown,
): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function onMessage(
  callback: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ) => boolean | Promise<unknown> | void,
): void {
  chrome.runtime.onMessage.addListener(callback);
}

export function getURL(path: string): string {
  return chrome.runtime.getURL(path);
}

export function getExtensionId(): string {
  return chrome.runtime.id;
}
