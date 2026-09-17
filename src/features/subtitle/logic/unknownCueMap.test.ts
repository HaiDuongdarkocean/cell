import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { SrtCue } from '@/entities/media';
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

import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandOptions } from '@/features/tokenize';
import { createUnknownCueResolver } from './unknownCueMap';

const cues: SrtCue[] = [
  { index: 0, start: 0, end: 1000, text: 'Hello world' },
  { index: 1, start: 1000, end: 2000, text: 'All known here' },
  { index: 2, start: 2000, end: 3000, text: 'Rare xenoglossy appears' },
];

beforeEach(() => {
  getWordStatuses.mockReset().mockResolvedValue(
    new Map<string, WordStatus>([
      ['all', 'known'],
      ['known', 'known'],
      ['here', 'known'],
    ]),
  );
  getFrequencyEntries.mockReset().mockResolvedValue(
    new Map<string, FrequencyEntry[]>([
      ['world', [{ resourceId: 1, term: 'world', reading: '', frequency: 10 }]],
      ['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 5 }]],
    ]),
  );
  loadFrequencyBandOptions
    .mockReset()
    .mockResolvedValue({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] });
});

describe('createUnknownCueResolver', () => {
  it('probe returns the first unknown-or-tracking term in the active frequency list', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'FREQ_LIST');

    // cue 0: hello (unknown, freq) and world (unknown, freq) — first wins.
    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });
    // cue 1: all known → null.
    expect(resolver.probe(1)).toBeNull();
    // cue 2: rare/xenoglossy/appears unknown but no frequency entries → not in list → filtered.
    expect(resolver.probe(2)).toBeNull();
  });

  it('scope ALL pauses on any unknown term, including unlisted ones', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'ALL');

    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });
    expect(resolver.probe(2)).toEqual({ term: 'rare', offset: 0 });
  });

  it('findNext returns the lowest cue index after fromIndex, else -1', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'ALL');

    expect(resolver.findNext(-1)).toBe(0);
    expect(resolver.findNext(0)).toBe(2);
    expect(resolver.findNext(2)).toBe(-1);
  });

  it('applyStatus removes a term from the unknown map when marked known', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'FREQ_LIST');
    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });

    resolver.applyStatus('hello', 'known');
    expect(resolver.probe(0)).toEqual({ term: 'world', offset: 6 });

    resolver.applyStatus('world', 'known');
    expect(resolver.probe(0)).toBeNull();
  });

  it('probe offset lands on the pausable token mid-cue, not the cue start', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'ALL');
    resolver.applyStatus('rare', 'known');
    const hit = resolver.probe(2);
    expect(hit).not.toBeNull();
    expect(cues[2].text.slice(hit!.offset).toLowerCase()).toMatch(new RegExp(`^${hit!.term}`));
  });

  it('returns empty maps for empty cue lists', async () => {
    const resolver = await createUnknownCueResolver([], 'en', 'ALL');
    expect(resolver.probe(0)).toBeNull();
    expect(resolver.findNext(-1)).toBe(-1);
  });
});
