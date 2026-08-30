import type { Phoneme } from '../types';

/**
 * Estimate per-phoneme start/end times from the total audio duration.
 *
 * MVP uses uniform weighting: every non-stress, non-separator phoneme gets
 * an equal share of the audio duration. Stress marks and separators consume
 * no time, which means the stressed vowel/diphthong still receives its full
 * share (the stress marker is visually attached, not acoustically separate).
 *
 * @param phonemes - phonemes without meaningful start/end values.
 * @param audioDurationMs - total word audio duration in milliseconds.
 * @returns new Phoneme array with estimated startMs/endMs.
 */
export function estimateTimeline(phonemes: readonly Phoneme[], audioDurationMs: number): Phoneme[] {
  if (audioDurationMs < 0) {
    throw new RangeError(`audioDurationMs must be non-negative, got ${audioDurationMs}`);
  }

  const soundPhonemes = phonemes.filter(
    (p) => p.type !== 'stress' && p.type !== 'separator',
  );

  const shareMs = soundPhonemes.length > 0 ? audioDurationMs / soundPhonemes.length : 0;

  const result: Phoneme[] = [];
  let cursorMs = 0;

  for (const p of phonemes) {
    if (p.type === 'stress' || p.type === 'separator') {
      result.push({
        ...p,
        startMs: cursorMs,
        endMs: cursorMs,
      });
      continue;
    }

    const endMs = Math.min(cursorMs + shareMs, audioDurationMs);
    result.push({
      ...p,
      startMs: cursorMs,
      endMs,
    });
    cursorMs = endMs;
  }

  return result;
}
