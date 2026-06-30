import { parseAss } from '@/shared/lib/parsers/assParser';
import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Strip ASS override/styling and drawing content from a dialogue's text,
 * leaving only plain subtitle text.
 *
 * - Drawing blocks (`{\p1} ... {\p0}`) are removed entirely.
 * - Remaining drawing command tokens (`m`/`n`/`l`/`b`/`s`/`p` followed by
 *   coordinate numbers) are removed.
 * - All `{\...}` override tags are removed.
 * - `\N` (hard newline) becomes a real newline.
 * - `\n` (soft newline) becomes a space.
 */
function stripAssStyling(text: string): string {
  // Remove drawing blocks: everything from {\p1} up to and including {\p0}.
  let result = text.replace(/\{\\p1\}[\s\S]*?\{\\p0\}/g, '');

  // Remove stray drawing command tokens (command letter + coordinate numbers).
  result = result.replace(/(?:^|\s)[mnlbsp]\s+[-\d.]+(?:\s+[-\d.]+)+/g, ' ');

  // Remove all remaining override tags of the form {\...}.
  result = result.replace(/\{[^}]*\}/g, '');

  // Convert \N (hard newline) to an actual newline.
  result = result.replace(/\\N/g, '\n');

  // Convert \n (soft newline) to a space.
  result = result.replace(/\\n/g, ' ');

  // Collapse runs of spaces/tabs (but preserve newlines) and trim each line.
  result = result
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n');

  return result.trim();
}

/**
 * Convert ASS subtitle content to SRT format.
 *
 * The dialogues are sorted by start time, styling/drawing content is stripped,
 * empty cues are skipped, and the remaining cues are emitted as a sequential
 * SRT document.
 */
export function convertAssToSrt(assContent: string): string {
  const { dialogues } = parseAss(assContent);

  const cues = dialogues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((dialogue) => ({
      start: dialogue.start,
      end: dialogue.end,
      text: stripAssStyling(dialogue.text),
    }))
    .filter((cue) => cue.text.length > 0);

  const blocks = cues.map((cue, index) => {
    const indexLine = String(index + 1);
    const timingLine = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
    return [indexLine, timingLine, cue.text].join('\n');
  });

  // SRT cues are separated by a blank line; a trailing blank line follows the
  // last cue to match the conventional SRT file format.
  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
