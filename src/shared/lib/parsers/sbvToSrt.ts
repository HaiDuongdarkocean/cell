import { parseSbv } from './sbvParser';
import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Convert YouTube SubViewer (.sbv) caption content to SRT format.
 *
 * Pure function — no side effects, no Chrome API.
 *
 * Steps:
 * 1. Parse SBV with `parseSbv` (strips HTML tags per YouTube spec, returns
 *    cues with millisecond start/end times).
 * 2. Emit a sequential SRT block per cue:
 *    - 1-based index (SBV has no indices; SRT requires them)
 *    - timing line: "HH:MM:SS,mmm --> HH:MM:SS,mmm" (single-digit SBV hours
 *      padded to 2 digits, comma decimal separator, ` --> ` arrow)
 *    - cue text (multi-line preserved with newlines)
 * 3. Blank line between cues, trailing newline at EOF.
 *
 * Source: YouTube Help — https://support.google.com/youtube/answer/2734698
 *
 * @param sbvContent - Raw SBV (.sbv) file content.
 * @returns SRT-formatted subtitle string (empty string for empty input).
 */
export function convertSbvToSrt(sbvContent: string): string {
  if (!sbvContent || sbvContent.trim().length === 0) {
    return '';
  }

  const cues = parseSbv(sbvContent);

  const blocks = cues.map((cue, index) => {
    const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
    return [String(index + 1), timing, cue.text].join('\n');
  });

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
