/**
 * chrome.windows adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps onFocusChanged.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/windows
 */

/** Add a listener for windows.onFocusChanged. Returns an unsubscribe function. */
export function addOnWindowFocusChangedListener(
  listener: (windowId: number) => void,
): () => void {
  chrome.windows.onFocusChanged.addListener(listener);
  return () => chrome.windows.onFocusChanged.removeListener(listener);
}

/** Get the WINDOW_ID_NONE constant. */
export function getWindowIdNone(): number {
  return chrome.windows.WINDOW_ID_NONE;
}
