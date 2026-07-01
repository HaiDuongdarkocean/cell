/**
 * chrome.downloads adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps download, onDeterminingFilename.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/downloads
 */

export function download(
  options: chrome.downloads.DownloadOptions,
): Promise<number> {
  return chrome.downloads.download(options);
}

export function searchDownloads(
  query: chrome.downloads.DownloadQuery,
): Promise<chrome.downloads.DownloadItem[]> {
  return chrome.downloads.search(query);
}

/** Add a listener for downloads.onDeterminingFilename. Returns an unsubscribe function. */
export function addOnDeterminingFilenameListener(
  listener: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0],
): () => void {
  chrome.downloads.onDeterminingFilename.addListener(listener);
  return () => chrome.downloads.onDeterminingFilename.removeListener(listener);
}

/** Add a listener for downloads.onChanged. Returns an unsubscribe function. */
export function addOnDownloadsChangedListener(
  listener: (delta: chrome.downloads.DownloadDelta) => void,
): () => void {
  chrome.downloads.onChanged.addListener(listener);
  return () => chrome.downloads.onChanged.removeListener(listener);
}

/** Remove a downloads.onChanged listener. */
export function removeOnDownloadsChangedListener(
  listener: (delta: chrome.downloads.DownloadDelta) => void,
): void {
  chrome.downloads.onChanged.removeListener(listener);
}
