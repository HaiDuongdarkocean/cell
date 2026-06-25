/**
 * File name utility functions for sanitizing and building download filenames.
 */

import type { FilenameSource } from '@/types/media';
import { GENERIC_TITLES } from '@/constants/config';

/**
 * Remove invalid filename characters (`<>:"/\|?*`) and replace spaces with
 * underscores.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/ /g, '_');
}

/**
 * Replace the file extension of a filename. `newExt` is provided without a
 * leading dot.
 */
export function changeExtension(filename: string, newExt: string): string {
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${base}.${newExt}`;
}

/**
 * Generate a download filename from a title and extension.
 *
 * The title is sanitized; when an `index` is provided it is appended as
 * `_(index)` before the extension. `ext` is provided without a leading dot.
 */
export function generateFileName(
  title: string,
  ext: string,
  index?: number,
): string {
  const sanitized = sanitizeFileName(title);
  const indexPart = index !== undefined ? `_(${index})` : '';
  return `${sanitized}${indexPart}.${ext}`;
}

/**
 * Extract a human-readable base name from a URL, using **all meaningful path
 * segments** (not just the last one).
 *
 * Strategy:
 *   1. Parse the URL pathname.
 *   2. Split into segments, filter out empty/common-noise segments
 *      (`' Drama'`, `'xuyen-khong'` category prefixes are kept — only
 *      truly empty or single-char noise is dropped).
 *   3. Strip file extension from the last segment.
 *   4. Join remaining segments with `'/'` (beautify step will replace).
 *
 * Falls back to `'media'` when the URL is invalid or has no usable path.
 *
 * Examples:
 *   `https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=...`
 *     → `Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1`
 *   `https://yanhh3d.ee/xuyen-khong/thon-phe-tinh-khong/tap-33.html`
 *     → `xuyen-khong/thon-phe-tinh-khong/tap-33`
 */
export function extractBaseNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    // Split, filter empty segments, strip extension from last
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) return 'media';

    // Strip extension from the last segment
    const last = segments[segments.length - 1];
    const dot = last.lastIndexOf('.');
    if (dot > 0) {
      segments[segments.length - 1] = last.slice(0, dot);
    }

    return segments.join('/');
  } catch {
    return 'media';
  }
}

/**
 * Beautify a raw URL path (may contain `/` separators) into a human-readable
 * string.
 *
 * Pipeline:
 *   1. `decodeURIComponent` (graceful fallback on invalid %).
 *   2. Strip query/hash remnants.
 *   3. Replace `---` (triple dash, common in URL slugs) → ` - ` (em-dash
 *      style separator with spaces).
 *   4. Replace `--` (double dash) → ` - `.
 *   5. Replace remaining `[-_.+]` with spaces.
 *   6. Smart apostrophe: ` s ` → `'s ` (possessive), e.g. "Girl s" → "Girl's".
 *   7. Replace `/` with ` - ` (segment separator, more readable than space).
 *   8. Collapse multiple spaces, trim.
 *
 * Examples:
 *   `Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1`
 *     → `Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1`
 *   `xuyen-khong/thon-phe-tinh-khong/tap-33`
 *     → `xuyen khong - thon phe tinh khong - tap 33`
 *   `my_video_title_1080p`
 *     → `my video title 1080p`
 */
