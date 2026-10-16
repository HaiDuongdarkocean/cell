import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { BilingualCue } from '@/entities/media';
import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandOptions } from '@/features/tokenize/utils/frequencyBand';

const getTokenizeMeta = jest.fn() as jest.MockedFunction<
  (langCode: string, terms: readonly string[]) => Promise<{
    statuses: Map<string, WordStatus>;
    frequencyEntries: Map<string, FrequencyEntry[]>;
  }>
>;
const loadFrequencyBandOptions = jest.fn() as jest.MockedFunction<
  (langCode: string) => Promise<FrequencyBandOptions>
>;
const getWordTranslations = jest.fn() as jest.MockedFunction<
  (sl: string, tl: string, terms: readonly string[]) => Promise<Map<string, string> | null>
>;

jest.mock('@/features/translate', () => ({
  getWordTranslations: (sl: string, tl: string, terms: readonly string[]) =>
    getWordTranslations(sl, tl, terms),
}));

jest.mock('@/features/dictionary', () => ({
  ...(jest.requireActual('@/features/dictionary/logic/phraseMatcher') as Record<string, unknown>),
  ...(jest.requireActual('@/features/dictionary/logic/chineseSegmenter') as Record<string, unknown>),
  getTokenizeMeta: (langCode: string, terms: readonly string[]) => getTokenizeMeta(langCode, terms),
  setWordStatus: jest.fn(),
  listResources: jest.fn(async () => []),
}));

jest.mock('@/features/tokenize/utils/frequencyBand', () => ({
  ...(jest.requireActual('@/features/tokenize/utils/frequencyBand') as Record<string, unknown>),
  loadFrequencyBandOptions: (langCode: string) => loadFrequencyBandOptions(langCode),
}));

