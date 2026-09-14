export function getOpenCvUrl(): string | null {
  const hasGetUrl = typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function';
  if (!hasGetUrl) return null;
  return new URL('./opencv.js', import.meta.url).href;
}
