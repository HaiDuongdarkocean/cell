/**
 * Merges an ordered list of .ts (MPEG-2 Transport Stream) segment Blobs into a
 * single contiguous Blob.
 *
 * - Empty input throws an Error.
 * - A single segment is returned as-is (no unnecessary copy).
 * - Multiple segments are concatenated into a new Blob, preserving order
 *   (segments[0] first, segments[n] last).
 *
 * @param segments - Ordered array of .ts segment Blobs to merge.
 * @returns A single Blob containing the concatenated segment data.
 * @throws {Error} When `segments` is an empty array.
 */
export function mergeTsSegments(segments: Blob[]): Blob {
  if (segments.length === 0) {
    throw new Error('Cannot merge empty segments array');
  }

  if (segments.length === 1) {
    return segments[0];
  }

  return new Blob(segments, { type: 'video/mp2t' });
}
