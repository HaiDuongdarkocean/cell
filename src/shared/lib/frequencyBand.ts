import type { FrequencyEntry } from '@/entities/dictionary';

export type TokenFrequencyBand = 'core' | 'common' | 'general' | 'advanced' | 'rare' | 'none';

// Frequency rank thresholds — lower rank means more common.
// 5-band scale grounded in vocabulary coverage milestones:
//   core      ≤ 3k   (everyday high-frequency words)
//   common    ≤ 5k   (frequent words in general media)
//   general   ≤ 10k  (general vocabulary for adult learners)
//   advanced  ≤ 20k  (educated native / academic vocabulary)
//   rare      > 20k  (remaining positive finite ranks)
// Invalid or missing rank data is represented by 'none'.
const CORE_MAX = 3000;
const COMMON_MAX = 5000;
const GENERAL_MAX = 10000;
const ADVANCED_MAX = 20000;

export function rankToBand(rank: number): TokenFrequencyBand {
  if (rank <= 0 || !Number.isFinite(rank)) return 'none';
  if (rank <= CORE_MAX) return 'core';
  if (rank <= COMMON_MAX) return 'common';
  if (rank <= GENERAL_MAX) return 'general';
  if (rank <= ADVANCED_MAX) return 'advanced';
  // Any remaining positive finite rank still has frequency data; color it as
  // the rarest band rather than leaving the token uncolored.
  return 'rare';
}

export function entriesToBand(entries: readonly FrequencyEntry[]): TokenFrequencyBand {
  if (entries.length === 0) {
    // A term that was tokenized but has no frequency entry is treated as the
    // rarest band rather than uncolored, so 100% of parsed tokens receive a
    // visible frequency layer.
    return 'rare';
  }
  // Use the best (lowest) rank across resources.
  const best = Math.min(...entries.map((e) => e.frequency));
  return rankToBand(best);
}