import {
  createCueListResolveCache,
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
  getTokenizeMeta.mockReset().mockResolvedValue({ statuses: new Map<string, WordStatus>(), frequencyEntries: new Map<string, FrequencyEntry[]>() });
  loadFrequencyBandOptions.mockReset().mockResolvedValue(ENABLED_BAND_OPTS);
  getWordTranslations.mockReset().mockResolvedValue(new Map());
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
    getTokenizeMeta.mockResolvedValue({
      statuses: new Map<string, WordStatus>([
        ['hello', 'known'],
        ['world', 'tracking'],
      ]),
      frequencyEntries: new Map<string, FrequencyEntry[]>([
        ['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 100 }]],
      ]),
    });

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

  it('issues exactly one bulk metadata request and one band-options request', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['x', 'unknown']]), frequencyEntries: new Map() });

    await resolveCueListTokenMetadata(map, 'en');

    expect(getTokenizeMeta).toHaveBeenCalledTimes(1);
    expect(getTokenizeMeta).toHaveBeenCalledWith(
      'en',
      expect.arrayContaining(['hello', 'world', 'again']),
    );
    expect(loadFrequencyBandOptions).toHaveBeenCalledTimes(1);
    expect(loadFrequencyBandOptions).toHaveBeenCalledWith('en');
  });

  it('requests all terms in one metadata call and merges the results', async () => {
    const terms = Array.from({ length: 2500 }, (_, i) => `w${i}`);
    const bigCues: BilingualCue[] = [
      { index: 1, start: 0, end: 1000, targetText: terms.join(' '), nativeText: '' },
    ];
    const map = createCueListTokenMap(bigCues, 'en');
    getTokenizeMeta.mockImplementation((_lang, chunk) =>
      Promise.resolve({
        statuses: new Map(chunk.map((t) => [t, 'known' as WordStatus])),
        frequencyEntries: new Map(
          chunk.map((t) => [t, [{ resourceId: 1, term: t, reading: '', frequency: 1 }]]),
        ),
      }),
    );

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(getTokenizeMeta).toHaveBeenCalledTimes(1);
    expect(meta.failed).toBe(false);
    expect(meta.rankByTerm.get('w2499')).toBe(1);
  });

  it('drops terms over the message length cap instead of sending them', async () => {
    const map = createCueListTokenMap(
      [{ index: 1, start: 0, end: 1000, targetText: 'ok ' + 'a'.repeat(300), nativeText: '' }],
      'en',
    );
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['ok', 'known']]), frequencyEntries: new Map() });

    await resolveCueListTokenMetadata(map, 'en');

    const sent = getTokenizeMeta.mock.calls.flatMap((c) => [...c[1]]);
    expect(sent).toEqual(['ok']);
  });

  it('marks meta.failed and keeps token statuses when the status fetch rejects', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockRejectedValue(new Error('background unavailable'));

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
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'unknown']]), frequencyEntries: new Map() });
    loadFrequencyBandOptions.mockResolvedValue({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] });

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
  });

  it('degrades to freqUnfiltered when the frequency fetch fails or returns empty', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'unknown']]), frequencyEntries: new Map() });

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
    expect(meta.failed).toBe(false);
  });

  it('degrades to freqUnfiltered with default thresholds when band options fail', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({
      statuses: new Map([['hello', 'unknown']]),
      frequencyEntries: new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 5 }]]]),
    });
    loadFrequencyBandOptions.mockRejectedValue(new Error('settings down'));

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.freqUnfiltered).toBe(true);
    expect(meta.thresholds).toEqual(DEFAULT_BAND_THRESHOLDS);
  });

  it('excludes entries from disabled resources in rankByTerm', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({
      statuses: new Map([['hello', 'unknown']]),
      frequencyEntries: new Map([
        [
          'hello',
          [
            { resourceId: 2, term: 'hello', reading: '', frequency: 50 },
            { resourceId: 1, term: 'hello', reading: '', frequency: 500 },
          ],
        ],
        ['world', [{ resourceId: 2, term: 'world', reading: '', frequency: 10 }]],
      ]),
    });

    const { meta } = await resolveCueListTokenMetadata(map, 'en');

    expect(meta.rankByTerm.get('hello')).toBe(500);
    expect(meta.rankByTerm.get('world')).toBeNull();
  });

  it('hydrates token.gloss when includeGlosses and a gloss target language are set', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
    getWordTranslations.mockResolvedValue(
      new Map([
        ['hello', 'xin chào'],
        ['world', 'thế giới'],
      ]),
    );

    const { map: resolved } = await resolveCueListTokenMetadata(map, 'en', {
      includeGlosses: true,
      glossTargetLanguage: 'vi',
    });

    expect(getWordTranslations).toHaveBeenCalledWith(
      'en',
      'vi',
      expect.arrayContaining(['hello', 'world', 'again']),
    );
    expect(resolved.get(1)?.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
    expect(resolved.get(1)?.find((t) => t.term === 'world')?.gloss).toBe('thế giới');
    expect(resolved.get(2)?.find((t) => t.term === 'again')?.gloss).toBeUndefined();
  });

  it('sends zero translate requests when includeGlosses is off or the target language is empty', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });

    await resolveCueListTokenMetadata(map, 'en');
    await resolveCueListTokenMetadata(map, 'en', { includeGlosses: false, glossTargetLanguage: 'vi' });
    await resolveCueListTokenMetadata(map, 'en', { includeGlosses: true, glossTargetLanguage: '' });

    expect(getWordTranslations).not.toHaveBeenCalled();
  });

  it('keeps existing glosses when the translate leg fails', async () => {
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
    getWordTranslations.mockResolvedValueOnce(new Map([['hello', 'xin chào']]));

    const { map: resolved } = await resolveCueListTokenMetadata(map, 'en', {
      includeGlosses: true,
      glossTargetLanguage: 'vi',
    });

    getWordTranslations.mockResolvedValueOnce(null);
    const { map: reresolved } = await resolveCueListTokenMetadata(resolved, 'en', {
      includeGlosses: true,
      glossTargetLanguage: 'vi',
    });

    expect(reresolved.get(1)?.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('loads band options once per resolve cache across chunk resolves', async () => {
    const cache = createCueListResolveCache();
    const map1 = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });

    await resolveCueListTokenMetadata(map1, 'en', { cache });

    const map2 = createCueListTokenMap(
      [{ index: 3, start: 2000, end: 3000, targetText: 'new terms here', nativeText: '' }],
      'en',
    );
    await resolveCueListTokenMetadata(map2, 'en', { cache });

    expect(loadFrequencyBandOptions).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight band-options load across concurrent resolves', async () => {
    const cache = createCueListResolveCache();
    const map1 = createCueListTokenMap(cues, 'en');
    const map2 = createCueListTokenMap(
      [{ index: 3, start: 2000, end: 3000, targetText: 'new terms here', nativeText: '' }],
      'en',
    );
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
    loadFrequencyBandOptions.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(ENABLED_BAND_OPTS), 10)),
    );

    await Promise.all([
      resolveCueListTokenMetadata(map1, 'en', { cache }),
      resolveCueListTokenMetadata(map2, 'en', { cache }),
    ]);

    expect(loadFrequencyBandOptions).toHaveBeenCalledTimes(1);
  });

  it('refetches band options after a failed load instead of caching the fallback', async () => {
    const cache = createCueListResolveCache();
    const map = createCueListTokenMap(cues, 'en');
    getTokenizeMeta.mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
    loadFrequencyBandOptions.mockRejectedValueOnce(new Error('settings down'));

    await resolveCueListTokenMetadata(map, 'en', { cache });
    const { meta } = await resolveCueListTokenMetadata(map, 'en', { cache });

    expect(loadFrequencyBandOptions).toHaveBeenCalledTimes(2);
    expect(meta.freqUnfiltered).toBe(false);
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

    expect(getTokenizeMeta).not.toHaveBeenCalled();
    expect(loadFrequencyBandOptions).not.toHaveBeenCalled();
  });
});
