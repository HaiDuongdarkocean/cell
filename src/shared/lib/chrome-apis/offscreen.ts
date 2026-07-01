/**
 * chrome.offscreen adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps createDocument.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/offscreen
 */

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