export function beautifyUrlFilename(raw: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  // Strip any leftover query/hash fragments
  decoded = decoded.split(/[?#]/)[0];

  // Smart apostrophe BEFORE dash replacement:
  // URL slugs use "Girl-s-Guide" for "Girl's Guide".
  // Pattern: word + dash + s + dash → keep 's attached.
  // "Girl-s-Guide" → "Girl's-Guide" (then dash replace handles the rest)
  decoded = decoded.replace(/(\w)-s-/g, "$1's-");
  // Also handle "s" at end before extension/segment boundary: "Girl-s" → "Girl's"
  decoded = decoded.replace(/(\w)-s$/g, "$1's");

  // Triple/double dash → "/" placeholder (will become " - " after slash replace).
  // Using "/" as intermediate avoids the single-dash replace clobbering the separator.
  decoded = decoded.replace(/-{3,}/g, ' / ').replace(/-{2}/g, ' / ');

  // Replace separators (- _ . +) with spaces
  let spaced = decoded.replace(/[-_.+]+/g, ' ');

  // Replace path separators (/) with " - " for readability.
  // This handles both original URL path segments AND the triple/double-dash placeholders.
  spaced = spaced.replace(/\//g, ' - ');

  // Collapse multiple spaces, trim
  spaced = spaced.replace(/\s+/g, ' ').trim();

  if (spaced.length === 0) return 'media';

  return spaced;
}

/**
 * Check whether a detected media title is "meaningful" — non-empty, above a
 * minimum length, and not in the generic-titles blacklist.
 */
export function isTitleMeaningful(title: string | undefined | null): title is string {
  if (!title) return false;
  const trimmed = title.trim();
  if (trimmed.length < 3) return false;
  return !GENERIC_TITLES.has(trimmed.toLowerCase());
}

/**
 * Resolve the base name (without extension) for a download according to the
 * user's `filenameSource` setting.
 *
 * - `'title-fallback'` — use the title if meaningful; otherwise beautify the
 *   URL base name.
 * - `'title-only'`     — use the title if meaningful; otherwise `'untitled'`.
 * - `'url-only'`       — always beautify the URL base name, ignoring title.
 *
 * The returned string is **not yet sanitized** — callers should pass it
 * through `generateFileName()` (which sanitizes) to produce the final
 * filename.
 */
export function resolveFilenameBase(
  mode: FilenameSource,
  title: string | undefined,
  url: string,
): string {
  switch (mode) {
    case 'url-only':
      return beautifyUrlFilename(extractBaseNameFromUrl(url));

    case 'title-only':
      return isTitleMeaningful(title) ? title! : 'untitled';

    case 'title-fallback':
    default:
      if (isTitleMeaningful(title)) return title!;
      return beautifyUrlFilename(extractBaseNameFromUrl(url));
  }
}

/**
 * Build a subtitle filename from a base name, language tag, and extension.
 *
 * The base name is sanitized via `sanitizeFileName`. The language tag is
 * trimmed, stripped of filename-invalid characters (including parentheses /
 * brackets which are not in `sanitizeFileName`'s default set but are
 * undesirable in a language suffix), has spaces replaced with underscores,
 * and is lowercased. When the sanitized language is empty (undefined, empty
 * string, whitespace-only, or all-invalid chars), no suffix is appended —
 * the result is `<base>.<ext>` (matching the video filename convention).
 *
 * `ext` is provided without a leading dot.
 *
 * Examples:
 *   `buildSubtitleFileName('See You at Work Tomorrow!', 'en', 'srt')`
 *     → `See_You_at_Work_Tomorrow!.en.srt`
 *   `buildSubtitleFileName('My Video', undefined, 'srt')`
 *     → `My_Video.srt`
 *   `buildSubtitleFileName('Movie', 'português (BR)', 'srt')`
 *     → `Movie.português_br.srt`
 */
export function buildSubtitleFileName(
  base: string,
  language: string | undefined,
  ext: string,
): string {
  const sanitizedBase = sanitizeFileName(base);
  const langTrimmed = (language ?? '').trim();
  // 'unknown' is the sentinel returned by extractLanguage() when no language
  // is detected from the URL. Treat it as "no language" — no suffix.
  if (langTrimmed.length === 0 || langTrimmed.toLowerCase() === 'unknown') {
    return `${sanitizedBase}.${ext}`;
  }
  const sanitizedLang = langTrimmed
    .replace(/[<>:"/\\|?*\[\](){}]/g, '')
    .replace(/ /g, '_')
    .toLowerCase();
  if (sanitizedLang.length === 0) {
    return `${sanitizedBase}.${ext}`;
  }
  return `${sanitizedBase}.${sanitizedLang}.${ext}`;
}
