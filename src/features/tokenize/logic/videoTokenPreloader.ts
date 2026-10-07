import type { SrtCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { TokenFrequencyBand } from '@/features/tokenize/types';
import type { VideoTokenMap } from './videoTokenMap';
import type { TokenizeScheduler } from './tokenizeScheduler';
import { PRIORITY_VIEWPORT, PRIORITY_PREPARE, PRIORITY_IDLE } from './tokenizeScheduler';
import { getWordStatuses } from '@/features/dictionary';
import { getFrequencyEntries } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import {
  entriesToBand,
  loadFrequencyBandOptions,
  pickFrequencyReading,
  DEFAULT_BAND_THRESHOLDS,
  type FrequencyBandOptions,
} from '@/features/tokenize/utils/frequencyBand';

export interface VideoTokenPreloaderOptions {
  readonly langCode: string;
  readonly map: VideoTokenMap;
  readonly scheduler: TokenizeScheduler;
  readonly viewportSize?: number;
  readonly bufferSize?: number;
  readonly chunkSize?: number;
  /** Fetch pronunciation/readings alongside status/frequency metadata. */
  readonly showReadings?: boolean;
}

export interface VideoTokenPreloader {
  readonly setCues: (cues: readonly SrtCue[]) => void;
  readonly setActiveIndex: (index: number) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly destroy: () => void;
  /** Toggle reading fetch. Turning on re-resolves already-fetched terms so
   *  existing tokens pick up readings without a cue reload. */
  readonly setShowReadings: (show: boolean) => void;
  /** Dictionary corpus changed — drop the resolved-term dedupe and re-fetch
   *  statuses/frequencies/readings for every prepared term. */
  readonly invalidate: () => void;
}

export function createVideoTokenPreloader(
  options: VideoTokenPreloaderOptions,
): VideoTokenPreloader {
  const {
    langCode,
    map,
    scheduler,
    viewportSize = 1,
    bufferSize = 5,
    chunkSize = 100,
    showReadings: initialShowReadings = false,
  } = options;

  let showReadings = initialShowReadings;

  let cues: readonly SrtCue[] = [];
  const prepared = new Set<number>();
  const resolvedTerms = new Set<string>();
  const pendingTerms = new Set<string>();
  let isPaused = false;
  let isFlushing = false;
  let activeIndex = -1;
  let frequencyBandOptions: FrequencyBandOptions | null = null;
  let freqOptsPromise: Promise<FrequencyBandOptions> | null = null;
  let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadBandOptions(): Promise<FrequencyBandOptions> {
    if (frequencyBandOptions) return frequencyBandOptions;
    if (freqOptsPromise) return freqOptsPromise;
    freqOptsPromise = loadFrequencyBandOptions(langCode).catch(() => ({
      thresholds: DEFAULT_BAND_THRESHOLDS,
      resourcePriority: [],
    }));
    frequencyBandOptions = await freqOptsPromise;
    return frequencyBandOptions;
  }

  function getTermsForCue(index: number): Set<string> {
    const cue = map.get(index);
    if (!cue) return new Set();
    const terms = new Set<string>();
    for (const token of cue.tokens) {
      if (!token.isSeparator) {
        terms.add(token.term);
      }
    }
    return terms;
  }

  async function flushPendingTerms(): Promise<void> {
    if (isFlushing || isPaused || pendingTerms.size === 0) return;
    isFlushing = true;

    const terms = [...pendingTerms].slice(0, chunkSize);
    for (const term of terms) {
      pendingTerms.delete(term);
    }

    try {
      const [statusMap, freqMaps, bandOpts, dictReadings] = await Promise.all([
        getWordStatuses(langCode, terms),
        getFrequencyEntries(langCode, terms),
        loadBandOptions(),
        showReadings ? getReadings(langCode, terms).catch(() => null) : Promise.resolve(null),
      ]);

      const frequencies = new Map<string, TokenFrequencyBand>();
      for (const [term, entries] of freqMaps) {
        frequencies.set(term, entriesToBand(entries, bandOpts) ?? 'very-low');
      }
      for (const term of terms) {
        if (!frequencies.has(term)) {
          frequencies.set(term, 'rare');
        }
      }
      const statuses = new Map<string, WordStatus>(statusMap);

      // null = fetch failed → pass undefined so existing readings survive;
      // a resolved map is authoritative, with frequency rows as fallback.
      // Every fetched term is marked ('' = covered, no reading) so chunked
      // passes clear stale readings without wiping other chunks' results.
      let readings: Map<string, string> | undefined;
      if (dictReadings) {
        readings = new Map(dictReadings);
        for (const term of terms) {
          if (!readings.has(term)) {
            readings.set(term, pickFrequencyReading(term, freqMaps.get(term) ?? []) ?? '');
          }
        }
      }

      for (const term of terms) {
        resolvedTerms.add(term);
      }

      map.resolveTerms(new Set(terms), statuses, frequencies, readings);
    } catch (err) {
      for (const term of terms) {
        if (!resolvedTerms.has(term)) {
          pendingTerms.add(term);
        }
      }
      console.error('[videoTokenPreloader] flush failed:', err);
    } finally {
      isFlushing = false;
      if (pendingTerms.size > 0) {
        scheduler.schedule(() => flushPendingTerms(), PRIORITY_IDLE);
      }
    }
  }

  function scheduleResolve(terms: ReadonlySet<string>, priority: number): void {
    let hasNew = false;
    for (const term of terms) {
      if (resolvedTerms.has(term)) continue;
      pendingTerms.add(term);
      hasNew = true;
    }
    if (!hasNew) return;

    scheduler.schedule(() => flushPendingTerms(), priority);

    if (priority === PRIORITY_VIEWPORT && !pendingFlushTimer) {
      pendingFlushTimer = setTimeout(() => {
        pendingFlushTimer = null;
        void flushPendingTerms();
      }, 0);
    }
  }

  function prepareCue(index: number, priority: number): void {
    if (index < 0 || index >= cues.length) return;
    if (prepared.has(index)) {
      const terms = getTermsForCue(index);
      if (terms.size > 0) {
        scheduleResolve(terms, priority);
      }
      return;
    }
    scheduler.schedule(() => {
      const cue = cues[index];
      if (!cue) return;
      map.prepare(index, cue.text);
      prepared.add(index);
      const terms = getTermsForCue(index);
      scheduleResolve(terms, priority);
    }, priority);
  }

  function prepareRange(start: number, end: number, priority: number): void {
    for (let i = start; i <= end; i++) {
      prepareCue(i, priority);
    }
  }

  function scheduleActive(index: number): void {
    scheduler.clear();

    const viewportStart = Math.max(0, index - viewportSize);
    const viewportEnd = Math.min(cues.length - 1, index + viewportSize);
    prepareRange(viewportStart, viewportEnd, PRIORITY_VIEWPORT);

    const bufferStart = Math.max(0, index - bufferSize);
    const bufferEnd = Math.min(cues.length - 1, index + bufferSize);
    prepareRange(bufferStart, bufferEnd, PRIORITY_PREPARE);

    prepareRange(0, cues.length - 1, PRIORITY_IDLE);
  }

  return {
    setCues(next: readonly SrtCue[]): void {
      cues = next;
      activeIndex = -1;
      prepared.clear();
      resolvedTerms.clear();
      pendingTerms.clear();
      map.clear();
      scheduler.clear();
      if (pendingFlushTimer) {
        clearTimeout(pendingFlushTimer);
        pendingFlushTimer = null;
      }
      freqOptsPromise = null;
      frequencyBandOptions = null;
      prepareRange(0, cues.length - 1, PRIORITY_IDLE);
    },

    setActiveIndex(index: number): void {
      if (index === activeIndex) return;
      activeIndex = index;
      scheduleActive(index);
    },

    pause(): void {
      isPaused = true;
      scheduler.stop();
    },

    resume(): void {
      isPaused = false;
      scheduler.start();
      if (pendingTerms.size > 0) {
        scheduler.schedule(() => flushPendingTerms(), PRIORITY_IDLE);
      }
    },

    destroy(): void {
      scheduler.stop();
      scheduler.clear();
      if (pendingFlushTimer) {
        clearTimeout(pendingFlushTimer);
        pendingFlushTimer = null;
      }
      prepared.clear();
      resolvedTerms.clear();
      pendingTerms.clear();
    },

    setShowReadings(show: boolean): void {
      if (show === showReadings) return;
      showReadings = show;
      if (!show) return;
      resolvedTerms.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },

    invalidate(): void {
      resolvedTerms.clear();
      pendingTerms.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },
  };
}
