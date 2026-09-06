// frequencyBand tests — configurable thresholds + priority-aware selection.

import { describe, expect, it } from '@jest/globals';
import {
  rankToBand,
  entriesToBand,
  pickBestFrequencyEntry,
  DEFAULT_BAND_THRESHOLDS,
  type FrequencyBandThresholds,
} from './frequencyBand';
import type { FrequencyEntry } from '@/entities/dictionary';

function makeEntry(resourceId: number, frequency: number): FrequencyEntry {
  return {
    id: 1,
    resourceId,
    term: 'test',
    reading: '',
    frequency,
  };
}

describe('rankToBand', () => {
  it('uses DEFAULT_BAND_THRESHOLDS when thresholds are omitted', () => {
    expect(rankToBand(500)).toBe('core');
    expect(rankToBand(3000)).toBe('core');
    expect(rankToBand(3001)).toBe('common');
    expect(rankToBand(5000)).toBe('common');
    expect(rankToBand(5001)).toBe('general');
    expect(rankToBand(10000)).toBe('general');
    expect(rankToBand(10001)).toBe('advanced');
    expect(rankToBand(20000)).toBe('advanced');
    expect(rankToBand(20001)).toBe('rare');
  });

  it('returns none for invalid or non-positive ranks', () => {
    expect(rankToBand(0)).toBe('none');
    expect(rankToBand(-1)).toBe('none');
    expect(rankToBand(Number.NaN)).toBe('none');
    expect(rankToBand(Number.POSITIVE_INFINITY)).toBe('none');
  });

  it('allows custom thresholds', () => {
    const custom: FrequencyBandThresholds = {
      core: 1000,
      common: 2500,
      general: 5000,
      advanced: 10000,
    };
    expect(rankToBand(1000, custom)).toBe('core');
    expect(rankToBand(2500, custom)).toBe('common');
    expect(rankToBand(5000, custom)).toBe('general');
    expect(rankToBand(10000, custom)).toBe('advanced');
    expect(rankToBand(10001, custom)).toBe('rare');
  });
});

describe('entriesToBand', () => {
  it('returns rare for empty entries', () => {
    expect(entriesToBand([])).toBe('rare');
  });

  it('uses the lowest rank by default', () => {
    const entries = [makeEntry(1, 5000), makeEntry(2, 1000)];
    expect(entriesToBand(entries)).toBe('core');
  });

  it('falls back to DEFAULT_BAND_THRESHOLDS when thresholds omitted', () => {
    const entries = [makeEntry(1, 3500)];
    expect(entriesToBand(entries)).toBe('common');
  });

  it('honors custom thresholds', () => {
    const entries = [makeEntry(1, 3500)];
    const thresholds: FrequencyBandThresholds = {
      core: 1000,
      common: 2500,
      general: 5000,
      advanced: 10000,
    };
    expect(entriesToBand(entries, { thresholds })).toBe('general');
  });

  it('picks the rank from the highest-priority resource when resourcePriority is provided', () => {
    // Resource 1 has the worst absolute rank but is highest priority.
    const entries = [
      makeEntry(1, 15000), // advanced with default thresholds
      makeEntry(2, 1000),  // core
    ];
    const resourcePriority = [1, 2];
    // Highest-priority resource (1) has rank 15000 -> 'advanced'.
    expect(entriesToBand(entries, { resourcePriority })).toBe('advanced');
  });

  it('falls back to Math.min when the highest-priority resource is not present', () => {
    const entries = [makeEntry(2, 1000), makeEntry(3, 5000)];
    const resourcePriority = [1, 2, 3];
    expect(entriesToBand(entries, { resourcePriority })).toBe('core');
  });

  it('combines custom thresholds and resource priority', () => {
    const entries = [makeEntry(1, 6000), makeEntry(2, 2000)];
    const thresholds: FrequencyBandThresholds = {
      core: 1000,
      common: 2500,
      general: 5000,
      advanced: 10000,
    };
    // Resource 1 has higher priority, rank 6000 -> 'advanced' with custom thresholds.
    expect(entriesToBand(entries, { thresholds, resourcePriority: [1, 2] })).toBe('advanced');
  });
});

describe('pickBestFrequencyEntry', () => {
  it('picks the lowest-rank entry when no resourcePriority is given', () => {
    const entries = [makeEntry(1, 100), makeEntry(2, 50), makeEntry(3, 200)];
    const best = pickBestFrequencyEntry(entries);
    expect(best?.resourceId).toBe(2);
    expect(best?.frequency).toBe(50);
  });

  it('picks the first resource in the priority list that has an entry', () => {
    const entries = [makeEntry(10, 5), makeEntry(20, 100)];
    const best = pickBestFrequencyEntry(entries, [20, 10]);
    expect(best?.resourceId).toBe(20);
  });

  it('falls back to Math.min when no priority resource matches', () => {
    const entries = [makeEntry(1, 500), makeEntry(2, 1000)];
    const best = pickBestFrequencyEntry(entries, [99, 1, 2]);
    expect(best?.resourceId).toBe(1);
  });
});

describe('DEFAULT_BAND_THRESHOLDS', () => {
  it('matches the historical hard-coded defaults', () => {
    expect(DEFAULT_BAND_THRESHOLDS).toEqual({
      core: 3000,
      common: 5000,
      general: 10000,
      advanced: 20000,
    });
  });
});
