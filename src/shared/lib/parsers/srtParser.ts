import type { SrtCue, SrtSubtitle } from '@/entities/media';
import { timePartsToMs } from '@/shared/utils/timeUtils';
import { stripSubtitleTags } from './srtNormalizer';

export function parseSrt(content: string): SrtSubtitle {
  const stripped = content.replace(/^\uFEFF/, '');
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

    let cueIndex: number | undefined;
    if (lines.length > 0 && /^\d+$/.test(lines[0].trim())) {
      cueIndex = parseInt(lines[0].trim(), 10);
      lineIndex = 1;
    }

    if (lineIndex >= lines.length) {
      continue;
    }

    let timingLine = lines[lineIndex].trim();
    let timing = parseTimingLine(timingLine);

    while (timing === null && lineIndex + 1 < lines.length) {
      lineIndex += 1;
      timingLine = lines[lineIndex].trim();
      timing = parseTimingLine(timingLine);
    }

    if (timing === null) {
      continue;
    }
    lineIndex += 1;

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

  const start = timePartsToMs(
    match[1],
    match[2],
    match[3],
    match[4],
  );
  const end = timePartsToMs(
    match[5],
    match[6],
    match[7],
    match[8],
  );

  return { start, end };
}
