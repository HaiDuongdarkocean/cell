/**
 * chrome.storage adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Features/ + shared/ callers MUST use this adapter, not chrome.storage.*.
 *
 * Wraps chrome.storage.local (MV3 promise-based API).
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/storage
 */

export async function getStorage<T extends Record<string, unknown>>(
  keys?: string | string[] | null,
): Promise<T> {
  return chrome.storage.local.get(keys ?? null) as Promise<T>;
}

export async function setStorage(
  items: Record<string, unknown>,
): Promise<void> {
  await chrome.storage.local.set(items);
}

export async function removeStorage(keys: string | string[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}

export function onStorageChanged(
  callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
): void {
  chrome.storage.onChanged.addListener(callback);
}
