import type { SrtCue } from '@/entities/media';
import { stripSubtitleTags } from './srtNormalizer';

/**
 * Parse YouTube SubViewer (.sbv) caption content into SrtCue[].
 *
 * SBV format (source: YouTube Help — Supported subtitle and closed caption
 *   files, https://support.google.com/youtube/answer/2734698):
 *   - "Only basic versions of these files are supported. No style info
 *      (markup) is recognized. The file must be in plain UTF-8."
 *   - Each cue: `H:MM:SS.mmm,H:MM:SS.mmm` timestamp line (comma-separated
 *      start,end, single-digit hours, period decimal separator), then caption
 *      text on the next line(s), then a blank line.
 *   - No WEBVTT header, no cue indices (unlike SRT).
 *
 * Two valid variants handled:
 *   1. YouTube native: text on the line(s) after the timestamp.
 *   2. Inline: `time1,time2,text` — text appended after the end timestamp on
 *      the same line (some converters emit this).
 *
 * Edge cases:
 *  - BOM stripped, CRLF normalized to LF.
 *  - HTML-like tags (`<b>`, `<i>`, `<font>`) stripped per YouTube spec
 *    ("No style info is recognized") — reuses `stripSubtitleTags`.
 *  - Empty cues (timestamps with no text) kept as blank-text cues.
 *  - Sequential 1-based `index` assigned (SBV has none; SrtCue requires one).
 */
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

    // Skip blank lines between cues.
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    const parsed = parseSbvTimingLine(line);
    if (parsed === null) {
      // Not a timestamp line — skip unrecognized content.
      i++;
      continue;
    }

    const { start, end, inlineText } = parsed;
    i++;

    // Collect text: inline text takes precedence; otherwise gather following
    // non-blank lines until the next blank line or EOF.
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
  /** Text appended inline after the end timestamp, if any. */
  readonly inlineText: string | undefined;
}

/**
 * SBV timestamp line: `H:MM:SS.mmm,H:MM:SS.mmm` optionally followed by
 * `,text` (inline variant). Hours are single-digit per YouTube SBV spec,
 * but `\d{1,2}` tolerates padded forms too.
 */
const SBV_TIMING_RE =
  /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3}),(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})(?:,(.*))?$/;

function parseSbvTimingLine(line: string): SbvTiming | null {
  const match = line.trim().match(SBV_TIMING_RE);
  if (match === null) {
    return null;
  }

  const start = sbvToMs(match[1], match[2], match[3], match[4]);
  const end = sbvToMs(match[5], match[6], match[7], match[8]);
  const inlineText = match[9] !== undefined ? match[9] : undefined;

  return { start, end, inlineText };
}

function sbvToMs(
  hours: string,
  minutes: string,
  seconds: string,
  milliseconds: string,
): number {
  return (
    Number.parseInt(hours, 10) * 3_600_000 +
    Number.parseInt(minutes, 10) * 60_000 +
    Number.parseInt(seconds, 10) * 1_000 +
    Number.parseInt(milliseconds, 10)
  );
}
