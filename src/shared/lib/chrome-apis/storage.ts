/**
 * chrome.storage adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Features/ + shared/ callers MUST use this adapter, not chrome.storage.*.
 *
 * Wraps chrome.storage.local + chrome.storage.session (MV3 promise-based API).
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/storage
 */

// --- chrome.storage.local ---

export function getStorage<T extends Record<string, unknown>>(
  keys?: string | string[] | null,
): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve({} as T);
  }
  return chrome.storage.local.get(keys ?? null) as Promise<T>;
}

export async function setStorage(
  items: Record<string, unknown>,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set(items);
}

export async function removeStorage(keys: string | string[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.remove(keys);
}

// --- chrome.storage.session ---

export function getSessionStorage<T extends Record<string, unknown>>(
  keys?: string | string[] | null,
): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return Promise.resolve({} as T);
  }
  return chrome.storage.session.get(keys ?? null) as Promise<T>;
}

export async function setSessionStorage(
  items: Record<string, unknown>,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
  await chrome.storage.session.set(items);
}

export async function removeSessionStorage(keys: string | string[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
  await chrome.storage.session.remove(keys);
}

// --- chrome.storage.onChanged ---

export function onStorageChanged(
  callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener(callback);
}

/** Remove a storage.onChanged listener. */
export function removeOnStorageChangedListener(
  callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.removeListener(callback);
}
