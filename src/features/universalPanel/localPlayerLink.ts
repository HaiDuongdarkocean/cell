/** SSOT for the local player page URL — uses chrome.runtime.getURL so the
 *  extension ID is never hardcoded. Falls back to a relative path if the
 *  chrome.runtime API is unavailable (e.g. running outside MV3 context). */
export function getLocalPlayerUrl(): string {
  try {
    return chrome.runtime.getURL('src/entrypoints/local-player/index.html');
  } catch {
    return 'src/entrypoints/local-player/index.html';
  }
}
