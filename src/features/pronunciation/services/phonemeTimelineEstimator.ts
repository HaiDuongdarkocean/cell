import type { Phoneme, PhonemeType } from '../types';

/**
 * Relative acoustic duration weights for each phoneme type.
 * Vowels and diphthongs carry more energy and duration than consonants;
 * stress marks and separators are visual-only and consume no time.
 */
const PHONEME_TYPE_WEIGHTS: Record<PhonemeType, number> = {
  consonant: 1.0,
  vowel: 2.0,
  diphthong: 2.5,
  stress: 0,
  separator: 0,
};

/**
 * Estimate per-phoneme start/end times from the total audio duration.
 *
 * Uses weighted duration by phoneme type so vowels/diphthongs receive a
 * larger share of the audio than consonants, while stress marks and
 * separators consume no time. This is still an estimate, not sample-accurate
 * alignment.
 *
 * @param phonemes - phonemes without meaningful start/end values.
 * @param audioDurationMs - total word audio duration in milliseconds.
 * @returns new Phoneme array with estimated startMs/endMs.
 */
export function estimateTimeline(phonemes: readonly Phoneme[], audioDurationMs: number): Phoneme[] {
  if (audioDurationMs < 0) {
    throw new RangeError(`audioDurationMs must be non-negative, got ${audioDurationMs}`);
  }

  const totalWeight = phonemes.reduce((sum, p) => sum + PHONEME_TYPE_WEIGHTS[p.type], 0);

  const result: Phoneme[] = [];
  let cursorMs = 0;

  for (const p of phonemes) {
    const weight = PHONEME_TYPE_WEIGHTS[p.type];
    if (weight === 0 || totalWeight === 0) {
      result.push({
        ...p,
        startMs: cursorMs,
        endMs: cursorMs,
      });
      continue;
    }

    const shareMs = (weight / totalWeight) * audioDurationMs;
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
