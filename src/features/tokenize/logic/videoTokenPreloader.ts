import type { SrtCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import type { TokenFrequencyBand } from '@/features/tokenize/types';
import type { VideoTokenMap } from './videoTokenMap';
import type { TokenizeScheduler } from './tokenizeScheduler';
import { PRIORITY_VIEWPORT, PRIORITY_PREPARE, PRIORITY_IDLE } from './tokenizeScheduler';
import { getTokenizeMeta } from '@/features/dictionary';
import { getReadings } from '@/features/dictionary';
import { getWordTranslations } from '@/features/translate';
import { warmEspeakIpa } from '@/features/pronunciation';
import { getSrsCardTermSet } from '@/features/srs';
import { resolveEspeakReadings } from './espeakReadings';
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
  /** Fetch native-language glosses for word tokens (subtitle overlay only). */
  readonly showGlosses?: boolean;
  /** Gloss destination language — `subtitleOverlayNativeLanguage`. Empty or
   *  absent = gloss leg skipped (zero requests). */
  readonly glossTargetLanguage?: string;
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
  /** Toggle gloss fetch. Turning on re-resolves already-fetched terms. */
  readonly setShowGlosses: (show: boolean) => void;
  /** Gloss destination language change — clears the gloss cache so stale
   *  glosses in the old language cannot leak into newly prepared cues, then
   *  re-queues every term. */
  readonly setGlossTargetLanguage: (tl: string) => void;
  /** Dictionary corpus changed — drop the resolved-term dedupe and re-fetch
   *  statuses/frequencies/readings for every prepared term. */
  readonly invalidate: () => void;
}

const IDLE_LOOKAHEAD_CUES = 60;
/** A service-worker/fetch leg that never resolves must not wedge isFlushing —
 *  the batch retries as a normal failure instead of stalling silently. */
