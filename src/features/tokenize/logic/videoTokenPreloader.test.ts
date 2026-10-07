import { createVideoTokenPreloader } from './videoTokenPreloader';
import { createVideoTokenMap } from './videoTokenMap';
import { TokenizeScheduler } from './tokenizeScheduler';
import type { SrtCue } from '@/entities/media';

jest.mock('@/features/dictionary', () => ({
  ...(jest.requireActual('@/features/dictionary/logic/phraseMatcher') as Record<string, unknown>),
  ...(jest.requireActual('@/features/dictionary/logic/chineseSegmenter') as Record<string, unknown>),
  getWordStatuses: jest.fn(),
  setWordStatus: jest.fn(),
  getFrequencyEntries: jest.fn(),
  listResources: jest.fn(async () => []),
}));

jest.mock('@/features/tokenize/utils/frequencyBand', () => ({
  loadFrequencyBandOptions: jest.fn(),
  DEFAULT_BAND_THRESHOLDS: { high: 1000, medium: 5000, low: 20000 },
  entriesToBand: jest.fn((entries: { frequency: number }[]) => {
    if (entries.length === 0) return 'very-low';
    const best = Math.min(...entries.map((e) => e.frequency));
    if (best <= 1000) return 'high';
    if (best <= 5000) return 'medium';
    if (best <= 20000) return 'low';
    return 'very-low';
  }),
}));

jest.mock('@/features/translate', () => ({
  getWordTranslations: jest.fn(),
}));

import { getWordStatuses } from '@/features/dictionary';
import { getFrequencyEntries } from '@/features/dictionary';
import { loadFrequencyBandOptions } from '@/features/tokenize/utils/frequencyBand';
import { getWordTranslations } from '@/features/translate';

function makeCues(count: number): SrtCue[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    start: i * 1000,
    end: (i + 1) * 1000,
    text: `Hello world cue ${i}`,
  }));
}

function flushScheduler(scheduler: TokenizeScheduler): Promise<void> {
  return scheduler.flush();
}

async function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createVideoTokenPreloader', () => {
  let scheduler: TokenizeScheduler;
  let map: ReturnType<typeof createVideoTokenMap>;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new TokenizeScheduler();
    map = createVideoTokenMap('en');
    (getWordStatuses as jest.Mock).mockResolvedValue(new Map());
    (getFrequencyEntries as jest.Mock).mockResolvedValue(new Map());
    (loadFrequencyBandOptions as jest.Mock).mockResolvedValue({
      thresholds: { high: 1000, medium: 5000, low: 20000 },
      resourcePriority: [],
    });
  });

  it('tokenizes all cues when cues are set', async () => {
    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler });
    const cues = makeCues(3);
    preloader.setCues(cues);
    await flushScheduler(scheduler);

    for (let i = 0; i < cues.length; i++) {
      expect(map.get(i)).toBeDefined();
    }
  });

  it('prioritizes active viewport cues', async () => {
    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler, viewportSize: 1, bufferSize: 2 });
    const cues = makeCues(10);
    preloader.setCues(cues);
    preloader.setActiveIndex(5);
    await flushScheduler(scheduler);

    expect(map.get(5)).toBeDefined();
    expect(map.get(4)).toBeDefined();
    expect(map.get(6)).toBeDefined();
  });

  it('resolves metadata in chunks and applies to cues', async () => {
    const statusMap = new Map([['hello', 'known']]);
    const freqMap = new Map([['hello', [{ frequency: 500, resourceId: 1, term: 'hello', reading: '' }]]]);
    (getWordStatuses as jest.Mock).mockResolvedValue(statusMap);
    (getFrequencyEntries as jest.Mock).mockResolvedValue(freqMap);

    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler, chunkSize: 50 });
    preloader.setCues(makeCues(2));
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    const cue0 = map.get(0);
    const helloToken = cue0?.tokens.find((t) => t.term === 'hello');
    expect(helloToken?.status).toBe('known');
    expect(helloToken?.frequencyBand).toBe('high');
  });

  it('pauses and resumes metadata resolution', async () => {
    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler });
    preloader.setCues(makeCues(2));
    preloader.pause();
    await flushScheduler(scheduler);

    expect(getWordStatuses).not.toHaveBeenCalled();

    preloader.resume();
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    expect(getWordStatuses).toHaveBeenCalled();
  });

  it('fetches glosses only when showGlosses and a target language are set', async () => {
    (getWordTranslations as jest.Mock).mockResolvedValue(new Map([['hello', 'xin chào']]));

    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler });
    preloader.setCues(makeCues(1));
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).not.toHaveBeenCalled();

    preloader.setShowGlosses(true);
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    // No target language yet — still zero requests.
    expect(getWordTranslations).not.toHaveBeenCalled();

    preloader.setGlossTargetLanguage('vi');
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).toHaveBeenCalledWith('en', 'vi', expect.arrayContaining(['hello']));
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('re-fetches glosses when the native language changes', async () => {
    (getWordTranslations as jest.Mock).mockResolvedValue(new Map([['hello', 'xin chào']]));

    const preloader = createVideoTokenPreloader({
      langCode: 'en', map, scheduler,
      showGlosses: true, glossTargetLanguage: 'vi',
    });
    preloader.setCues(makeCues(1));
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).toHaveBeenCalledTimes(1);

    preloader.setGlossTargetLanguage('ja');
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).toHaveBeenCalledWith('en', 'ja', expect.arrayContaining(['hello']));
  });

  it('deduplicates in-flight term lookups', async () => {
    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler, chunkSize: 200 });
    const cues = makeCues(2);
    preloader.setCues(cues);
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    expect(getWordStatuses).toHaveBeenCalledTimes(1);
  });
});
