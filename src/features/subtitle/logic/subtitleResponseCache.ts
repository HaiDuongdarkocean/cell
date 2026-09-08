import { formatFromContent } from '@/shared/lib/parsers/subtitleFormat';

const MAX_BODY_CHARS = 500_000;

const cache = new Map<string, string>();

/**
 * Cache a subtitle response body in the content script.
 *
 * Only stores readable subtitle formats (SRT/ASS/VTT) so random JSON/HTML
 * bodies do not bloat the cache. Keyed by the exact URL the player fetched,
 * including its query token, because ephemeral providers sign the full URL.
 */
export function cacheSubtitleBody(url: string, body: string): void {
  if (!url || !body || body.length === 0 || body.length > MAX_BODY_CHARS) return;
  const format = formatFromContent(body);
  if (!format) return;
  cache.set(url, body);
}

/** Return a previously-cached subtitle body, or undefined. */
export function getCachedSubtitleBody(url: string): string | undefined {
  return cache.get(url);
}

/**
 * Poll for a cached subtitle body. The MAIN-world fetch interceptor may have
 * captured the body, but the isolated content script could ask for it before
 * the player fetch resolves. Wait up to `maxWaitMs` with `intervalMs` polling.
 */
export function waitForCachedSubtitleBody(
  url: string,
  maxWaitMs = 3000,
  intervalMs = 100,
): Promise<string | undefined> {
  const start = Date.now();
  return new Promise<string | undefined>((resolve) => {
    const cached = cache.get(url);
    if (cached) {
      resolve(cached);
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      const body = cache.get(url);
      if (body || now - start >= maxWaitMs) {
        clearInterval(id);
        resolve(body);
      }
    }, intervalMs);
  });
}

/** Clear the cache. Called on content-script re-inject (tab navigation). */
export function clearSubtitleBodyCache(): void {
  cache.clear();
}
