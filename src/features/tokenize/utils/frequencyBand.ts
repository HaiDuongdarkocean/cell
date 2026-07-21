import type { TokenFrequencyBand } from '@/features/tokenize/types';
import type { FrequencyEntry } from '@/entities/dictionary';

// Frequency rank thresholds — lower rank means more common.
// ponytail: these are arbitrary cutoffs; tune against real corpus data.
// A 'very-low' band catches rare words that would otherwise be uncolored,
// so every token that has frequency data gets a visible band.
const HIGH_MAX = 1000;
const MEDIUM_MAX = 5000;
const LOW_MAX = 20000;

export function rankToBand(rank: number): TokenFrequencyBand {
  if (rank <= 0 || !Number.isFinite(rank)) return 'none';
  if (rank <= HIGH_MAX) return 'high';
  if (rank <= MEDIUM_MAX) return 'medium';
  if (rank <= LOW_MAX) return 'low';
  // Any remaining positive rank still has frequency data; show it as very-low
  // rather than leaving the token uncolored.
  return 'very-low';
}

export function entriesToBand(entries: readonly FrequencyEntry[]): TokenFrequencyBand {
  if (entries.length === 0) {
    // A term that was tokenized but has no frequency entry is treated as the
    // rarest band rather than uncolored, so 100% of parsed tokens receive a
    // visible frequency layer.
    return 'very-low';
  }
  // Use the best (lowest) rank across resources.
  const best = Math.min(...entries.map((e) => e.frequency));
  return rankToBand(best);
}
