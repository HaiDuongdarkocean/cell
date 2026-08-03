/**
 * chrome.tabs adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps query, get, sendMessage.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/tabs
 */

export function queryTabs(
  queryInfo: chrome.tabs.QueryInfo,
): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query(queryInfo);
}

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return chrome.tabs.get(tabId);
}

export function sendTabMessage<T = unknown>(
  tabId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

/**
 * Send a message to a specific frame in a tab. Use when the target content
 * script is known (e.g. the sender of PAGE_SCAN_RESULT/REQUEST_AUTO_LOAD) and
 * chrome.webNavigation.getAllFrames may not yet list the new frame after a
 * cross-origin iframe src change.
 */
export function sendTabMessageToFrame<T = unknown>(
  tabId: number,
  frameId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<T>;
}

/**
 * Send a message to every frame in a tab. Use when the target content script
 * may live in a cross-origin player iframe and the top frame does not host the
 * <video> element. Frames without a matching listener simply ignore the message.
 */
export async function sendMessageToAllFramesInTab(
  tabId: number,
  message: unknown,
): Promise<void> {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames || frames.length === 0) {
      await sendTabMessage(tabId, message);
      return;
    }
    await Promise.allSettled(
      frames.map((frame) =>
        chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId }),
      ),
    );
  } catch {
    // getAllFrames may be unavailable on some contexts; fall back to top frame.
    await sendTabMessage(tabId, message);
  }
}

export function reloadTab(tabId: number): Promise<void> {
  return chrome.tabs.reload(tabId);
}

/** Add a listener for tabs.onUpdated. Returns an unsubscribe function. */
export function addOnTabUpdatedListener(
  listener: (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => void,
): () => void {
  chrome.tabs.onUpdated.addListener(listener);
  return () => chrome.tabs.onUpdated.removeListener(listener);
}

/** Add a listener for tabs.onRemoved. Returns an unsubscribe function. */
export function addOnTabRemovedListener(
  listener: (tabId: number) => void,
): () => void {
  chrome.tabs.onRemoved.addListener(listener);
  return () => chrome.tabs.onRemoved.removeListener(listener);
}

/** Add a listener for tabs.onActivated. Returns an unsubscribe function. */
export function addOnTabActivatedListener(
  listener: (activeInfo: { tabId: number; windowId: number }) => void,
): () => void {
  chrome.tabs.onActivated.addListener(listener);
  return () => chrome.tabs.onActivated.removeListener(listener);
}
