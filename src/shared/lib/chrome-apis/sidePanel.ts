/**
 * chrome.sidePanel adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps open + setOptions.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
 */

/** Open the side panel for a specific tab. Requires Chrome 116+. */
export async function openSidePanel(options: {
  tabId?: number;
  windowId?: number;
}): Promise<void> {
  await chrome.sidePanel.open(options as Parameters<typeof chrome.sidePanel.open>[0]);
}

/** Close the side panel. Requires Chrome 141+ (Edge 141+). */
export async function closeSidePanel(options: {
  tabId?: number;
  windowId?: number;
}): Promise<void> {
  await chrome.sidePanel.close(options as Parameters<typeof chrome.sidePanel.close>[0]);
}

/** Set side panel behavior (e.g. openPanelOnActionClick). */
export async function setSidePanelBehavior(
  options: { openPanelOnActionClick?: boolean },
): Promise<void> {
  await chrome.sidePanel.setPanelBehavior(options);
}
