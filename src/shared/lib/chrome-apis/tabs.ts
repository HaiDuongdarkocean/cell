/**
 * chrome.tabs adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps query, get, sendMessage.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/tabs
 */

export async function queryTabs(
  queryInfo: chrome.tabs.QueryInfo,
): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query(queryInfo);
}

export async function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return chrome.tabs.get(tabId);
}

export async function sendTabMessage<T = unknown>(
  tabId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}
