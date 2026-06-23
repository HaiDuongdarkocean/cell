/**
 * File name utility functions for sanitizing and building download filenames.
 */

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
