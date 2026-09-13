import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { BilingualCue } from '@/entities/media';
import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandOptions } from '@/features/tokenize/utils/frequencyBand';

const getWordStatuses = jest.fn() as jest.MockedFunction<
  (langCode: string, terms: readonly string[]) => Promise<Map<string, WordStatus>>
>;
const getFrequencyEntries = jest.fn() as jest.MockedFunction<
  (langCode: string, terms: readonly string[]) => Promise<Map<string, FrequencyEntry[]>>
>;
const loadFrequencyBandOptions = jest.fn() as jest.MockedFunction<
  (langCode: string) => Promise<FrequencyBandOptions>
>;

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({
  getWordStatuses,
  setWordStatus: jest.fn(),
}));

jest.mock('@/features/dictionary/services/frequencyClient', () => ({
  getFrequencyEntries,
}));

jest.mock('@/features/tokenize/utils/frequencyBand', () => ({
  ...(jest.requireActual('@/features/tokenize/utils/frequencyBand') as Record<string, unknown>),
  loadFrequencyBandOptions: (langCode: string) => loadFrequencyBandOptions(langCode),
}));

import {
  createCueListTokenMap,
  resolveCueListTokenMetadata,
} from './cueListTokens';

const cues: BilingualCue[] = [
  { index: 1, start: 0, end: 1000, targetText: 'Hello world', nativeText: 'Xin chào' },
  { index: 2, start: 1000, end: 2000, targetText: 'Hello again', nativeText: '' },
];

beforeEach(() => {
  getWordStatuses.mockReset().mockResolvedValue(new Map<string, WordStatus>());
  getFrequencyEntries.mockReset().mockResolvedValue(new Map<string, FrequencyEntry[]>());
  loadFrequencyBandOptions
    .mockReset()
    .mockResolvedValue({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] });
});

describe('createCueListTokenMap', () => {
  it('tokenizes each cue once, keyed by cue.index, with unknown/none defaults', () => {
    const map = createCueListTokenMap(cues, 'en');

    expect(map.size).toBe(2);
    const hello = map.get(1)?.find((t) => t.term === 'hello');
    expect(hello).toBeDefined();
    expect(hello?.status).toBe('unknown');
    expect(hello?.frequencyBand).toBe('none');
    expect(hello?.text).toBe('Hello');
    expect(map.get(2)?.some((t) => t.term === 'again')).toBe(true);
  });
});

describe('resolveCueListTokenMetadata', () => {
  it('applies bulk status and frequency metadata to word tokens', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(
      new Map<string, WordStatus>([
        ['hello', 'known'],
        ['world', 'tracking'],
      ]),
    );
    getFrequencyEntries.mockResolvedValue(
      new Map<string, FrequencyEntry[]>([
        ['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 100 }]],
      ]),
    );

    const resolved = await resolveCueListTokenMetadata(map, 'en');

    expect(resolved).not.toBe(map);
    const hello = resolved.get(1)?.find((t) => t.term === 'hello');
    expect(hello?.status).toBe('known');
    expect(hello?.frequencyBand).toBe('core');
    const world = resolved.get(1)?.find((t) => t.term === 'world');
    expect(world?.status).toBe('tracking');
    expect(world?.frequencyBand).toBe('rare');
    const again = resolved.get(2)?.find((t) => t.term === 'again');
    expect(again?.status).toBe('unknown');
  });

  it('issues exactly one bulk status, one bulk frequency, and one band-options request', async () => {
    const map = createCueListTokenMap(cues, 'en');

    await resolveCueListTokenMetadata(map, 'en');

    expect(getWordStatuses).toHaveBeenCalledTimes(1);
    expect(getWordStatuses).toHaveBeenCalledWith(
      'en',
      expect.arrayContaining(['hello', 'world', 'again']),
    );
    expect(getFrequencyEntries).toHaveBeenCalledTimes(1);
    expect(getFrequencyEntries).toHaveBeenCalledWith(
      'en',
      expect.arrayContaining(['hello', 'world', 'again']),
    );
    expect(loadFrequencyBandOptions).toHaveBeenCalledTimes(1);
    expect(loadFrequencyBandOptions).toHaveBeenCalledWith('en');
  });

  it('returns the input map unchanged when metadata loading fails', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockRejectedValue(new Error('background unavailable'));

    const resolved = await resolveCueListTokenMetadata(map, 'en');

    expect(resolved).toBe(map);
  });

  it('makes no client calls when there are no terms', async () => {
    const empty = createCueListTokenMap([], 'en');
    expect(await resolveCueListTokenMetadata(empty, 'en')).toBe(empty);

    const separatorOnly = createCueListTokenMap(
      [{ index: 1, start: 0, end: 1000, targetText: '   ', nativeText: '' }],
      'en',
    );
    expect(await resolveCueListTokenMetadata(separatorOnly, 'en')).toBe(separatorOnly);

    expect(getWordStatuses).not.toHaveBeenCalled();
    expect(getFrequencyEntries).not.toHaveBeenCalled();
    expect(loadFrequencyBandOptions).not.toHaveBeenCalled();
  });
});
