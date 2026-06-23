import { parseVtt } from '@/lib/parsers/vttParser';
import { msToSrtTime } from '@/lib/utils/timeUtils';

/**
 * Convert WebVTT subtitle content to SRT format.
 *
 * Pure function — no side effects, no Chrome API.
 *
 * Steps:
 * 1. Parse VTT content with `parseVtt` (strips WEBVTT header and cue settings,
 *    returns cues with millisecond start/end times).
 * 2. For each cue, emit a sequential SRT block:
 *    - 1-based index (ignores original VTT cue ids)
 *    - timing line: "HH:MM:SS,mmm --> HH:MM:SS,mmm" (comma decimal separator)
 *    - cue text preserved as-is (multi-line kept with newlines)
 *    - blank line between cues
 *
 * @param vttContent - Raw WebVTT (.vtt) file content.
 * @returns SRT-formatted subtitle string.
 */
export function convertVttToSrt(vttContent: string): string {
  const { cues } = parseVtt(vttContent);

  const blocks: string[] = cues.map((cue, index) => {
    const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
    return [String(index + 1), timing, cue.text].join('\n');
  });

  // Join blocks with a blank line and append a trailing blank line so the
  // output ends with an empty line, matching conventional SRT formatting.
  return `${blocks.join('\n\n')}\n`;
}
