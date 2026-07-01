/**
 * chrome.action adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps badge text/color APIs.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/action
 */

/** Set the badge text for a tab (or globally if no tabId). */
export async function setBadgeText(options: {
  text: string;
  tabId?: number;
}): Promise<void> {
  await chrome.action.setBadgeText(options);
}

/** Set the badge background color for a tab. */
export async function setBadgeBackgroundColor(options: {
  color: string;
  tabId?: number;
}): Promise<void> {
  await chrome.action.setBadgeBackgroundColor(options);
}

/** Set the badge text color for a tab. */
export async function setBadgeTextColor(options: {
  color: string;
  tabId?: number;
}): Promise<void> {
  await chrome.action.setBadgeTextColor(options);
}
