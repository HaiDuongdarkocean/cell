import type { SrtCue } from '@/entities/media';
import { parseSmi } from '@/shared/lib/parsers/smiParser';
import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Convert SMI/SAMI caption content to SRT format.
 *
 * Pure function — no side effects. Reuses {@link parseSmi} to extract a single
 * language track, then emits a sequential SRT block per non-empty cue:
 *   - 1-based index
 *   - timing line: `HH:MM:SS,mmm --> HH:MM:SS,mmm` (Start ms → timecode,
 *     end computed from next SYNC's Start)
 *   - plain-text cue (HTML tags stripped, `<BR>` → newline)
 *   - blank line between cues
 *
 * Empty cues (`&nbsp;` / empty `<P>`) are dropped — SRT has no notion of
 * silent cues, and keeping blank text lines would violate the format.
 *
 * SAMI format spec:
 * https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0
 *
 * @param smiContent - Raw SMI/SAMI (.smi/.sami) file content.
 * @param preferredClass - CSS class name of the language track to extract
 *   (default `ENUSCC`; falls back to first available class).
 * @returns SRT-formatted subtitle string (trailing newline), or `''` if no
 *   non-empty cues.
 */
export function convertSmiToSrt(
  smiContent: string,
  preferredClass: string = 'ENUSCC',
): string {
  const cues: SrtCue[] = parseSmi(smiContent, preferredClass);

  const blocks = cues
    .filter((cue) => cue.text.length > 0)
    .map((cue, index) => {
      const timing = `${msToSrtTime(cue.start)} --> ${msToSrtTime(cue.end)}`;
      return [String(index + 1), timing, cue.text].join('\n');
    });

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
