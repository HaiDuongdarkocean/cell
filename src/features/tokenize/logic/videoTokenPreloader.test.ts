import { createVideoTokenPreloader } from './videoTokenPreloader';
import { createVideoTokenMap } from './videoTokenMap';
import { TokenizeScheduler } from './tokenizeScheduler';
import type { SrtCue } from '@/entities/media';

jest.mock('@/features/dictionary', () => ({
  ...(jest.requireActual('@/features/dictionary/logic/phraseMatcher') as Record<string, unknown>),
  ...(jest.requireActual('@/features/dictionary/logic/chineseSegmenter') as Record<string, unknown>),
  getTokenizeMeta: jest.fn(),
  setWordStatus: jest.fn(),
  getReadings: jest.fn(),
  listResources: jest.fn(async () => []),
}));

jest.mock('@/features/pronunciation', () => ({
  warmEspeakIpa: jest.fn(),
  espeakIpas: jest.fn(async () => new Map()),
  supportsEspeakIpa: jest.fn(() => true),
}));

jest.mock('@/features/tokenize/utils/frequencyBand', () => ({
  loadFrequencyBandOptions: jest.fn(),
  pickFrequencyReading: jest.fn(() => undefined),
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

import { getTokenizeMeta } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import { loadFrequencyBandOptions } from '@/features/tokenize/utils/frequencyBand';
import { getWordTranslations } from '@/features/translate';
import { espeakIpas } from '@/features/pronunciation';

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
    (getTokenizeMeta as jest.Mock).mockResolvedValue({ statuses: new Map(), frequencyEntries: new Map() });
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
    (getTokenizeMeta as jest.Mock).mockResolvedValue({ statuses: statusMap, frequencyEntries: freqMap });

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

    expect(getTokenizeMeta).not.toHaveBeenCalled();

    preloader.resume();
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    expect(getTokenizeMeta).toHaveBeenCalled();
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
    expect(getWordTranslations).toHaveBeenCalledTimes(2);

    preloader.setGlossTargetLanguage('ja');
    await flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).toHaveBeenCalledWith('en', 'ja', expect.arrayContaining(['hello']));
  });

  it('drops glosses that resolve after the target language changed', async () => {
    const resolvers: Array<(m: Map<string, string>) => void> = [];
    (getWordTranslations as jest.Mock).mockImplementation(
      () => new Promise<Map<string, string>>((res) => { resolvers.push(res); }),
    );

    const preloader = createVideoTokenPreloader({
      langCode: 'en', map, scheduler,
      showGlosses: true, glossTargetLanguage: 'vi',
    });
    preloader.setCues(makeCues(1));
    // Fire the drain without awaiting — the vi fetch stays pending inside.
    const firstFlush = flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(getWordTranslations).toHaveBeenCalledWith('en', 'vi', expect.anything());

    // Language switches while the vi request is still in flight. Its late
    // resolution must be dropped; the requeued fr request wins instead.
    // Each language fires a cacheOnly leg plus a full leg — indexes [0,1]
    // are vi, [2,3] are fr.
    preloader.setGlossTargetLanguage('fr');
    resolvers[0]!(new Map([['hello', 'xin chào']]));
    resolvers[1]!(new Map());
    await waitForMicrotasks();
    // Stale vi result was dropped; the requeued fr request is in-flight.
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBeUndefined();
    expect(getWordTranslations).toHaveBeenCalledWith('en', 'fr', expect.anything());

    resolvers[2]!(new Map([['hello', 'bonjour']]));
    resolvers[3]!(new Map([['hello', 'bonjour']]));
    await firstFlush;
    await waitForMicrotasks();
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('bonjour');
  });

  it('recovers when a metadata leg hangs: watchdog re-queues instead of wedging isFlushing', async () => {
    jest.useFakeTimers({ doNotFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      let statusCalls = 0;
      (getTokenizeMeta as jest.Mock).mockImplementation(() => {
        statusCalls += 1;
        return statusCalls === 1
          ? new Promise<never>(() => {})
          : Promise.resolve({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
      });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler });
      preloader.setCues(makeCues(1));

      const run = flushScheduler(scheduler);
      await Promise.resolve();
      expect(statusCalls).toBe(1);

      await jest.advanceTimersByTimeAsync(31_000);
      await run;

      expect(statusCalls).toBe(2);
      expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
      errorSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('applies metadata without waiting for espeak; IPA patches uncovered terms after', async () => {
    (getReadings as jest.Mock).mockResolvedValue(new Map([['hello', 'həˈləʊ']]));
    (espeakIpas as jest.Mock).mockResolvedValue(new Map([['world', 'wɜːld']]));
    (getTokenizeMeta as jest.Mock).mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });

    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler, showReadings: true });
    preloader.setCues(makeCues(1));
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    const tokens = map.get(0)!.tokens;
    expect(tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(tokens.find((t) => t.term === 'hello')?.reading).toBe('həˈləʊ');
    expect(tokens.find((t) => t.term === 'world')?.reading).toBe('wɜːld');
    const espeakTerms = (espeakIpas as jest.Mock).mock.calls.flatMap((c) => c[0] as string[]);
    expect(espeakTerms).toContain('world');
    // dict-covered 'hello' is not overwritten by the eager IPA stream.
    expect(tokens.find((t) => t.term === 'hello')?.reading).toBe('həˈləʊ');
  });

  it('still applies statuses and glosses when espeak never resolves', async () => {
    (getReadings as jest.Mock).mockResolvedValue(new Map());
    (espeakIpas as jest.Mock).mockReturnValue(new Promise(() => {}));
    (getTokenizeMeta as jest.Mock).mockResolvedValue({ statuses: new Map([['hello', 'known']]), frequencyEntries: new Map() });
    (getWordTranslations as jest.Mock).mockResolvedValue(new Map([['hello', 'xin chào']]));

    const preloader = createVideoTokenPreloader({
      langCode: 'en', map, scheduler,
      showReadings: true, showGlosses: true, glossTargetLanguage: 'vi',
    });
    preloader.setCues(makeCues(1));
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    const tokens = map.get(0)!.tokens;
    expect(tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('promotes viewport terms ahead of a queued idle backlog', async () => {
    const cues = Array.from({ length: 20 }, (_, i) => ({
      index: i, start: i * 1000, end: (i + 1) * 1000, text: `term${i}`,
    }));
    let releaseFirst: (m: Map<string, string>) => void = () => {};
    let calls = 0;
    (getTokenizeMeta as jest.Mock).mockImplementation(() => {
      calls += 1;
      return calls === 1
        ? new Promise<{ statuses: Map<string, string>; frequencyEntries: Map<string, never[]> }>(
            (res) => { releaseFirst = (m) => res({ statuses: m, frequencyEntries: new Map() }); },
          )
        : Promise.resolve({ statuses: new Map(), frequencyEntries: new Map() });
    });

    const preloader = createVideoTokenPreloader({
      langCode: 'en', map, scheduler,
      chunkSize: 3, viewportSize: 0, bufferSize: 0,
    });
    preloader.setCues(cues);
    const flushed = flushScheduler(scheduler);
    await waitForMicrotasks();
    expect(calls).toBe(1);

    preloader.setActiveIndex(19);
    releaseFirst(new Map());
    await flushed;
    await waitForMicrotasks();

    const secondFlushTerms = (getTokenizeMeta as jest.Mock).mock.calls[1]![1] as string[];
    expect(secondFlushTerms[0]).toBe('term19');
  });

  it('deduplicates in-flight term lookups', async () => {
    const preloader = createVideoTokenPreloader({ langCode: 'en', map, scheduler, chunkSize: 200 });
    const cues = makeCues(2);
    preloader.setCues(cues);
    await flushScheduler(scheduler);
    await waitForMicrotasks();

    expect(getTokenizeMeta).toHaveBeenCalledTimes(1);
  });
});
