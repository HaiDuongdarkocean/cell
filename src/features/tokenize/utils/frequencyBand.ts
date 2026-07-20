import type { TokenFrequencyBand } from '@/features/tokenize/types';
import type { FrequencyEntry } from '@/entities/dictionary';

// Frequency rank thresholds — lower rank means more common.
// ponytail: these are arbitrary cutoffs; tune against real corpus data.
const HIGH_MAX = 1000;
const MEDIUM_MAX = 5000;
const LOW_MAX = 20000;

export function rankToBand(rank: number): TokenFrequencyBand {
  if (rank <= 0 || !Number.isFinite(rank)) return 'none';
  if (rank <= HIGH_MAX) return 'high';
  if (rank <= MEDIUM_MAX) return 'medium';
  if (rank <= LOW_MAX) return 'low';
  return 'none';
}

export function entriesToBand(entries: readonly FrequencyEntry[]): TokenFrequencyBand {
  if (entries.length === 0) return 'none';
  // Use the best (lowest) rank across resources.
  const best = Math.min(...entries.map((e) => e.frequency));
  return rankToBand(best);
}
