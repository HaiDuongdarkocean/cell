import type { ByteRange } from '@/entities/media';
import { MAX_RETRY, SEGMENT_TIMEOUT_MS } from '@/shared/config/config';
import { t } from '@/shared/i18n';

/**
 * Build request headers that match the browser's page context.
 *
 * Many streaming CDNs return 403 when the video URL is fetched without the
 * same `Referer` and `Origin` as the page that loaded the player. This helper
 * derives both headers from the original tab URL so the extension's fetch
 * requests look like they came from the browser tab.
 *
 * @param tabUrl - URL of the tab where the media was detected
 * @returns Headers object with `Referer` and `Origin`, or `undefined` if tabUrl is missing/invalid
 */
export function buildFetchHeaders(tabUrl?: string): Record<string, string> | undefined {
  if (!tabUrl) return undefined;
  try {
    const origin = new URL(tabUrl).origin;
    return {
      Referer: tabUrl,
      Origin: origin,
    };
  } catch {
    return undefined;
  }
}

/**
 * Fetch a single segment with retry and timeout.
 *
 * Retries up to MAX_RETRY times on network/abort error. Each attempt is
 * aborted after SEGMENT_TIMEOUT_MS.
 */
export async function fetchSegment(
  url: string,
  tabUrl?: string,
  signal?: AbortSignal,
): Promise<Blob> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);
    try {
      // Use `credentials: 'same-origin'` for ALL cross-origin CDN fetches.
      // Most CDNs return `Access-Control-Allow-Origin: *` without
      // `Access-Control-Allow-Credentials: true` — using `'include'` would
      // cause the browser to BLOCK the response (CORS policy violation).
      // CDN auth is typically via Referer/signed-URL, not cookies.
      //
      // Add Referer/Origin headers from the source tab to avoid 403 hotlink
      // protection on some CDNs.
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'same-origin',
        headers: buildFetchHeaders(tabUrl),
      });
      if (!response.ok) {
        throw new Error(t('downloads.error.segmentFetch', [response.status]));
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error(t('downloads.error.segmentEmpty'));
      }
      return blob;
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new Error('Download cancelled', { cause: err });
      }
      lastError = err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(t('downloads.error.segmentFailed'));
}

/**
 * Fetch a segment with optional byte-range support.
 *
 * When `byteRange` is provided, adds a `Range: bytes=start-end` header.
 * Accepts both 206 (Partial Content) and 200 (full content) responses.
 */
export async function fetchSegmentWithRange(
  url: string,
  tabUrl: string | undefined,
  byteRange?: ByteRange,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!byteRange) {
    return fetchSegment(url, tabUrl, signal);
  }

  if (signal?.aborted) {
    throw new Error('Download cancelled');
  }
  const start = byteRange.offset ?? 0;
  const end = start + byteRange.length - 1;
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        ...buildFetchHeaders(tabUrl),
        Range: `bytes=${start}-${end}`,
      },
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(t('downloads.error.rangeFetch', [response.status]));
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(t('downloads.error.rangeEmpty'));
    }
    return blob;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
