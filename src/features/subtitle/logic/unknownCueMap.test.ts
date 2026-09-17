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

function entry(resourceId: number, term: string, frequency: number): FrequencyEntry {
  return { resourceId, term, reading: '', frequency };
}

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
      ['world', [entry(1, 'world', 10)]],
      ['hello', [entry(1, 'hello', 5)]],
      // xenoglossy is a real freq entry but far below every level except 'advanced'.
      ['xenoglossy', [entry(1, 'xenoglossy', 15000)]],
    ]),
  );
  loadFrequencyBandOptions
    .mockReset()
    .mockResolvedValue({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [1] });
});

describe('createUnknownCueResolver', () => {
  it('probe returns the first unknown-or-tracking term inside the selected level', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'advanced');

    // cue 0: hello (rank 5) and world (rank 10) — first wins.
    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });
    // cue 1: all known → null.
    expect(resolver.probe(1)).toBeNull();
    // cue 2: 'rare'/'appears' unlisted → never; 'xenoglossy' rank 15000 ≤ 20000 → pausable.
    expect(resolver.probe(2)).toEqual({ term: 'xenoglossy', offset: 5 });
  });

  it('a stricter level excludes words ranked beyond its threshold', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'general');

    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });
    // xenoglossy rank 15000 > general cap 10000 → cue 2 has no pausable word.
    expect(resolver.probe(2)).toBeNull();
  });

  it('terms with no entry in an enabled resource never pause', async () => {
    getFrequencyEntries.mockResolvedValue(
      new Map<string, FrequencyEntry[]>([
        ['world', [entry(2, 'world', 10)]],
        ['hello', [entry(2, 'hello', 5)]],
      ]),
    );
    const resolver = await createUnknownCueResolver(cues, 'en', 'advanced');
    // resourceId 2 is not in resourcePriority [1] → nothing pausable.
    expect(resolver.probe(0)).toBeNull();
    expect(resolver.probe(2)).toBeNull();
  });

  it('without an enabled frequency resource every unknown word pauses', async () => {
    loadFrequencyBandOptions.mockResolvedValue({
      thresholds: DEFAULT_BAND_THRESHOLDS,
      resourcePriority: [],
    });
    const resolver = await createUnknownCueResolver(cues, 'en', 'core');

    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });
    expect(resolver.probe(2)).toEqual({ term: 'rare', offset: 0 });
  });



  it('applyStatus removes a term from the unknown map when marked known', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'advanced');
    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });

    resolver.applyStatus('hello', 'known');
    expect(resolver.probe(0)).toEqual({ term: 'world', offset: 6 });

    resolver.applyStatus('world', 'known');
    expect(resolver.probe(0)).toBeNull();
  });

  it('probe offset lands on the pausable token mid-cue, not the cue start', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'advanced');
    const hit = resolver.probe(2);
    expect(hit).not.toBeNull();
    expect(cues[2].text.slice(hit!.offset).toLowerCase()).toMatch(new RegExp(`^${hit!.term}`));
  });

  it('applyStatus matches case-insensitively for non-zh terms', async () => {
    const resolver = await createUnknownCueResolver(cues, 'en', 'advanced');
    expect(resolver.probe(0)).toEqual({ term: 'hello', offset: 0 });

    resolver.applyStatus('Hello', 'known');
    expect(resolver.probe(0)).toEqual({ term: 'world', offset: 6 });
  });

  it('returns empty maps for empty cue lists', async () => {
    const resolver = await createUnknownCueResolver([], 'en', 'advanced');
    expect(resolver.probe(0)).toBeNull();
  });
});
