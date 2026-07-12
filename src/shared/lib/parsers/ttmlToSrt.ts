import { parseTtml } from '@/shared/lib/parsers/ttmlParser';
import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Convert TTML (IMSC1.1) subtitle content to SRT format.
 *
 * Pure function — no side effects, no Chrome API.
 *
 * Steps:
 * 1. Parse TTML content with `parseTtml` (DOMParser-based, returns cues
 *    with millisecond start/end times).
 * 2. Emit a sequential SRT block per cue:
 *    - 1-based index
 *    - timing line: "HH:MM:SS,mmm --> HH:MM:SS,mmm"
 *    - cue text (multi-line kept with newlines)
 *    - blank line between cues
 *
 * @param ttmlContent - Raw TTML (.ttml / .xml) file content.
 * @returns SRT-formatted subtitle string.
 */
export function convertTtmlToSrt(ttmlContent: string): string {
  const { cues } = parseTtml(ttmlContent);

  const blocks: string[] = cues
    .filter((cue) => cue.text.length > 0)
    .map((cue, index) => {
      const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
      return [String(index + 1), timing, cue.text].join('\n');
    });

  return `${blocks.join('\n\n')}\n`;
}
