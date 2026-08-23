/**
 * sortVideosByNumericSuffix — sort video filenames by trailing numeric
 * suffix (1 → N), falling back to alphabetical when no suffix.
 *
 *   ["Movie.3.mp4", "Movie.1.mp4", "Movie.2.mp4"] → 1, 2, 3
 *   ["Beta.mp4", "Alpha.mp4"]                    → Alpha, Beta
 *   ["S01E02.mp4", "S01E10.mp4", "S01E01.mp4"]   → E01, E02, E10
 *
 * Ponytail: O(n log n) sort. Acceptable for drag-drop (n ≤ ~50 files).
 * Upgrade: natural sort (Collator numeric) if edge cases appear.
 */

/** Extract the last numeric run from a filename (without extension). */
function trailingNumber(filename: string): number | null {
  const dotIdx = filename.lastIndexOf('.');
  const stem = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const match = stem.match(/(\d+)$/);
  return match ? parseInt(match[1]!, 10) : null;
}

export function sortVideosByNumericSuffix(filenames: readonly string[]): string[] {
  return [...filenames].sort((a, b) => {
    const na = trailingNumber(a);
    const nb = trailingNumber(b);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return a.localeCompare(b);
  });
}
