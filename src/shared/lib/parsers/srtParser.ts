import type { SrtCue, SrtSubtitle } from '@/entities/media';
import { stripSubtitleTags } from './srtNormalizer';

/**
 * Parses SubRip (.srt) subtitle content into a structured SrtSubtitle object.
 *
 * SRT format:
 *   <index>
 *   HH:MM:SS,mmm --> HH:MM:SS,mmm
 *   <cue text (one or more lines)>
 *   <blank line>
 *
 * Edge cases handled:
 *  - BOM character stripped
 *  - CRLF line endings normalized
 *  - Missing cue index → sequential numbering
 *  - Malformed timing → cue skipped
 *  - Empty content → throws Error
 */
export function parseSrt(content: string): SrtSubtitle {
  // Strip BOM if present
  const stripped = content.replace(/^\uFEFF/, '');
  // Normalize CRLF to LF
  const normalized = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (normalized.trim().length === 0) {
    throw new Error('Cannot parse empty SRT content');
  }

  const blocks = normalized.split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  let sequential = 0;

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (trimmedBlock.length === 0) {
      continue;
    }

    const lines = trimmedBlock.split('\n');
    let lineIndex = 0;

    // Determine whether the first line is a cue index (numeric only)
    let cueIndex: number | undefined;
    if (lines.length > 0 && /^\d+$/.test(lines[0].trim())) {
      cueIndex = parseInt(lines[0].trim(), 10);
      lineIndex = 1;
    }

    // Need at least a timing line
    if (lineIndex >= lines.length) {
      continue;
    }

    const timingLine = lines[lineIndex].trim();
    const timing = parseTimingLine(timingLine);
    lineIndex += 1;

    if (timing === null) {
      // Malformed timing → skip this cue
      continue;
    }

    const textLines = lines.slice(lineIndex);
    const text = stripSubtitleTags(textLines.join('\n')).trim();

    sequential += 1;
    cues.push({
      index: cueIndex ?? sequential,
      start: timing.start,
      end: timing.end,
      text,
    });
  }

  return { cues };
}

interface ParsedTiming {
  readonly start: number;
  readonly end: number;
}

const TIMING_REGEX =
  /^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})$/;

function parseTimingLine(line: string): ParsedTiming | null {
  const match = line.match(TIMING_REGEX);
  if (match === null) {
    return null;
  }

  const start = toMilliseconds(
    match[1],
    match[2],
    match[3],
    match[4],
  );
  const end = toMilliseconds(
    match[5],
    match[6],
    match[7],
    match[8],
  );

  return { start, end };
}

function toMilliseconds(
  hours: string,
  minutes: string,
  seconds: string,
  milliseconds: string,
): number {
  return (
    parseInt(hours, 10) * 3_600_000 +
    parseInt(minutes, 10) * 60_000 +
    parseInt(seconds, 10) * 1_000 +
    parseInt(milliseconds, 10)
  );
}
