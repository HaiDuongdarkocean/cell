/**
 * Image search service — Google Images scrape helpers (spec §9.4 B FETCH_IMAGES).
 *
 * Pure functions for building the request URL + parsing image URLs out of the
 * Google Images HTML. Network fetch lives in the background service worker
 * (CORS bypass via host_permissions <all_urls>).
 *
 * Ponytail: Google có thể break regex bất kỳ lúc nào — upgrade to JSON parse
 * nếu có. The current regex scrapes raw image URLs embedded in the HTML;
 * Google may change markup, embed URLs in JSON, or obfuscate them. When that
 * happens, switch `parseGoogleImagesHtml` to parse the embedded JSON
 * (`AF_initDataCallback` blocks) instead of regexing raw hrefs.
 */

import type { ImageItem } from '../types';

/** Default cap on returned images when caller omits maxResults. */
export const DEFAULT_MAX_IMAGE_RESULTS = 8;

/**
 * Build the Google Images search URL for a term.
 *
 * @param term - Search term (will be URL-encoded).
 * @returns `https://www.google.com/search?q=<encoded>&tbm=isch`
 */
export function buildGoogleImagesUrl(term: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch`;
}

// Ponytail: Google có thể break regex bất kỳ lúc nào — upgrade to JSON parse
// nếu có. Matches quoted image URLs ending in .jpg/.png/.jpeg.
const IMAGE_URL_REGEX = /"(https?:\/\/[^"]+?\.(?:jpg|png|jpeg))"/g;

/**
 * Parse Google Images HTML into a deduped list of {@link ImageItem}.
 *
 * Filters out `gstatic.com` (Google UI chrome) and `encrypted` (thumbnail
 * proxies that aren't the source image). Deduplicates by URL. Never throws —
 * returns an empty array on malformed/empty input.
 *
 * @param html - Raw HTML body from Google Images.
 * @param term - Search term used as `alt` text for each item.
 * @param maxResults - Maximum number of items to return.
 * @returns Deduped, filtered image items (id=`img-{idx}`, alt=term,
 *          defaultSelected=false). Empty array if no matches.
 */
export function parseGoogleImagesHtml(
  html: string,
  term: string,
  maxResults: number,
): ImageItem[] {
  if (typeof html !== 'string' || html.length === 0 || maxResults <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const items: ImageItem[] = [];
  let idx = 0;

  for (const match of html.matchAll(IMAGE_URL_REGEX)) {
    const url = match[1];
    if (url.includes('gstatic.com')) continue;
    if (url.includes('encrypted')) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    items.push({
      id: `img-${idx}`,
      alt: term,
      src: url,
      defaultSelected: false,
    });
    idx += 1;

    if (items.length >= maxResults) break;
  }

  return items;
}
