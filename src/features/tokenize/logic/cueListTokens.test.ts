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

const ENABLED_BAND_OPTS: FrequencyBandOptions = {
  thresholds: DEFAULT_BAND_THRESHOLDS,
  resourcePriority: [1],
};

beforeEach(() => {
  getWordStatuses.mockReset().mockResolvedValue(new Map<string, WordStatus>());
  getFrequencyEntries.mockReset().mockResolvedValue(new Map<string, FrequencyEntry[]>());
  loadFrequencyBandOptions.mockReset().mockResolvedValue(ENABLED_BAND_OPTS);
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

    const { map: resolved, meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(resolved).not.toBe(map);
    const hello = resolved.get(1)?.find((t) => t.term === 'hello');
    expect(hello?.status).toBe('known');
    expect(hello?.frequencyBand).toBe('core');
    const world = resolved.get(1)?.find((t) => t.term === 'world');
    expect(world?.status).toBe('tracking');
    expect(world?.frequencyBand).toBe('rare');
    const again = resolved.get(2)?.find((t) => t.term === 'again');
    expect(again?.status).toBe('unknown');
    expect(meta).toMatchObject({ resolved: true, failed: false, freqUnfiltered: false });
    expect(meta.rankByTerm.get('hello')).toBe(100);
    expect(meta.rankByTerm.get('world')).toBeNull();
    expect(meta.thresholds).toEqual(DEFAULT_BAND_THRESHOLDS);
  });

  it('issues exactly one bulk status, one bulk frequency, and one band-options request', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(new Map([['x', 'unknown']]));
    getFrequencyEntries.mockResolvedValue(new Map([['x', []]]));

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

  it('chunks term requests at 1000 and merges the batches', async () => {
    const terms = Array.from({ length: 2500 }, (_, i) => `w${i}`);
    const bigCues: BilingualCue[] = [
      { index: 1, start: 0, end: 1000, targetText: terms.join(' '), nativeText: '' },
    ];
    const map = createCueListTokenMap(bigCues, 'en');
    getWordStatuses.mockImplementation((_lang, chunk) =>
      Promise.resolve(new Map(chunk.map((t) => [t, 'known' as WordStatus]))),
    );
    getFrequencyEntries.mockImplementation((_lang, chunk) =>
      Promise.resolve(
        new Map(chunk.map((t) => [t, [{ resourceId: 1, term: t, reading: '', frequency: 1 }]])),
      ),
    );

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(getWordStatuses).toHaveBeenCalledTimes(3);
    for (const call of getWordStatuses.mock.calls) {
      expect(call[1].length).toBeLessThanOrEqual(1000);
    }
    expect(getFrequencyEntries).toHaveBeenCalledTimes(3);
    expect(meta.failed).toBe(false);
    expect(meta.rankByTerm.get('w2499')).toBe(1);
  });

  it('drops terms over the message length cap instead of sending them', async () => {
    const map = createCueListTokenMap(
      [{ index: 1, start: 0, end: 1000, targetText: 'ok ' + 'a'.repeat(300), nativeText: '' }],
      'en',
    );
    getWordStatuses.mockResolvedValue(new Map([['ok', 'known']]));

    await resolveCueListTokenMetadata(map, 'en');

    const sent = getWordStatuses.mock.calls.flatMap((c) => [...c[1]]);
    expect(sent).toEqual(['ok']);
  });

  it('marks meta.failed and keeps token statuses when the status fetch rejects', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockRejectedValue(new Error('background unavailable'));

    const { map: resolved, meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.failed).toBe(true);
    expect(meta.resolved).toBe(true);
    expect(resolved.get(1)?.find((t) => t.term === 'hello')?.status).toBe('unknown');
  });

  it('marks meta.failed when the status map comes back empty', async () => {
    const map = createCueListTokenMap(cues, 'en');

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.failed).toBe(true);
  });

  it('degrades to freqUnfiltered when there are no enabled frequency resources', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));
    loadFrequencyBandOptions.mockResolvedValue({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] });

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
  });

  it('degrades to freqUnfiltered when the frequency fetch fails or returns empty', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));
    getFrequencyEntries.mockRejectedValue(new Error('freq down'));

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
    expect(meta.failed).toBe(false);
  });

  it('degrades to freqUnfiltered with default thresholds when band options fail', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));
    getFrequencyEntries.mockResolvedValue(
      new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 5 }]]]),
    );
    loadFrequencyBandOptions.mockRejectedValue(new Error('settings down'));

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
    expect(meta.thresholds).toEqual(DEFAULT_BAND_THRESHOLDS);
  });

  it('excludes entries from disabled resources in rankByTerm', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));
    getFrequencyEntries.mockResolvedValue(
      new Map([
        [
          'hello',
          [
            { resourceId: 2, term: 'hello', reading: '', frequency: 50 },
            { resourceId: 1, term: 'hello', reading: '', frequency: 500 },
          ],
        ],
        ['world', [{ resourceId: 2, term: 'world', reading: '', frequency: 10 }]],
      ]),
    );

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.rankByTerm.get('hello')).toBe(500);
    expect(meta.rankByTerm.get('world')).toBeNull();
  });

  it('makes no client calls when there are no terms', async () => {
    const empty = createCueListTokenMap([], 'en');
    const emptyResult = await resolveCueListTokenMetadata(empty, 'en');
    expect(emptyResult.map).toBe(empty);
    expect(emptyResult.meta).toMatchObject({
      resolved: true,
      failed: false,
      freqUnfiltered: false,
    });

    const separatorOnly = createCueListTokenMap(
      [{ index: 1, start: 0, end: 1000, targetText: '   ', nativeText: '' }],
      'en',
    );
    expect((await resolveCueListTokenMetadata(separatorOnly, 'en')).map).toBe(separatorOnly);

    expect(getWordStatuses).not.toHaveBeenCalled();
    expect(getFrequencyEntries).not.toHaveBeenCalled();
    expect(loadFrequencyBandOptions).not.toHaveBeenCalled();
  });
});
