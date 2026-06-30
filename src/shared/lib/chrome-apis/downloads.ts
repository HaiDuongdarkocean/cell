/**
 * chrome.downloads adapter — thin wrapper for testability + centralization.
 *
 * Per NF3: chrome.* only in shared/lib/chrome-apis/ + entrypoints/.
 * Wraps download, onDeterminingFilename.
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/downloads
 */

export async function download(
  options: chrome.downloads.DownloadOptions,
): Promise<number> {
  return chrome.downloads.download(options);
}

export async function searchDownloads(
  query: chrome.downloads.DownloadQuery,
): Promise<chrome.downloads.DownloadItem[]> {
  return chrome.downloads.search(query);
}
