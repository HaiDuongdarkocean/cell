/**
 * URL utility functions for resolving and normalizing URLs.
 */

/**
 * Resolve a relative URL against a base URL using the URL API.
 */
export function resolveUrl(base: string, relative: string): string {
  return new URL(relative, base).href;
}

/**
 * Check whether a URL is absolute (starts with http:// or https://).
 */
export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Extract the file extension from a URL.
 *
 * Strips the query string and fragment, returns the extension without the
 * leading dot and in lowercase. Returns an empty string when no extension
 * is present.
 */
export function getFileExtension(url: string): string {
  // Strip query string and fragment.
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    url = url.slice(0, queryIndex);
  }
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }

  // Take the last path segment.
  const lastSlash = Math.max(url.lastIndexOf('/'), url.lastIndexOf('\\'));
  const segment = lastSlash === -1 ? url : url.slice(lastSlash + 1);

  const dotIndex = segment.lastIndexOf('.');
  if (dotIndex <= 0) {
    return '';
  }
  return segment.slice(dotIndex + 1).toLowerCase();
}

/**
 * Normalize a URL by removing duplicate slashes and stripping a trailing slash.
 *
 * The protocol separator `://` is preserved.
 */
export function normalizeUrl(url: string): string {
  // Collapse repeated slashes that are not part of the protocol separator.
  const deduped = url.replace(/([^:])\/{2,}/g, '$1/');
  // Strip a single trailing slash (but never the protocol's slashes).
  if (deduped.endsWith('/') && !deduped.endsWith('://')) {
    return deduped.slice(0, -1);
  }
  return deduped;
}
