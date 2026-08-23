export type SortBy = 'recent' | 'title' | 'added' | 'duration';

export type VideoEntry = {
  id: string;
  title: string;
  addedAt: string;
  lastWatchedAt: string | null;
  durationMs: number;
  resumePositionMs: number;
};

const compareDesc = (a: string, b: string): number => (a > b ? -1 : a < b ? 1 : 0);

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

/**
 * Case-insensitive natural sort ordered by Unicode code point.
 * Digit runs compare by numeric value (Movie 2 < Movie 10); all other
 * characters compare by lowercased code point so CJK sorts lexicographically
 * (君 < 流 < 사) regardless of host locale.
 */
const naturalCodePointCompare = (a: string, b: string): number => {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a[i];
    const cb = b[j];
    const aDigit = isDigit(ca);
    const bDigit = isDigit(cb);
    if (aDigit && bDigit) {
      let aEnd = i;
      while (aEnd < a.length && isDigit(a[aEnd])) aEnd += 1;
      let bEnd = j;
      while (bEnd < b.length && isDigit(b[bEnd])) bEnd += 1;
      const aNum = Number(a.slice(i, aEnd));
      const bNum = Number(b.slice(j, bEnd));
      if (aNum !== bNum) return aNum < bNum ? -1 : 1;
      const aLen = aEnd - i;
      const bLen = bEnd - j;
      if (aLen !== bLen) return aLen - bLen;
      i = aEnd;
      j = bEnd;
      continue;
    }
    if (aDigit !== bDigit) return aDigit ? -1 : 1;
    const al = ca.toLowerCase();
    const bl = cb.toLowerCase();
    if (al !== bl) return al < bl ? -1 : 1;
    i += 1;
    j += 1;
  }
  return a.length - i - (b.length - j);
};

const compareRecent = (a: VideoEntry, b: VideoEntry): number => {
  // Watched (non-null lastWatchedAt) always before unwatched (null).
  const aWatched = a.lastWatchedAt !== null;
  const bWatched = b.lastWatchedAt !== null;
  if (aWatched !== bWatched) return aWatched ? -1 : 1;
  if (aWatched) {
    const cmp = compareDesc(a.lastWatchedAt!, b.lastWatchedAt!);
    if (cmp !== 0) return cmp;
  }
  // Tiebreaker (same lastWatchedAt, or both unwatched): addedAt desc.
  return compareDesc(a.addedAt, b.addedAt);
};

const compareTitle = (a: VideoEntry, b: VideoEntry): number => {
  const cmp = naturalCodePointCompare(a.title, b.title);
  if (cmp !== 0) return cmp;
  // Identical titles: addedAt asc keeps oldest entry first (stable ordering).
  return -compareDesc(a.addedAt, b.addedAt);
};

const compareAdded = (a: VideoEntry, b: VideoEntry): number => {
  const cmp = compareDesc(a.addedAt, b.addedAt);
  if (cmp !== 0) return cmp;
  return naturalCodePointCompare(a.title, b.title);
};

const compareDuration = (a: VideoEntry, b: VideoEntry): number =>
  a.durationMs - b.durationMs;

const comparators: Record<SortBy, (a: VideoEntry, b: VideoEntry) => number> = {
  recent: compareRecent,
  title: compareTitle,
  added: compareAdded,
  duration: compareDuration,
};

export function sortLibrary(videos: VideoEntry[], sortBy: SortBy): VideoEntry[] {
  const compare = comparators[sortBy];
  // Array.prototype.sort is stable in modern engines (V8/Node ≥11).
  // Copy first so the input is never mutated.
  return [...videos].sort(compare);
}
