import type { VttCue, VttSubtitle } from '@/entities/media';
import { timePartsToMs } from '@/shared/utils/timeUtils';
import { stripSubtitleTags } from './srtNormalizer';

export function parseVtt(content: string): VttSubtitle {
  if (content === null || content === undefined) {
    throw new Error('parseVtt: content is required');
  }

  const stripped = content.replace(/^\uFEFF/, '');

  if (stripped.trim().length === 0) {
    throw new Error('parseVtt: content is empty');
  }

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
    /^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})/;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.trim().length === 0) {
      lineIndex++;
      continue;
    }

    const timingMatch = line.match(timingRegex);
    let id: string | undefined;
    let timingLine: string;

    if (timingMatch) {
      timingLine = line;
    } else {
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
        lineIndex++;
        continue;
      }
    }

    const match = timingLine.match(timingRegex);
    if (!match) {
      lineIndex++;
      continue;
    }

    const start = timePartsToMs(match[1], match[2], match[3], match[4]);
    const end = timePartsToMs(match[5], match[6], match[7], match[8]);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      lineIndex++;
      continue;
    }

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
      text: stripSubtitleTags(textLines.join('\n')),
    });
  }

  return { cues };
}
