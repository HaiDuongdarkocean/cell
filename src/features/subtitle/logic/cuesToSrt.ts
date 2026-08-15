import type { SrtCue } from '@/entities/media';
import { msToSrtTime } from '@/shared/utils/timeUtils';

/**
 * Serialize SrtCue[] to SRT format string.
 *
 * Pure function — no side effects. Used by subtitle manager download button.
 */
export function cuesToSrt(cues: readonly SrtCue[]): string {
  return cues
    .map((cue, i) => {
      const start = msToSrtTime(cue.start);
      const end = msToSrtTime(cue.end);
      return `${i + 1}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n');
}
