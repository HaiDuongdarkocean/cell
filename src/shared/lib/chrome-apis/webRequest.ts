/**
 * chrome.webRequest adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps onBeforeRequest listener registration.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/webRequest
 */

export type WebRequestListener = Parameters<
  typeof chrome.webRequest.onBeforeRequest.addListener
>[0];

/** Add a listener for webRequest.onBeforeRequest. Returns an unsubscribe function. */
export function addOnBeforeRequestListener(
  listener: WebRequestListener,
  filter?: chrome.webRequest.RequestFilter,
): () => void {
  // The addListener signature requires a filter or an info array; pass an empty
  // filter when none is specified so the listener receives all requests.
  chrome.webRequest.onBeforeRequest.addListener(
    listener,
    filter ?? { urls: ['<all_urls>'] },
  );
  return () => chrome.webRequest.onBeforeRequest.removeListener(listener);
}
