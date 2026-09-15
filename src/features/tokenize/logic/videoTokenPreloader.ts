import type { SrtCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { TokenFrequencyBand } from '@/features/tokenize/types';
import type { VideoTokenMap } from './videoTokenMap';
import type { TokenizeScheduler } from './tokenizeScheduler';
import { PRIORITY_VIEWPORT, PRIORITY_PREPARE, PRIORITY_IDLE } from './tokenizeScheduler';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { getFrequencyEntries } from '@/features/dictionary/services/frequencyClient';
import {
  entriesToBand,
  loadFrequencyBandOptions,
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
}

export interface VideoTokenPreloader {
  readonly setCues: (cues: readonly SrtCue[]) => void;
  readonly setActiveIndex: (index: number) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly destroy: () => void;
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
  } = options;

  let cues: readonly SrtCue[] = [];
  const prepared = new Set<number>();
  const resolvedTerms = new Set<string>();
  const pendingTerms = new Set<string>();
  let isPaused = false;
  let frequencyBandOptions: FrequencyBandOptions | null = null;
  let freqOptsPromise: Promise<FrequencyBandOptions> | null = null;

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
    if (isPaused || pendingTerms.size === 0) return;

    const terms = [...pendingTerms].slice(0, chunkSize);
    for (const term of terms) {
      pendingTerms.delete(term);
    }

    const [statusMap, freqMaps, bandOpts] = await Promise.all([
      getWordStatuses(langCode, terms),
      getFrequencyEntries(langCode, terms),
      loadBandOptions(),
    ]);

    const frequencies = new Map<string, TokenFrequencyBand>();
    for (const [term, entries] of freqMaps) {
      frequencies.set(term, entriesToBand(entries, bandOpts) ?? 'very-low');
    }
    const statuses = new Map<string, WordStatus>(statusMap);

    for (const term of terms) {
      resolvedTerms.add(term);
    }

    for (let i = 0; i < cues.length; i++) {
      map.resolveMetadata(i, statuses, frequencies);
    }

    if (pendingTerms.size > 0) {
      scheduler.schedule(() => flushPendingTerms(), PRIORITY_IDLE);
    }
  }

  function scheduleResolve(terms: Set<string>, priority: number): void {
    let hasNew = false;
    for (const term of terms) {
      if (resolvedTerms.has(term)) continue;
      pendingTerms.add(term);
      hasNew = true;
    }
    if (hasNew) {
      scheduler.schedule(() => flushPendingTerms(), priority);
    }
  }

  function prepareCue(index: number, priority: number): void {
    if (index < 0 || index >= cues.length || prepared.has(index)) return;
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
      prepared.clear();
      resolvedTerms.clear();
      pendingTerms.clear();
      map.clear();
      scheduler.clear();
      freqOptsPromise = null;
      frequencyBandOptions = null;
      prepareRange(0, cues.length - 1, PRIORITY_IDLE);
    },

    setActiveIndex(index: number): void {
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
      prepared.clear();
      resolvedTerms.clear();
      pendingTerms.clear();
    },
  };
}
