/**
 * Resolves the active *content* tab (a real web page), robust against
 * browser-side windows that are themselves `active: true` but are NOT content
 * tabs — most notably Edge's built-in app-windows (e.g. the dictionary sidebar
 * at `chrome-extension://<id>/pages/app-window/...`).
 *
 * ## Why this helper exists
 *
 * The popup hooks previously used `chrome.tabs.query({ active: true,
 * currentWindow: false })` to grab "the active tab in a browser window, not the
 * popup window". On Chrome this works because the only other active tab is the
 * content tab. On Edge, however, a built-in app-window can be `active: true`
 * in its own window, so `currentWindow: false` returns THAT
 * `chrome-extension://` tab instead of the content tab. The background then
 * looks up media for the extension tab id, finds nothing, and the popup renders
 * empty with no console error.
 *
 * The fix is to never trust a single `tabs.query` shape: gather candidates from
 * several queries, then pick the first one whose URL is NOT a
 * `chrome-extension://` URL. This matches the manual fallback already used in
 * `App.redesigned.tsx` for the auto-download whitelist check, and works on both
 * Chrome (no app-window interference) and Edge.
 *
 * @returns the active content tab, or `undefined` if none is found.
 */
export async function getActiveContentTab(): Promise<
  chrome.tabs.Tab | undefined
> {
  // Query several shapes IN PARALLEL (one microtask, not three) and merge
  // candidates in priority order:
  //   1. active tab of the current window (the popup's own window — usually
  //      the popup itself, but cheap to check)
  //   2. active tab of the last-focused window
  //   3. any active tab across all windows
  //   4. any tab at all
  // Then pick the first candidate whose URL is NOT a chrome-extension page.
  const [currentTabs, lastFocusedTabs, allTabs] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    chrome.tabs.query({}),
  ]);

  const candidates = [
    currentTabs[0],
    lastFocusedTabs[0],
    ...allTabs.filter((t) => t.active),
    ...allTabs,
  ];

  // Skip tabs whose URL is a chrome-extension page (e.g. Edge's app-window
  // sidebars). A tab with no URL (loading, restricted, or mocked) is still
  // accepted — chrome-extension tabs always carry a chrome-extension:// URL,
  // so a missing URL never masks one.
  return candidates.find(
    (t): t is chrome.tabs.Tab =>
      Boolean(t) && !t.url?.startsWith('chrome-extension://'),
  );
}

/**
 * Convenience wrapper around {@link getActiveContentTab} that returns just the
 * tab id (or `undefined` when no content tab is active).
 */
export async function getActiveContentTabId(): Promise<number | undefined> {
  const tab = await getActiveContentTab();
  return tab?.id;
}
