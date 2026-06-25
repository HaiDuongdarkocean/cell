/**
 * Whitelist utility functions for the auto-download feature.
 *
 * A whitelist entry stores a normalized URL so that revisiting a page
 * triggers an automatic download. The normalization keeps the series/show
 * folder (the "parent" path) and drops the last path segment, which on sites
 * like kisskh.co is the individual episode. This lets a user whitelist an
 * entire show once, then have auto-download fire on every episode of that
 * show. Query strings and hash fragments are always stripped. If the input
 * cannot be parsed as a URL it is returned unchanged as a safe fallback.
 *
 * Examples:
 *   - https://site.com/show/Episode-1?id=1   -> https://site.com/show
 *   - https://site.com/show/                 -> https://site.com/show
 *   - https://site.com/show                 -> https://site.com
 *   - https://site.com/                     -> https://site.com
 * All persistence goes through `chrome.storage.local` under the
 * {@link STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST} key.
 */

import { STORAGE_KEYS } from '@/constants/config';
import type { WhitelistEntry } from '@/types/media';

/**
 * Normalize a URL for the auto-download whitelist.
 *
 * Strips the query string, hash fragment, and every pathname segment after
 * the first one. This means whitelisting any episode of a show effectively
 * whitelists the whole show category (e.g. `/Drama`) on the site, so
 * navigating to another episode under the same category automatically
 * triggers auto-download. Different domains (e.g. anime.uniquestream.net)
 * never share a whitelist entry.
 *
 * @param rawUrl - The raw URL to normalize.
 * @returns The normalized category URL, or the original string on parse failure.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    const trimmed = pathname.replace(/\/$/, '');
    const firstSlash = trimmed.indexOf('/', 1);
    const basePath = firstSlash > 0 ? trimmed.slice(0, firstSlash) : trimmed;
    return parsed.origin + basePath;
  } catch {
    return rawUrl;
  }
}

/**
 * Read all whitelist entries from `chrome.storage.local`.
 *
 * @returns The stored entries, or an empty array when none exist.
 */
export async function getWhitelist(): Promise<WhitelistEntry[]> {
  const result = await chrome.storage.local.get(
    STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST,
  );
  const entries = result[STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST];
  return Array.isArray(entries) ? entries : [];
}

/**
 * Persist the given whitelist entries to storage.
 */
async function saveWhitelist(entries: WhitelistEntry[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST]: entries,
  });
}

/**
 * Check whether a URL (normalized) is present in the whitelist.
 *
 * @param url - The URL to check (will be normalized before comparison).
 * @returns `true` if a matching entry exists, `false` otherwise.
 */
export async function isWhitelisted(url: string): Promise<boolean> {
  const normalized = normalizeUrl(url);
  const entries = await getWhitelist();
  return entries.some((entry) => entry.url === normalized);
}

/**
 * Add a URL to the whitelist. The operation is idempotent: adding a URL that
 * is already present (compared by normalized form) does not create a
 * duplicate.
 *
 * @param url - The URL to add (will be normalized).
 * @param tabId - Optional tab id that originated the add (debug only).
 * @returns The updated whitelist entries.
 */
export async function addToWhitelist(
  url: string,
  tabId?: number,
): Promise<WhitelistEntry[]> {
  const normalized = normalizeUrl(url);
  const entries = await getWhitelist();
  if (entries.some((entry) => entry.url === normalized)) {
    return entries;
  }
  const newEntry: WhitelistEntry = {
    url: normalized,
    addedAt: Date.now(),
    tabId,
  };
  const updated = [...entries, newEntry];
  await saveWhitelist(updated);
  return updated;
}

/**
 * Remove a URL from the whitelist (compared by normalized form).
 *
 * @param url - The URL to remove (will be normalized).
 * @returns The updated whitelist entries.
 */
export async function removeFromWhitelist(
  url: string,
): Promise<WhitelistEntry[]> {
  const normalized = normalizeUrl(url);
  const entries = await getWhitelist();
  const updated = entries.filter((entry) => entry.url !== normalized);
  await saveWhitelist(updated);
  return updated;
}
