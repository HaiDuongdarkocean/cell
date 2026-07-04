import type { SrtCue } from '@/entities/media';

/**
 * Binary search to find current subtitle line based on video time.
 * O(log n) performance for large subtitle files.
 *
 * @param lines - Array of subtitle cues (SrtCue[])
 * @param currentTime - Current video time in milliseconds
 * @param offsetMs - Time offset in ms (default 0). +offset = sub muộn → search time tăng.
 *                   Applied at search level, không mutate SrtCue (ADR-019 AD1).
 * @returns Index of current line, or -1 if no line matches
 */
export function findCurrentLine(lines: SrtCue[], currentTime: number, offsetMs: number = 0): number {
  if (lines.length === 0) {
    return -1;
  }

  const effective = currentTime + offsetMs;

  let left = 0;
  let right = lines.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (effective >= lines[mid].start && effective <= lines[mid].end) {
      return mid;
    } else if (effective < lines[mid].start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}
