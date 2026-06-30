import type { SrtCue } from '@/types/media';

/**
 * Binary search to find current subtitle line based on video time.
 * O(log n) performance for large subtitle files.
 *
 * @param lines - Array of subtitle cues (SrtCue[])
 * @param currentTime - Current video time in milliseconds
 * @returns Index of current line, or -1 if no line matches
 */
export function findCurrentLine(lines: SrtCue[], currentTime: number): number {
  if (lines.length === 0) {
    return -1;
  }

  let left = 0;
  let right = lines.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (currentTime >= lines[mid].start && currentTime <= lines[mid].end) {
      return mid;
    } else if (currentTime < lines[mid].start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}