export const METADATA_FLUSH_TIMEOUT_MS = 30_000;
const GLOSS_RETRY_DELAY_MS = 15_000;
const GLOSS_RETRY_MAX_ATTEMPTS = 4;

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
    showGlosses: initialShowGlosses = false,
    glossTargetLanguage: initialGlossTargetLanguage = '',
  } = options;

  let showReadings = initialShowReadings;
  let showGlosses = initialShowGlosses;
  let glossTargetLanguage = initialGlossTargetLanguage;

  let cues: readonly SrtCue[] = [];
  const prepared = new Set<number>();
  const resolvedTerms = new Set<string>();
  const pendingViewport = new Set<string>();
  const pendingTerms = new Set<string>();
  const flushRetries = new Map<string, number>();
  let isPaused = false;
  let isFlushing = false;
  let activeIndex = -1;
  let frequencyBandOptions: FrequencyBandOptions | null = null;
  let freqOptsPromise: Promise<FrequencyBandOptions> | null = null;
  let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const glossRetries = new Map<string, number>();
  let glossRetryTimer: ReturnType<typeof setTimeout> | null = null;
  // First cue index each term was scheduled from — glosses flush in cue order
  // so a provider failure degrades coverage linearly by playback position
  // instead of leaving random holes across every cue.
  const termCueOrder = new Map<string, number>();

  function scheduleGlossRetry(terms: readonly string[]): void {
    let any = false;
    for (const term of terms) {
      const attempts = (glossRetries.get(term) ?? 0) + 1;
      if (attempts > GLOSS_RETRY_MAX_ATTEMPTS) continue;
      glossRetries.set(term, attempts);
      pendingTerms.add(term);
      any = true;
    }
    if (!any || isPaused || glossRetryTimer) return;
    glossRetryTimer = setTimeout(() => {
      glossRetryTimer = null;
      scheduler.schedule(() => flushPendingTerms(), PRIORITY_IDLE);
    }, GLOSS_RETRY_DELAY_MS);
  }

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
    if (isFlushing || isPaused || (pendingViewport.size === 0 && pendingTerms.size === 0)) return;
    isFlushing = true;

    const terms = [...pendingViewport].slice(0, chunkSize);
    for (const term of terms) {
      pendingViewport.delete(term);
    }
    for (const term of pendingTerms) {
      if (terms.length >= chunkSize) break;
      pendingTerms.delete(term);
      terms.push(term);
    }
    // (ADR-123) glosses resolve in playback order from the active cue — when
    // the provider dies mid-flush, the unflushed tail belongs to later cues,
    // so coverage drops linearly instead of leaving scattered holes.
    const cueForward = (term: string): number => {
      const i = termCueOrder.get(term);
      return i === undefined ? Infinity : (i - activeIndex + cues.length) % cues.length;
    };
    terms.sort((a, b) => cueForward(a) - cueForward(b));

    const tl = glossTargetLanguage;
    // Glosses ride their own promises — provider latency must not hold back
    // statuses/readings, and a hung leg cannot trip the flush watchdog. The
    // cacheOnly leg paints already-cached glosses instantly; the full leg
    // follows with provider misses.
    const glossLegs: Array<{ promise: Promise<Map<string, string> | null>; full: boolean }> = showGlosses && tl
      ? [
          { promise: getWordTranslations(langCode, tl, terms, { cacheOnly: true }), full: false },
          { promise: getWordTranslations(langCode, tl, terms), full: true },
        ].map(({ promise, full }) => ({
          full,
          // Drop results that resolve after a target-language switch —
          // writing them would persist the old language's glosses.
          promise: promise.then((g) => (glossTargetLanguage === tl ? g : null)).catch(() => null),
        }))
      : [];
    // Dictionary readings detach too — blob lookups can cost ~1.5s on large
    // corpora. eSpeak IPA fills uncovered terms eagerly; the merged dict map
    // stays authoritative once it lands.
    const dictReadingsPromise = showReadings
      ? getReadings(langCode, terms).catch(() => null)
      : Promise.resolve(null);
    const espeakAccum = new Map<string, string>();
    let mergedReadings: Map<string, string> | null = null;
    // Latched until the fast legs land — resolveTerms writes statuses too,
    // so an early IPA patch must wait for them or it would regress status.
    let applyIpa: () => void = () => {};
    // Glosses buffer until the fast legs apply too — an early patch would run
    // resolveCue with empty status/frequency maps and regress live values.
    const pendingGlosses = new Map<string, string>();
    let applyGlosses: () => void = () => {};
    for (const leg of glossLegs) {
      void leg.promise.then((g) => {
        if (g === null) {
          // Provider failure → the terms would otherwise stay resolved
          // forever with no gloss. Re-queue them so a later flush retries
          // once the provider recovers.
          if (leg.full) scheduleGlossRetry(terms);
          return;
        }
        if (g.size === 0) return;
        for (const [term, gloss] of g) pendingGlosses.set(term, gloss);
        applyGlosses();
      });
    }
    if (showReadings) {
      void resolveEspeakReadings(
        langCode,
        terms,
        // Live lookup: once the dictionary merge lands, covered terms are
        // pruned from later slices instead of paying WASM calls for them.
        (term) => mergedReadings?.get(term) || undefined,
        undefined,
        (batch) => {
          for (const [term, ipa] of batch) espeakAccum.set(term, ipa);
          applyIpa();
        },
        () => dictReadingsPromise,
      ).catch(() => {});
    }
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const [statusMap, freqMaps, bandOpts] = await Promise.race([
        Promise.all([
        getTokenizeMeta(langCode, terms),
        loadBandOptions(),
        ]).then(([meta, bandOpts]) => [meta.statuses, meta.frequencyEntries, bandOpts] as const),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('metadata flush timed out')), METADATA_FLUSH_TIMEOUT_MS);
        }),
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

      for (const term of terms) {
        resolvedTerms.add(term);
        flushRetries.delete(term);
      }

      map.resolveTerms(new Set(terms), statuses, frequencies);

      applyIpa = () => {
        const patch = new Map<string, string>();
        for (const [term, ipa] of espeakAccum) {
          if (!mergedReadings?.get(term)) patch.set(term, ipa);
        }
        if (patch.size > 0) {
          map.resolveTerms(new Set(patch.keys()), statuses, frequencies, patch);
        }
      };
      applyIpa();
      applyGlosses = () => {
        if (pendingGlosses.size === 0) return;
        map.resolveTerms(new Set(pendingGlosses.keys()), statuses, frequencies, undefined, pendingGlosses);
        pendingGlosses.clear();
      };
      applyGlosses();

      if (showReadings) {
        void dictReadingsPromise.then((dictReadings) => {
          if (dictReadings === null) return;
          // dict > frequency-row > eager IPA, '' still marks covered-empty.
          mergedReadings = new Map(dictReadings);
          for (const term of terms) {
            if (!mergedReadings.has(term)) {
              mergedReadings.set(
                term,
                pickFrequencyReading(term, freqMaps.get(term) ?? []) ?? espeakAccum.get(term) ?? '',
              );
            }
          }
          map.resolveTerms(new Set(terms), statuses, frequencies, mergedReadings);
        }).catch(() => {});
      }
    } catch (err) {
      for (const term of terms) {
        if (resolvedTerms.has(term)) continue;
        const attempts = (flushRetries.get(term) ?? 0) + 1;
        if (attempts <= 3) {
          flushRetries.set(term, attempts);
          pendingTerms.add(term);
        }
      }
      console.error('[videoTokenPreloader] flush failed:', err);
    } finally {
      clearTimeout(timeoutId);
      isFlushing = false;
      if (pendingViewport.size > 0) {
        scheduleViewportFlush();
      } else if (pendingTerms.size > 0) {
        scheduler.schedule(() => flushPendingTerms(), PRIORITY_IDLE);
      }
    }
  }

  function scheduleViewportFlush(): void {
    scheduler.schedule(() => flushPendingTerms(), PRIORITY_VIEWPORT);
    if (!pendingFlushTimer) {
      pendingFlushTimer = setTimeout(() => {
        pendingFlushTimer = null;
        void flushPendingTerms();
      }, 0);
    }
  }

  function scheduleResolve(terms: ReadonlySet<string>, priority: number, cueIndex?: number): void {
    const urgent = priority === PRIORITY_VIEWPORT;
    let hasNew = false;
    for (const term of terms) {
      if (cueIndex !== undefined && !resolvedTerms.has(term)) {
        const existing = termCueOrder.get(term);
        if (existing === undefined || cueIndex < existing) {
          termCueOrder.set(term, cueIndex);
        }
      }
      if (resolvedTerms.has(term) || pendingViewport.has(term)) continue;
      if (urgent) {
        pendingViewport.add(term);
        pendingTerms.delete(term);
      } else {
        if (pendingTerms.has(term)) continue;
        pendingTerms.add(term);
      }
      hasNew = true;
    }
    if (!hasNew) return;

    if (urgent) {
      scheduleViewportFlush();
    } else {
      scheduler.schedule(() => flushPendingTerms(), priority);
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
      scheduleResolve(terms, priority, index);
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

    const idleStart = Math.max(0, index - IDLE_LOOKAHEAD_CUES);
    const idleEnd = Math.min(cues.length - 1, index + IDLE_LOOKAHEAD_CUES);
    prepareRange(idleStart, idleEnd, PRIORITY_IDLE);
  }

  if (showReadings) warmEspeakIpa(langCode);
  // The card-term set fetches cold once per session — start it here so the
  // memoized promise has already landed by the first cue resolution.
  void getSrsCardTermSet(langCode).catch(() => null);

  return {
    setCues(next: readonly SrtCue[]): void {
      cues = next;
      activeIndex = -1;
      prepared.clear();
      resolvedTerms.clear();
      pendingViewport.clear();
      pendingTerms.clear();
      flushRetries.clear();
      glossRetries.clear();
      termCueOrder.clear();
      map.clear();
      scheduler.clear();
      if (pendingFlushTimer) {
        clearTimeout(pendingFlushTimer);
        pendingFlushTimer = null;
      }
      if (glossRetryTimer) {
        clearTimeout(glossRetryTimer);
        glossRetryTimer = null;
      }
      freqOptsPromise = null;
      frequencyBandOptions = null;
      prepareRange(0, Math.min(cues.length - 1, IDLE_LOOKAHEAD_CUES), PRIORITY_IDLE);
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
      if (pendingViewport.size > 0) {
        scheduleViewportFlush();
      } else if (pendingTerms.size > 0) {
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
      pendingViewport.clear();
      pendingTerms.clear();
      flushRetries.clear();
      glossRetries.clear();
      termCueOrder.clear();
      if (glossRetryTimer) {
        clearTimeout(glossRetryTimer);
        glossRetryTimer = null;
      }
    },

    setShowReadings(show: boolean): void {
      if (show === showReadings) return;
      showReadings = show;
      if (!show) return;
      warmEspeakIpa(langCode);
      resolvedTerms.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },

    setShowGlosses(show: boolean): void {
      if (show === showGlosses) return;
      showGlosses = show;
      if (!show) return;
      resolvedTerms.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },

    setGlossTargetLanguage(tl: string): void {
      if (tl === glossTargetLanguage) return;
      glossTargetLanguage = tl;
      map.clearGlosses();
      glossRetries.clear();
      termCueOrder.clear();
      if (!showGlosses) return;
      resolvedTerms.clear();
      pendingViewport.clear();
      pendingTerms.clear();
      flushRetries.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },

    invalidate(): void {
      resolvedTerms.clear();
      pendingViewport.clear();
      pendingTerms.clear();
      flushRetries.clear();
      scheduleResolve(map.terms(), PRIORITY_IDLE);
    },
  };
}
