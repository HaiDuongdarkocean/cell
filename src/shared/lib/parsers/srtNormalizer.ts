import { msToSrtTime, timePartsToMs } from '@/shared/utils/timeUtils';

interface NormalizedCue {
  start: number;
  end: number;
  text: string;
}

const TIMING_RE =
  /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

const NAMED_SUBTITLE_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeSubtitleEntities(text: string): string {
  return text.replace(/&([a-zA-Z]+|#\d+|#[xX][0-9a-fA-F]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_SUBTITLE_ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function stripSubtitleTags(text: string): string {
  const stripped = text.replace(/\{[^}]*\}/g, '').replace(/<[^>]*>/g, '');
  return decodeSubtitleEntities(stripped).replace(/\u00A0/g, ' ');
}

export function collapseCueTextLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function stripInlineTags(text: string): string {
  return collapseCueTextLines(stripSubtitleTags(text));
}

export function emitSrtBlocks(cues: readonly { start: number; end: number; text: string }[]): string {
  const blocks = cues.map((cue, index) => {
    const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
    return [String(index + 1), timing, cue.text].join('\n');
  });
  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

function parseSrtLike(content: string): NormalizedCue[] {
  const stripped = content.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r\n|\r|\n/);

  const cues: NormalizedCue[] = [];
  let i = 0;

  while (i < lines.length && lines[i].trim().length === 0) {
    i++;
  }
  if (i < lines.length && lines[i].trim().toUpperCase().startsWith('WEBVTT')) {
    i++;
    while (i < lines.length && lines[i].trim().length !== 0) {
      i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().length === 0) {
      i++;
      continue;
    }

    const timingMatch = line.match(TIMING_RE);
    let timingLine: string;

    if (timingMatch) {
      timingLine = line;
    } else {
      let nextIdx = i + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim().length === 0) {
        nextIdx++;
      }
      if (nextIdx < lines.length && lines[nextIdx].match(TIMING_RE)) {
        timingLine = lines[nextIdx];
        i = nextIdx;
      } else {
        i++;
        continue;
      }
    }

    const match = timingLine.match(TIMING_RE);
    if (!match) {
      i++;
      continue;
    }

    const start = timePartsToMs(match[1], match[2], match[3], match[4]);
    const end = timePartsToMs(match[5], match[6], match[7], match[8]);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      i++;
      continue;
    }

    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim().length !== 0) {
      textLines.push(lines[i]);
      i++;
    }

    const text = stripInlineTags(textLines.join('\n'));
    if (text.length > 0) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

export function normalizeSrt(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }
  return emitSrtBlocks(parseSrtLike(content));
}
