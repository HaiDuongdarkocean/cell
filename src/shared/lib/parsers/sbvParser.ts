import type { SrtCue } from '@/entities/media';
import { timePartsToMs } from '@/shared/utils/timeUtils';
import { stripSubtitleTags } from './srtNormalizer';

export function parseSbv(content: string): SrtCue[] {
  const stripped = content.replace(/^\uFEFF/, '');
  const normalized = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (normalized.trim().length === 0) {
    throw new Error('Cannot parse empty SBV content');
  }

  const lines = normalized.split('\n');
  const cues: SrtCue[] = [];
  let index = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().length === 0) {
      i++;
      continue;
    }

    const parsed = parseSbvTimingLine(line);
    if (parsed === null) {
      i++;
      continue;
    }

    const { start, end, inlineText } = parsed;
    i++;

    const textLines: string[] = [];
    if (inlineText !== undefined) {
      textLines.push(inlineText);
    } else {
      while (i < lines.length && lines[i].trim().length !== 0) {
        textLines.push(lines[i]);
        i++;
      }
    }

    const text = stripSubtitleTags(textLines.join('\n')).trim();
    index += 1;
    cues.push({ index, start, end, text });
  }

  return cues;
}

interface SbvTiming {
  readonly start: number;
  readonly end: number;
  readonly inlineText: string | undefined;
}

const SBV_TIMING_RE =
  /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3}),(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})(?:,(.*))?$/;

function parseSbvTimingLine(line: string): SbvTiming | null {
  const match = line.trim().match(SBV_TIMING_RE);
  if (match === null) {
    return null;
  }

  const start = timePartsToMs(match[1], match[2], match[3], match[4]);
  const end = timePartsToMs(match[5], match[6], match[7], match[8]);
  const inlineText = match[9] !== undefined ? match[9] : undefined;

  return { start, end, inlineText };
}
