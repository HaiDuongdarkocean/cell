import type { VttCue, VttSubtitle } from '@/entities/media';

/**
 * Parse a WebVTT (.vtt) subtitle string into a structured VttSubtitle.
 *
 * Pure function — no side effects, no Chrome API.
 *
 * Rules:
 * - Content must start with "WEBVTT" (after optional BOM / leading whitespace).
 * - Empty / whitespace-only content throws Error.
 * - Cue ID is optional (numeric or string line preceding the timing line).
 * - Timing line: `HH:MM:SS.mmm --> HH:MM:SS.mmm` with optional cue settings
 *   (align, line, position, ...) which are ignored for MVP.
 * - Cues with malformed timing are skipped.
 * - start / end are returned as milliseconds (number).
 */
export function parseVtt(content: string): VttSubtitle {
  if (content === null || content === undefined) {
    throw new Error('parseVtt: content is required');
  }

  // Strip BOM if present.
  const stripped = content.replace(/^\uFEFF/, '');

  if (stripped.trim().length === 0) {
    throw new Error('parseVtt: content is empty');
  }

  // Header check: first non-empty line must start with "WEBVTT".
  const lines = stripped.split(/\r\n|\r|\n/);
  let lineIndex = 0;
  while (lineIndex < lines.length && lines[lineIndex].trim().length === 0) {
    lineIndex++;
  }

  if (lineIndex >= lines.length) {
    throw new Error('parseVtt: content is empty');
  }

  const headerLine = lines[lineIndex].trim();
  if (!headerLine.startsWith('WEBVTT')) {
    throw new Error('parseVtt: missing WEBVTT header');
  }

  lineIndex++;

  const cues: VttCue[] = [];
  const timingRegex =
    /^(\d{2,}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[.,](\d{3})/;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    // Skip blank lines between cues.
    if (line.trim().length === 0) {
      lineIndex++;
      continue;
    }

    // Determine whether this line is a cue id or a timing line.
    const timingMatch = line.match(timingRegex);
    let id: string | undefined;
    let timingLine: string;

    if (timingMatch) {
      timingLine = line;
    } else {
      // Could be a cue id. Peek next non-empty line for timing.
      const candidateId = line.trim();
      let nextIndex = lineIndex + 1;
      while (nextIndex < lines.length && lines[nextIndex].trim().length === 0) {
        nextIndex++;
      }
      if (nextIndex < lines.length && lines[nextIndex].match(timingRegex)) {
        id = candidateId;
        timingLine = lines[nextIndex];
        lineIndex = nextIndex;
      } else {
        // Not a recognizable cue start; skip the line.
        lineIndex++;
        continue;
      }
    }

    const match = timingLine.match(timingRegex);
    if (!match) {
      // Shouldn't happen given the branch above, but be safe.
      lineIndex++;
      continue;
    }

    const start = toMs(match[1], match[2], match[3], match[4]);
    const end = toMs(match[5], match[6], match[7], match[8]);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      lineIndex++;
      continue;
    }

    // Move past the timing line and collect text lines until blank or EOF.
    lineIndex++;
    const textLines: string[] = [];
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim().length !== 0
    ) {
      textLines.push(lines[lineIndex]);
      lineIndex++;
    }

    cues.push({
      id,
      start,
      end,
      text: textLines.join('\n'),
    });
  }

  return { cues };
}

function toMs(
  hh: string,
  mm: string,
  ss: string,
  mmm: string,
): number {
  const hours = Number.parseInt(hh, 10);
  const minutes = Number.parseInt(mm, 10);
  const seconds = Number.parseInt(ss, 10);
  const millis = Number.parseInt(mmm, 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    Number.isNaN(millis)
  ) {
    return Number.NaN;
  }
  return (
    hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis
  );
}
