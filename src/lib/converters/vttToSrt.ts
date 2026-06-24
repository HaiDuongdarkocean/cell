import { parseVtt } from '@/lib/parsers/vttParser';
import { msToSrtTime } from '@/lib/utils/timeUtils';

/**
 * Strip all VTT/HTML tags from cue text so the output is plain-text SRT.
 *
 * - VTT/ASS override tags (`{\an8}`, `{\b1}`, …) are removed entirely.
 * - All HTML/VTT tags (`<i>`, `<b>`, `<u>`, `<c>`, `<v>`, `<lang>`, etc.)
 *   are removed, keeping only the inner text.
 * - Each line is trimmed and empty lines within a cue are collapsed.
 */
export function stripVttInlineTags(text: string): string {
  // Remove VTT/ASS override tags: {\an8}, {\b1}, etc.
  let result = text.replace(/\{[^}]*\}/g, '');

  // Remove all HTML/VTT tags (both opening and closing), keeping inner text.
  result = result.replace(/<[^>]*>/g, '');

  // Trim each line; drop lines that became empty after stripping.
  result = result
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return result;
}

/**
 * Convert WebVTT subtitle content to SRT format.
 *
 * Pure function — no side effects, no Chrome API.
 *
 * Steps:
 * 1. Parse VTT content with `parseVtt` (strips WEBVTT header and cue settings,
 *    returns cues with millisecond start/end times).
 * 2. For each cue, strip VTT-specific inline tags from the cue text so the
 *    output is valid SRT (not just a renamed VTT file).
 * 3. Emit a sequential SRT block per cue:
 *    - 1-based index (ignores original VTT cue ids)
 *    - timing line: "HH:MM:SS,mmm --> HH:MM:SS,mmm" (comma decimal separator)
 *    - cleaned cue text (multi-line kept with newlines)
 *    - blank line between cues
 *
 * @param vttContent - Raw WebVTT (.vtt) file content.
 * @returns SRT-formatted subtitle string.
 */
export function convertVttToSrt(vttContent: string): string {
  const { cues } = parseVtt(vttContent);

  const blocks: string[] = cues
    .map((cue) => ({
      ...cue,
      text: stripVttInlineTags(cue.text),
    }))
    .filter((cue) => cue.text.length > 0)
    .map((cue, index) => {
      const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
      return [String(index + 1), timing, cue.text].join('\n');
    });

  // Join blocks with a blank line and append a trailing blank line so the
  // output ends with an empty line, matching conventional SRT formatting.
  return `${blocks.join('\n\n')}\n`;
}
