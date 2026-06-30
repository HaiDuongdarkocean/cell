import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * # SRT Format
 *
 * A valid SRT file is a sequence of cue blocks separated by a blank line:
 *
 *     1
 *     00:00:01,000 --> 00:00:05,000
 *     Hello World
 *
 *     2
 *     00:00:06,000 --> 00:00:10,000
 *     Second cue
 *
 * Rules:
 * 1. Sequential 1-based index.
 * 2. Timing line: `HH:MM:SS,mmm --> HH:MM:SS,mmm` — comma as the
 *    millisecond separator (NOT a dot).
 * 3. Cue text is plain text — no HTML/VTT/ASS inline tags.
 * 4. One blank line between cues.
 * 5. No header (no `WEBVTT`, no `[Script Info]`).
 *
 * # What `normalizeSrt` handles
 *
 * Real-world `.srt` files (or files renamed to `.srt`) often violate the
 * rules above. `normalizeSrt` accepts any SRT-like content and produces
 * clean, standard-compliant SRT:
 *
 * - Strips BOM and `WEBVTT` headers (file was actually VTT).
 * - Strips all inline tags: `{\an8}`, `<i>`, `<b>`, `<u>`, `<c>`, `<v>`, …
 * - Converts `.` to `,` in timestamps (VTT-style → SRT-style).
 * - Handles `MM:SS.mmm` timestamps (no hours) → pads to `HH:MM:SS,mmm`.
 * - Strips cue settings from the timing line (`align:start position:50%`).
 * - Re-numbers cues sequentially from 1.
 * - Ensures exactly one blank line between cues.
 * - Drops cues that become empty after stripping tags.
 */

interface NormalizedCue {
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
}

/**
 * Regex matching a timing line in either SRT or VTT style.
 *
 * - Hours are optional (VTT allows `MM:SS.mmm`).
 * - Decimal separator can be `,` (SRT) or `.` (VTT).
 * - Optional cue settings may follow the end timestamp (VTT).
 */
const TIMING_RE =
  /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

function toMs(
  hh: string | undefined,
  mm: string,
  ss: string,
  mmm: string,
): number {
  const h = hh ? Number.parseInt(hh, 10) : 0;
  const m = Number.parseInt(mm, 10);
  const s = Number.parseInt(ss, 10);
  const ms = Number.parseInt(mmm, 10);
  return h * 3_600_000 + m * 60_000 + s * 1_000 + ms;
}

/**
 * Strip all inline tags from cue text, leaving only plain text.
 *
 * Removes:
 * - VTT/ASS override tags: `{\an8}`, `{\b1}`, …
 * - All HTML/VTT tags: `<i>`, `</i>`, `<b>`, `<c.yellow>`, `<v Bob>`, …
 */
function stripInlineTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Parse SRT-like content (which may also be VTT-like) into a list of cues.
 *
 * Handles:
 * - BOM
 * - `WEBVTT` header (and optional metadata lines before the first cue)
 * - Cue IDs (numeric or arbitrary text on a line before the timing line)
 * - Timing lines with `,` or `.` as the millisecond separator
 * - Optional hours (`MM:SS.mmm` → padded to `HH:MM:SS,mmm`)
 * - Cue settings after the end timestamp
 */
function parseSrtLike(content: string): NormalizedCue[] {
  const stripped = content.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r\n|\r|\n/);

  const cues: NormalizedCue[] = [];
  let i = 0;

  // Skip leading blank lines and optional WEBVTT header / metadata.
  while (i < lines.length && lines[i].trim().length === 0) {
    i++;
  }
  if (i < lines.length && lines[i].trim().toUpperCase().startsWith('WEBVTT')) {
    i++;
    // Skip metadata lines (non-blank, no timing) until first blank line.
    while (i < lines.length && lines[i].trim().length !== 0) {
      i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines between cues.
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // Is this line a timing line, or a cue ID followed by a timing line?
    const timingMatch = line.match(TIMING_RE);
    let timingLine: string;

    if (timingMatch) {
      timingLine = line;
    } else {
      // Could be a cue ID. Peek next non-blank line.
      let nextIdx = i + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim().length === 0) {
        nextIdx++;
      }
      if (nextIdx < lines.length && lines[nextIdx].match(TIMING_RE)) {
        timingLine = lines[nextIdx];
        i = nextIdx;
      } else {
        // Not a recognizable cue start; skip.
        i++;
        continue;
      }
    }

    const match = timingLine.match(TIMING_RE);
    if (!match) {
      i++;
      continue;
    }

    const start = toMs(match[1], match[2], match[3], match[4]);
    const end = toMs(match[5], match[6], match[7], match[8]);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      i++;
      continue;
    }

    // Collect text lines until blank or EOF.
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

/**
 * Normalize any SRT-like content into clean, standard-compliant SRT.
 *
 * @param content - Raw subtitle content (SRT, non-standard SRT, or VTT
 *                  renamed as SRT).
 * @returns Clean SRT string with sequential numbering, comma timestamps,
 *          plain-text cues, and blank-line separation.
 */
export function normalizeSrt(content: string): string {
  if (!content || content.trim().length === 0) {
    return '';
  }

  const cues = parseSrtLike(content);

  const blocks = cues.map((cue, index) => {
    const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
    return [String(index + 1), timing, cue.text].join('\n');
  });

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
