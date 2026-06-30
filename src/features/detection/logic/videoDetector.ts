import { VIDEO_URL_PATTERNS } from '@/shared/config/urls';
import type {
  DetectedVideo,
  NetworkRequest,
  VideoFormat,
  VideoVariant,
} from '@/types/media';

/**
 * Extract the file extension (without the leading dot) from a URL pathname,
 * ignoring query strings and fragments.
 */
function extractExtension(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    const dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
      return null;
    }
    return lastSegment.slice(dotIndex + 1).toLowerCase();
  } catch {
    // URL may be malformed; fall back to manual extraction
    const noQuery = url.split('?')[0]?.split('#')[0] ?? url;
    const lastSegment = noQuery.slice(noQuery.lastIndexOf('/') + 1);
    const dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
      return null;
    }
    return lastSegment.slice(dotIndex + 1).toLowerCase();
  }
}

/**
 * Extract a human-readable title from the URL pathname (last segment without
 * extension and without query string).
 */
function extractTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    const dotIndex = lastSegment.lastIndexOf('.');
    const base = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
    return base.length > 0 ? base : 'video';
  } catch {
    const noQuery = url.split('?')[0]?.split('#')[0] ?? url;
    const lastSegment = noQuery.slice(noQuery.lastIndexOf('/') + 1);
    const dotIndex = lastSegment.lastIndexOf('.');
    const base = dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
    return base.length > 0 ? base : 'video';
  }
}

/**
 * Generate a unique identifier for a detected video. Prefers `crypto.randomUUID`
 * when available, falling back to a timestamp + random combination.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Determine whether a URL matches any of the known video URL patterns.
 */
function matchesVideoPattern(url: string): boolean {
  return VIDEO_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Detect a downloadable video from a captured network request.
 *
 * - `.ts` segment URLs are ignored (return `null`) because individual transport
 *   stream segments are not standalone videos; only `.m3u8` playlists are.
 * - `.m3u8` URLs produce a `DetectedVideo` with an empty `variants` array that
 *   will be populated after parsing the playlist.
 * - `.mp4` / `.webm` URLs produce a `DetectedVideo` with a single `auto`-quality
 *   variant pointing at the URL itself.
 *
 * @returns a `DetectedVideo` when the URL matches a video pattern, otherwise `null`.
 */
export function detectVideo(request: NetworkRequest): DetectedVideo | null {
  if (!matchesVideoPattern(request.url)) {
    return null;
  }

  const ext = extractExtension(request.url);
  if (ext === null) {
    return null;
  }

  // Individual .ts segments are not standalone downloadable videos.
  if (ext === 'ts') {
    return null;
  }

  const format: VideoFormat = ext as VideoFormat;
  const title = extractTitle(request.url);
  const id = generateId();

  let variants: VideoVariant[];
  if (format === 'm3u8') {
    variants = [];
  } else {
    variants = [{ url: request.url, quality: 'auto' }];
  }

  return {
    id,
    url: request.url,
    format,
    title,
    tabId: request.tabId,
    // Placeholder: the background script will update this with the actual tab URL.
    tabUrl: request.url,
    detectedAt: request.timeStamp,
    variants,
  };
}
