import type { FrequencyEntry } from '@/entities/dictionary';

export type TokenFrequencyBand = 'core' | 'common' | 'general' | 'advanced' | 'rare' | 'none';

/** User-configurable thresholds for the 5 frequency bands.
 *  Lower rank means more common; each upper bound is inclusive. */
export interface FrequencyBandThresholds {
  readonly core: number;
  readonly common: number;
  readonly general: number;
  readonly advanced: number;
}

/** Default thresholds (backward-compatible with pre-configurable bands).
 *  5-band scale grounded in vocabulary coverage milestones:
 *    core      ≤ 3k   (everyday high-frequency words)
 *    common    ≤ 5k   (frequent words in general media)
 *    general   ≤ 10k  (general vocabulary for adult learners)
 *    advanced  ≤ 20k  (educated native / academic vocabulary)
 *    rare      > 20k  (remaining positive finite ranks)
 *  Invalid or missing rank data is represented by 'none'. */
export const DEFAULT_BAND_THRESHOLDS: FrequencyBandThresholds = {
  core: 3000,
  common: 5000,
  general: 10000,
  advanced: 20000,
} as const;

function resolveThresholds(thresholds?: FrequencyBandThresholds): FrequencyBandThresholds {
  return thresholds ?? DEFAULT_BAND_THRESHOLDS;
}

export function rankToBand(
  rank: number,
  thresholds?: FrequencyBandThresholds,
): TokenFrequencyBand {
  const t = resolveThresholds(thresholds);
  if (rank <= 0 || !Number.isFinite(rank)) return 'none';
  if (rank <= t.core) return 'core';
  if (rank <= t.common) return 'common';
  if (rank <= t.general) return 'general';
  if (rank <= t.advanced) return 'advanced';
  // Any remaining positive finite rank still has frequency data; color it as
  // the rarest band rather than leaving the token uncolored.
  return 'rare';
}

/** Pick the "best" frequency entry, with explicit resource priority overriding
 *  the default lowest-rank behavior.
 *
 *  When `resourcePriority` is provided, the first resource in that ordered list
 *  that contains a matching entry wins. This lets a high-priority frequency
 *  list (e.g. a user-preferred core list) determine the band even if another
 *  list has a better absolute rank.
 *
 *  Returns `undefined` only when `entries` is empty. */
export function pickBestFrequencyEntry(
  entries: readonly FrequencyEntry[],
  resourcePriority?: readonly number[],
): FrequencyEntry | undefined {
  if (entries.length === 0) return undefined;

  if (resourcePriority) {
    for (const resourceId of resourcePriority) {
      const entry = entries.find((e) => e.resourceId === resourceId);
      if (entry) return entry;
    }
  }

  // Default: lowest rank (most common) across all resources.
  return entries.reduce((best, current) =>
    current.frequency < best.frequency ? current : best,
  );
}

export function entriesToBand(
  entries: readonly FrequencyEntry[],
  opts?: { readonly thresholds?: FrequencyBandThresholds; readonly resourcePriority?: readonly number[] },
): TokenFrequencyBand {
  if (entries.length === 0) {
    // A term that was tokenized but has no frequency entry is treated as the
    // rarest band rather than uncolored, so 100% of parsed tokens receive a
    // visible frequency layer.
    return 'rare';
  }

  const best = pickBestFrequencyEntry(entries, opts?.resourcePriority);
  if (!best) return 'rare';
  return rankToBand(best.frequency, opts?.thresholds);
}
