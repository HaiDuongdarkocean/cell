import type { ClickModifierState, FrequencyEntry } from '@/entities/dictionary';
import type { AnnotationDisplayMode } from '@/entities/settings';
import { findTextBlocks, findTextBlocksInNodes } from '@/features/tokenize/logic/tokenizeBlock';
import { TokenizeCache } from '@/features/tokenize/logic/tokenizeCache';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_PREPARE, PRIORITY_BUFFER } from '@/features/tokenize/logic/tokenizeScheduler';
import { ViewportTracker } from '@/features/tokenize/logic/viewportTracker';
import { resolveScrollPredictMargin, type ScrollDirection } from '@/features/tokenize/logic/scrollDirection';
import { prepareTokenBlock, resolveTokenMetadata, sentenceContextForIndex } from '@/features/tokenize/logic/textTokenizer';
import { sentenceContextForSpan } from '@/features/tokenize/ui/sentenceHighlight';
import { bindTokenBlock, restyleTokenBlock, unbindTokenBlock, TOKEN_CLASS, type TokenSpanBindOptions } from '@/features/tokenize/ui/tokenSpanRenderer';
import { createTokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import type { TokenizeState, TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import {
  loadTokenizeSettings,
  saveTokenizeSettings,
  isTokenizeEnabledForUrl,
  setTokenizeEnabledForUrl,
} from '@/features/tokenize/services/tokenizeSettingsStore';
import { isTihokaDebug } from '@/shared/lib/TihokaDebug';
import { getReadings, getTokenizeMeta, pingTokenizeMeta } from '@/features/dictionary';
import { warmEspeakIpa } from '@/features/pronunciation';
import { resolveEspeakReadings } from '@/features/tokenize/logic/espeakReadings';
import { getWordStatuses, setWordStatus, toggleTrackingFlag } from '@/features/dictionary';
import { getWordTranslations } from '@/features/translate';
import { getSrsCardTermSet, invalidateSrsCardTermSet, onSrsCardsChanged } from '@/features/srs';
import {
  emitWordStatusChanged,
  onWordStatusChanged,
  onWordStatusesReload,
} from '@/features/dictionary';
import type { WordStatus } from '@/entities/dictionary';
import { entriesToBand, loadFrequencyBandOptions, pickFrequencyReading, DEFAULT_BAND_THRESHOLDS, type FrequencyBandOptions } from '@/features/tokenize/utils/frequencyBand';
import { createStatusKeyControls, type PopupStatusTarget } from '@/features/tokenize/logic/statusKeyControls';
import { SENTENCE_CLASS, clearSentenceHighlight, highlightSentence } from '@/features/tokenize/ui/sentenceHighlight';
import { showCopyToast } from '@/features/tokenize/ui/mountCopyToast';
import { Tihoka_UI_HOST_SELECTORS } from '@/shared/lib/dom/TihokaUiHosts';
import { isEditableEvent } from '@/shared/lib/dom/isEditable';
import type { Token, TokenBlock, TokenizeController } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';
// ponytail: cache capacity is tiered by reported device RAM so low-end devices
// (<2 GiB) keep a small resident set and higher-end devices keep a larger one.
// Per-block cost is estimated at 500KB worst-case (maxLength 2000 chars,
// ~1000 DOM nodes when bound). Soft-unbind behind scroll direction (Phase B) +
// LRU eviction keep resident DOM spans bounded.
const LOW_MEMORY_CACHE_CAPACITY = 150; // ~1 GiB devices
const MID_MEMORY_CACHE_CAPACITY = 300; // 2–3 GiB devices, or unknown
const BASE_CACHE_CAPACITY = 500;       // ≥4 GiB devices
function resolveCacheCapacity(): number {
  const mem = (globalThis.navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem !== 'number' || mem <= 0) {
    return MID_MEMORY_CACHE_CAPACITY;
  }
  if (mem < 2) return LOW_MEMORY_CACHE_CAPACITY;
  if (mem < 4) return MID_MEMORY_CACHE_CAPACITY;
  return BASE_CACHE_CAPACITY;
}
const CACHE_CAPACITY = resolveCacheCapacity();
// Bind ring = ±1 viewport symmetric: the current screen plus the previous and
// next screen stay bound so a full-page scroll in either direction shows
// already-tokenized text instead of plain text. The deeper prefetch ring
// (metadata warm) lives on a second tracker and scales with scroll velocity.
function resolveViewportRootMargin(): string {
  // Use explicit `0px` units — some Chromium builds reject a bare `0` token
  // in an IntersectionObserver rootMargin string.
  const px = Math.max(600, Math.round(window.innerHeight));
  return `${px}px 0px ${px}px 0px`;
}
const MUTATION_DEBOUNCE_MS = 300;
const PENDING_MUTATION_LIMIT = 1000;
const HYDRATION_QUIET_MS = 500;
// ponytail: hard caps prevent starvation on heavy SPAs (Facebook/Twitter) that
// mutate continuously — without these, the trailing-only debounce resets forever
// and tokenize never activates / never re-scans. Ceiling is generous enough to
// skip the initial hydration burst but bounded so users on slow devices (per
// AGENTS.md target: >=1GB RAM, >=200k benchmark) see tokens within a few seconds.
// Upgrade path: replace polling debounce with a requestIdleCallback + budget.
const MAX_ACTIVATION_DELAY_MS = 3000;
const MAX_MUTATION_SCAN_DELAY_MS = 1500;

export interface WebTokenizeControllerOptions {
  /** Current page URL used for per-URL enable state. */
  readonly url: string;
  /** Root element to scan for text blocks. Defaults to document.body. */
  readonly root?: Element | null;
  /** Language code for lookups. */
  readonly langCode?: string;
  /** Callback when the user asks to open the Popup Dictionary.
   *  Provides the clicked token element and the original sentence for context. */
  readonly onOpenDictionary?: (term: string, element: HTMLElement, contextSentence: string, event: ClickModifierState, cursorOffset?: number) => void;
  /** Callback when a word status changes via keyboard shortcut or other action. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Fired when the scanned block list changes (scan, dynamic adds, removals,
   *  token invalidation). Used by the comprehension text-score source. */
  readonly onBlocksChanged?: () => void;
  /** Open popup's looked-up term — status keys target it before selection/hover. */
  readonly getPopupStatusTarget?: () => PopupStatusTarget | null;
  /** Reading caps (IPA/pinyin) display mode above word tokens — mirrors the
   *  profile readingDisplay setting; seeds the session state. */
  readonly readingDisplay?: AnnotationDisplayMode;
  /** Native-language gloss display mode below word tokens — mirrors the
   *  profile glossDisplay setting; seeds the session state. */
  readonly glossDisplay?: AnnotationDisplayMode;
  /** Target language for gloss lanes (settings.subtitleOverlayNativeLanguage). */
  readonly glossTargetLanguage?: string;
}

export interface WebTokenizeController extends TokenizeController {
  /** Expose the live state for tests/inspectors. */
  readonly getState: () => TokenizeState;
  /** Subscribe to tokenize state changes (for orbital panel sync). */
  readonly subscribe: (cb: (state: TokenizeState) => void) => () => void;
  /** Toggle helpers exposed for the orbital badge panel. */
  readonly toggleEnabled: () => void;
  readonly toggleShowStatus: () => void;
  readonly toggleShowFrequency: () => void;
  readonly toggleReadingDisplay: () => void;
  readonly toggleGlossDisplay: () => void;
  /** Retarget the gloss lane language — re-resolves glosses for bound blocks. */
  readonly setGlossTargetLanguage: (tl: string) => void;
  /** Pick a dictionary term from current state (for "Open Dictionary" btn). */
  readonly pickDictionaryTerm: () => string | null;
  /** Apply a 1-4 keyboard status shortcut when the user has a token selected or hovered. */
  readonly handleStatusKey: (key: string) => boolean;
  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle so token blocks rebind with the new
   *  status instead of reverting to the stale cached value on the next rebind. */
  readonly applyStatusForTerm: (term: string, status: WordStatus) => void;
  /** Get the locally cached word status for a term. */
  readonly getStatusForTerm: (term: string) => WordStatus;
  /** All scanned text blocks (prepared or not). Read-only view. */
  readonly getBlocks: () => readonly TokenBlock[];
  /** Prepare every scanned block (tokenize, no DOM bind) and return all tokens. */
  readonly getAllTokens: () => Token[];
}

/**
 * Create a web-page tokenize controller (VDLT-Hybrid).
 *
 * ponytail: DOM mutation (dynamic content) is not handled in this slice.
 * The controller scans once at creation and observes viewport crossings.
 */
export async function createWebTokenizeController(
  options: WebTokenizeControllerOptions,
): Promise<WebTokenizeController> {
  const url = options.url;
  const langCode = options.langCode ?? DEFAULT_LANG;
  const root = options.root ?? document.body ?? document.documentElement;

  const settings = await loadTokenizeSettings();
  const initialEnabled = isTokenizeEnabledForUrl(settings, url);

  const stateStore: TokenizeStateStore = createTokenizeStateStore({
    initialEnabled,
    initialShowStatus: true,
    initialShowFrequency: true,
    initialReadingDisplay: options.readingDisplay ?? 'off',
    initialGlossDisplay: options.glossDisplay ?? 'off',
  });
  let glossTargetLanguage = options.glossTargetLanguage ?? '';

  const cache = new TokenizeCache({
    capacity: CACHE_CAPACITY,
    onEvict: (block) => {
      // Soft-unbind: remove DOM spans, but keep the block in the observed list
      // so recreateViewportWithMargin can re-observe it when it re-enters the
      // viewport/overscan. Splicing here would drop blocks that are about to
      // become visible again (e.g. after scroll), breaking 100% parse.
      unbindTokenBlock(block);
    },
  });

  const scheduler = new TokenizeScheduler();
  let viewport = createViewport(resolveViewportRootMargin());
  const visibleElements = new Set<Element>();

  // VDLT-Predict Phase B: scroll direction tracking for asymmetric overscan.
  // The listener is passive + rAF-coalesced so it never blocks scroll. On a
  // direction change the ViewportTracker is recreated with a deep-ahead /
  // shallow-behind rootMargin and all connected blocks are re-observed.
  let lastScrollY = 0;
  let scrollDirection: ScrollDirection = 'none';
  let scrollRafId: number | undefined;
  // Scroll velocity (px/s, EMA) feeds the prefetch ring depth — a steady
  // ~500px/s reader gets ~2 screens of warm margin, a fling gets ~3.5.
  let scrollVelocity = 0;
  let lastScrollT = 0;

  /** Deep-overscan margin for the metadata-prefetch ring. Ahead depth follows
   *  velocity (2–3.5 screens toward the scroll direction); behind stays 1.5
   *  screens so scrolling back up hits fully-warmed content. Quantized to
   *  0.5-screen steps — the bucket key gates tracker recreation so a velocity
   *  wobble doesn't re-observe ~700 elements every frame. */
  function resolvePrefetchMarginBucket(): { margin: string; bucket: string } {
    const aheadScreens = Math.min(3.5, Math.max(2, 2 + scrollVelocity / 2000));
    const result = resolveScrollPredictMargin({
      scrollY: window.scrollY,
      lastScrollY,
      viewportHeight: window.innerHeight,
      aheadScreens,
      behindScreens: 1.5,
      lastDirection: scrollDirection,
    });
    const quantized = Math.round(aheadScreens * 2) / 2;
    return { margin: result.rootMargin, bucket: `${result.direction}:${quantized}` };
  }

  // Batch metadata resolver: gather terms from all blocks that become visible in
  // the same microtask, then send a single message pair (status + frequency) to
  // the background. Per-block messages are the main bottleneck on pages like
  // Facebook with many visible paragraphs.
  let metadataQueue: TokenBlock[] = [];
  let metadataFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let frequencyBandOptions: Promise<FrequencyBandOptions> | null = null;
  const metadataResolved = new WeakSet<TokenBlock>();
  const metadataPending = new WeakSet<TokenBlock>();
  // Blocks whose annotation lanes (reading/gloss) were fetched — gates the
  // re-resolve that runs when a lane is enabled after the block resolved.
  const annotationsResolved = new WeakSet<TokenBlock>();
  // Race guard: keyboard / popup status changes that happen while a metadata
  // flush is mid-await must win over the stale background snapshot. Each local
  // override records the status and a monotonic version; the flush captures the
  // version at the moment it is scheduled so a stale background snapshot cannot
  // clobber a user change made while the flush was in flight.
  let statusVersionCounter = 0;
  let nextFlushVersion = 0;
  // Session status cache — a second flush paints bars from memory while the
  // meta roundtrip is still in flight; the response stays authoritative and
  // overwrites any drift (onWordStatusChanged keeps it fresh in between).
  const statusCache = new Map<string, WordStatus>();
  // Same trick for glosses — key embeds the target language so a TL switch
  // namespaces naturally; legs stay authoritative and overwrite on arrival.
  const glossCache = new Map<string, string>();
  // Session dictionary-reading cache + coverage set — a re-flush (toggle,
  // burst of new blocks) re-sends only terms the dictionary hasn't answered
  // yet, so the offscreen prefetch leg shrinks to nothing on repeat runs
  // instead of flooding the SW with ~2000-term chunk reads every toggle.
  // Covered terms with no reading still exist in `dictCovered` so the leg
  // stays skipped; stale-on-import is accepted (session-scoped).
  const dictTermReadings = new Map<string, string>();
  const dictCovered = new Set<string>();
  // Prefetch-ring session caches — a block entering the deep overscan warms
  // these maps at background priority, so by the time it reaches the bind
  // ring its status/reading/gloss paint in the same turn as the tokens.
  const freqCache = new Map<string, FrequencyEntry[]>();
  const espeakCache = new Map<string, string>();
  const prefetched = new Set<string>();
  const prefetchQueue = new Set<string>();
  // One SW/IDB request in flight for warm work at any moment — the metered
  // loop below is what keeps a cold-arriving visible block's meta roundtrip
  // under ~200ms instead of queueing behind a prefetch flood.
  let warmLoopRunning = false;
  let flushBusy = 0;
  let prefetchViewport: ViewportTracker | null = null;
  let prefetchMarginBucket = '';
  // Sentence wash spans while a word is hovered; a click pins the wash so it
  // survives moving to the dictionary popup, and a click anywhere outside the
  // washed sentence releases it.
  let highlightedSpans: HTMLElement[] = [];
  let pinnedSentenceKey: string | null = null;
  let washedSentenceKey: string | null = null;
  let lastCopiedSentence: string | null = null;
  let preparedNotifyTimer: number | null = null;

  /** Release the pinned wash on a click that lands outside the washed sentence
   *  and outside Tihoka's own UI (popup, panel) — clicking the popup keeps it. */
  function onPointerDownOutside(event: Event): void {
    if (!pinnedSentenceKey) return;
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.classList.contains(SENTENCE_CLASS)) return;
      if (node instanceof Element && node.matches(Tihoka_UI_HOST_SELECTORS)) return;
    }
    pinnedSentenceKey = null;
    clearSentenceHighlight(highlightedSpans);
    highlightedSpans = [];
    washedSentenceKey = null;
  }
  document.addEventListener('pointerdown', onPointerDownOutside, true);

  /** Ctrl/Cmd+C with a washed sentence and no real selection copies the
   *  sentence text instead of the (empty) page selection. */
  function onCopyKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key !== 'c' && event.key !== 'C') return;
    if (highlightedSpans.length === 0) return;
    if (isEditableEvent(event)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString()) return;
    const span = highlightedSpans.find((s) => s.isConnected);
    if (!span) return;
    const sentence = sentenceContextForSpan(span)?.sentence;
    if (!sentence) return;
    event.preventDefault();
    event.stopPropagation();
    if (sentence === lastCopiedSentence) {
      showCopyToast('success');
      return;
    }
    void navigator.clipboard.writeText(sentence)
      .then(() => {
        lastCopiedSentence = sentence;
        showCopyToast('success');
      })
      .catch(() => showCopyToast('error'));
  }
  document.addEventListener('keydown', onCopyKeydown, true);
  const termStatusVersion = new Map<string, number>();
  const localStatusOverrides = new Map<string, { status: WordStatus; version: number }>();

  function createViewport(rootMargin: string): ViewportTracker {
    return new ViewportTracker({ rootMargin });
  }

  function displayFlags(state: TokenizeState): Pick<TokenizeState, 'showStatus' | 'showFrequency' | 'readingDisplay' | 'glossDisplay'> {
    const { showStatus, showFrequency, readingDisplay, glossDisplay } = state;
    return { showStatus, showFrequency, readingDisplay, glossDisplay };
  }

  /** Recreate the prefetch ViewportTracker with a new margin and re-observe all connected blocks. */
  function recreatePrefetchViewport(rootMargin: string): void {
    prefetchViewport?.destroy();
    prefetchViewport = createViewport(rootMargin);
    for (const block of blocks) {
      if (block.element.isConnected) observeBlock(block);
    }
  }

  /** rAF-coalesced scroll handler: track direction + velocity, then re-bucket
   *  the prefetch margin only when the quantized value actually changes. The
   *  bind ring is static (±1 screen) so it never needs recreation. */
  function onScroll(): void {
    if (scrollRafId !== undefined) return;
    scrollRafId = window.requestAnimationFrame(() => {
      scrollRafId = undefined;
      const scrollY = window.scrollY;
      const now = performance.now();
      if (lastScrollT > 0) {
        const instant = (Math.abs(scrollY - lastScrollY) / Math.max(1, now - lastScrollT)) * 1000;
        scrollVelocity = scrollVelocity * 0.7 + instant * 0.3;
      }
      lastScrollT = now;
      const result = resolveScrollPredictMargin({
        scrollY,
        lastScrollY,
        viewportHeight: window.innerHeight,
        lastDirection: scrollDirection,
      });
      lastScrollY = scrollY;
      if (result.direction !== 'none') scrollDirection = result.direction;
      const { margin, bucket } = resolvePrefetchMarginBucket();
      if (bucket !== prefetchMarginBucket) {
        prefetchMarginBucket = bucket;
        recreatePrefetchViewport(margin);
      }
    });
  }

  function flushMetadataQueue(): void {
    flushBusy++;
    void flushMetadataQueueInner().finally(() => {
      flushBusy--;
    });
  }

  async function flushMetadataQueueInner(): Promise<void> {
    metadataFlushTimer = null;
    const flushVersion = nextFlushVersion;
    const batch = metadataQueue;
    metadataQueue = [];
    const terms = new Set<string>();
    for (const block of batch) {
      if (!block.tokens) continue;
      for (const token of block.tokens) {
        if (!token.isSeparator) terms.add(token.term);
      }
    }
    if (terms.size === 0) {
      for (const block of batch) {
        metadataPending.delete(block);
        metadataResolved.add(block);
      }
      return;
    }
    const termList = [...terms];
    const { readingDisplay, glossDisplay } = stateStore.getState();
    const tl = glossTargetLanguage;
    if (readingDisplay !== 'off') warmEspeakIpa(langCode);
    // Glosses ride their own promises — provider latency (Google ~300-600ms,
    // slower under throttling) must not hold back statuses/readings. The
    // cacheOnly leg paints already-cached glosses instantly; the full leg
    // follows with provider misses.
    const glossLegs: Array<Promise<Map<string, string> | null>> = glossDisplay !== 'off' && tl
      ? [
          getWordTranslations(langCode, tl, termList, { cacheOnly: true }),
          getWordTranslations(langCode, tl, termList),
        ].map((p) =>
          // Drop results that resolve after a target-language switch —
          // writing them would persist the old language's glosses.
          p.then((g) => (glossTargetLanguage === tl ? g : null)).catch(() => null),
        )
      : [];
    const metaPromise = Promise.all([
      getTokenizeMeta(langCode, termList),
      frequencyBandOptions ??= loadFrequencyBandOptions(langCode)
        .catch(() => ({ thresholds: DEFAULT_BAND_THRESHOLDS, resourcePriority: [] })),
    ]);
    // Paint cached statuses/glosses while the roundtrips fly — a toggle cycle
    // re-binds every block, so this restores bars/glosses in the same turn
    // the tokens appear; the responses stay authoritative and patch drift.
    if (statusCache.size > 0 || glossCache.size > 0) {
      for (const block of batch) {
        if (!block.tokens) continue;
        let changed = false;
        for (const token of block.tokens) {
          if (token.isSeparator) continue;
          const cached = statusCache.get(token.term);
          if (cached !== undefined && token.status !== cached) {
            token.status = cached;
            changed = true;
          }
          const g = glossCache.get(`${tl}|${token.term}`);
          if (g !== undefined && token.gloss !== g) {
            token.gloss = g;
            changed = true;
          }
        }
        if (changed && visibleElements.has(block.element)) rebindBlock(block);
      }
    }
    // Dictionary readings also detach — blob-backed lookups can cost ~1.5s on
    // big corpora. The request is chained off the meta roundtrip: concurrent
    // IDB bursts on the SW thread queue behind each other, and READINGS_GET's
    // ~200 chunk loads pushed the status lane from ~60ms to ~2s on Wikipedia.
    // The term list is split visible-first into two sequential requests —
    // READINGS_GET resolves all-or-nothing, so a single ~2000-term call would
    // hold the ~150 visible terms' readings hostage to every offscreen chunk.
    // eSpeak IPA fills uncovered terms eagerly in the meantime; the dictionary
    // result stays authoritative once it lands.
    const visibleTermSet = new Set<string>();
    for (const block of batch) {
      if (!block.tokens || !visibleElements.has(block.element)) continue;
      for (const token of block.tokens) {
        if (!token.isSeparator) visibleTermSet.add(token.term);
      }
    }
    const visibleTermList = termList.filter((t) => visibleTermSet.has(t) && !dictCovered.has(t));
    const restTermList = termList.filter((t) => !visibleTermSet.has(t) && !dictCovered.has(t));
    const dictVisiblePromise = readingDisplay !== 'off'
      ? metaPromise.then(() =>
          visibleTermList.length > 0
            ? getReadings(langCode, visibleTermList)
                .then((m) => {
                  for (const t of visibleTermList) dictCovered.add(t);
                  return m;
                })
                .catch(() => null)
            : null,
        )
      : Promise.resolve(null);
    const dictRestPromise = readingDisplay !== 'off' && restTermList.length > 0
      ? dictVisiblePromise.then(async () => {
          // The offscreen prefetch is background work — hold it until the
          // visible lanes (status/reading/gloss apply) have settled, then
          // sub-batch so a flush fired mid-sweep finds a window for its meta
          // roundtrip between ~150ms bursts instead of queueing behind
          // ~2000 terms' worth of IDB chunk loads.
          await new Promise((r) => setTimeout(r, 250));
          const merged = new Map<string, string>();
          for (let i = 0; i < restTermList.length; i += 256) {
            const slice = restTermList.slice(i, i + 256);
            const part = await getReadings(langCode, slice).catch(() => null);
            if (part) {
              for (const [term, reading] of part) merged.set(term, reading);
              for (const t of slice) dictCovered.add(t);
            }
            await new Promise((r) => setTimeout(r, 0));
          }
          return merged;
        })
      : Promise.resolve(null);
    // Eager IPA stream starts at flush time — fills every term without a
    // reading yet; the dictionary apply overwrites covered terms on arrival.
    // Session-scoped so prefetch-warmed IPA carries into later flushes.
    if (readingDisplay !== 'off') {
      const readingByTerm = new Map<string, Token>();
      const blocksByTerm = new Map<string, TokenBlock[]>();
      for (const b of batch) {
        for (const token of b.tokens ?? []) {
          if (token.isSeparator) continue;
          if (!readingByTerm.has(token.term)) readingByTerm.set(token.term, token);
          const list = blocksByTerm.get(token.term);
          if (list) { if (list[list.length - 1] !== b) list.push(b); }
          else blocksByTerm.set(token.term, [b]);
        }
      }
      // Viewport terms first — an eager sweep is CPU-bound, so visible words
      // must be covered before offscreen ones burn the same slice budget.
      const espeakOrder = [
        ...batch.filter((b) => visibleElements.has(b.element)),
        ...batch.filter((b) => !visibleElements.has(b.element)),
      ].flatMap((b) => (b.tokens ?? []).filter((t) => !t.isSeparator).map((t) => t.term));
      void resolveEspeakReadings(
        langCode,
        [...new Set(espeakOrder)],
        // Live lookup: slices that run after the dictionary apply skip covered
        // terms, so eager IPA only ever computes for genuinely uncovered terms.
        // The session cache also counts as coverage — a prefetched term must
        // not be recomputed for every flush that touches it.
        (term) => readingByTerm.get(term)?.reading || espeakCache.get(term),
        undefined,
        (espeakReadings) => {
          const dirty = new Set<TokenBlock>();
          for (const [term, ipa] of espeakReadings) {
            espeakCache.set(term, ipa);
            for (const block of blocksByTerm.get(term) ?? []) {
              if (!block.tokens) continue;
              for (const token of block.tokens) {
                if (!token.isSeparator && token.term === term && !token.reading) {
                  token.reading = ipa;
                  dirty.add(block);
                }
              }
            }
          }
          for (const block of dirty) {
            if (visibleElements.has(block.element)) rebindBlock(block);
          }
        },
        () => dictVisiblePromise,
        visibleTermSet.size,
      ).catch(() => {});
    }
    // Card flags are a third visual layer — they patch on arrival like
    // readings/gloss so a cold SRS fetch never holds back the status paint.
    void getSrsCardTermSet(langCode).catch(() => null).then((cardTerms) => {
      if (cardTerms === null) return;
      for (const block of batch) {
        if (!block.tokens) continue;
        let changed = false;
        for (const token of block.tokens) {
          const next = cardTerms.has(token.term);
          if (!token.isSeparator && token.hasCard !== next) {
            token.hasCard = next;
            changed = true;
          }
        }
        if (changed && visibleElements.has(block.element)) rebindBlock(block);
      }
    });
    const [meta, bandOpts] = await metaPromise;
    const statusMap = meta.statuses;
    for (const term of termList) statusCache.set(term, statusMap.get(term) ?? 'unknown');
    const freqMaps = meta.frequencyEntries;
    for (const block of batch) {
      if (!block.tokens) {
        metadataPending.delete(block);
        continue;
      }
      await resolveTokenMetadata(
        block.tokens,
        (term) => Promise.resolve(statusMap.get(term) ?? 'unknown'),
        (term) => Promise.resolve(entriesToBand(freqMaps.get(term) ?? freqCache.get(term) ?? [], bandOpts)),
      );
      // Reading paint order at meta time: session dict cache (instant on a
      // repeat flush) → frequency entries — so the reading lane lands with
      // the status bar instead of waiting for the dictionary leg. Dict/espeak
      // still overwrite uncovered terms later.
      if (readingDisplay !== 'off') {
        for (const token of block.tokens) {
          if (token.isSeparator || token.reading) continue;
          const dr = dictTermReadings.get(token.term);
          if (dr) {
            token.reading = dr;
            continue;
          }
          const fr = pickFrequencyReading(token.term, freqMaps.get(token.term) ?? freqCache.get(token.term) ?? [])
            ?? espeakCache.get(token.term);
          if (fr) token.reading = fr;
        }
      }
      // Race guard: re-apply any status override with a version newer than the
      // one this flush started with, so a stale background snapshot cannot
      // clobber a user change made while the flush was in flight.
      for (const token of block.tokens) {
        if (token.isSeparator) continue;
        const override = localStatusOverrides.get(token.term);
        if (override && override.version > flushVersion) {
          token.status = override.status;
        }
      }
      metadataPending.delete(block);
      metadataResolved.add(block);
      if (visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }

    // Authoritative reading apply — fires whenever a dictionary leg lands;
    // terms still uncovered keep whatever eager IPA already painted. Each leg
    // owns its block subset so visible blocks resolve without waiting for the
    // offscreen leg.
    // Leg maps merge into `dictMerged` for lookups — a term shared by a
    // visible and an offscreen block arrives with the visible leg, so the
    // rest-leg apply must still find it.
    const dictMerged = new Map(dictTermReadings);
    const applyDictReadings = (
      dictReadings: Map<string, string>,
      targets: TokenBlock[],
    ): void => {
      for (const [term, reading] of dictReadings) {
        dictMerged.set(term, reading);
        dictTermReadings.set(term, reading);
      }
      for (const block of targets) {
        if (!block.tokens) continue;
        let changed = false;
        for (const token of block.tokens) {
          if (token.isSeparator) continue;
          const next = dictMerged.get(token.term)
            ?? pickFrequencyReading(token.term, freqMaps.get(token.term) ?? freqCache.get(token.term) ?? [])
            ?? espeakCache.get(token.term)
            ?? '';
          if (token.reading !== next) {
            token.reading = next;
            changed = true;
          }
        }
        annotationsResolved.add(block);
        if (changed && visibleElements.has(block.element)) rebindBlock(block);
      }
    };
    const visibleBlocks = batch.filter((b) => visibleElements.has(b.element));
    const restBlocks = batch.filter((b) => !visibleElements.has(b.element));
    void dictVisiblePromise.then((r) => {
      if (r) applyDictReadings(r, visibleBlocks);
    }).catch(() => {});
    void dictRestPromise.then((r) => {
      if (r) applyDictReadings(r, restBlocks);
    }).catch(() => {});

    // Late gloss patches — provider failure resolves null and leaves tokens
    // untouched; each leg applies independently so cached hits paint first.
    for (const leg of glossLegs) void leg.then((termGlosses) => {
      if (!termGlosses) return;
      for (const [term, gloss] of termGlosses) glossCache.set(`${tl}|${term}`, gloss);
      for (const block of batch) {
        if (!block.tokens) continue;
        let changed = false;
        for (const token of block.tokens) {
          if (token.isSeparator) continue;
          const gloss = termGlosses.get(token.term);
          if (gloss !== undefined && token.gloss !== gloss) {
            token.gloss = gloss;
            changed = true;
          }
        }
        if (changed) {
          annotationsResolved.add(block);
          if (visibleElements.has(block.element)) rebindBlock(block);
        }
      }
    }).catch(() => {});
  }

  function scheduleMetadataFlush(): void {
    if (!metadataFlushTimer) {
      // Flush in the next microtask so multiple visible blocks arriving in the
      // same scheduler tick are batched into one background request. Capture the
      // status version at scheduling time so a stale in-flight snapshot can be
      // detected and overruled by any user change that happens before it runs.
      nextFlushVersion = statusVersionCounter;
      metadataFlushTimer = setTimeout(() => void flushMetadataQueue(), 0);
    }
  }

  function scheduleMetadataResolve(block: TokenBlock): void {
    if (metadataResolved.has(block) || metadataPending.has(block)) return;
    metadataPending.add(block);
    metadataQueue.push(block);
    scheduleMetadataFlush();
  }

  /** Force a bound block back into the metadata queue — used when an
   *  annotation lane is enabled after the block already resolved status/freq
   *  without annotations, and when the gloss target language changes. */
  function requeueForAnnotations(block: TokenBlock): void {
    if (metadataPending.has(block) || !block.isBound || !block.tokens) return;
    metadataPending.add(block);
    metadataQueue.push(block);
  }

  /** Collect a prefetch-ring block's terms into the warm queue. Terms are
   *  warmed once per session (`prefetched`); repeat ring entries cost a
   *  Set check and nothing else. */
  function enqueuePrefetchBlock(block: TokenBlock): void {
    if (!block.tokens) return;
    let added = false;
    for (const token of block.tokens) {
      if (token.isSeparator || prefetched.has(token.term)) continue;
      prefetchQueue.add(token.term);
      added = true;
    }
    // Leading edge: warmLoop self-meters to one small request in flight, so
    // it can start immediately — the pause-on-flush check, not a debounce, is
    // what keeps the channel clear for visible flushes.
    if (added) void warmLoop();
  }

  /** Warm pauses while a visible flush owns the channel (pending dispatch or
   *  meta roundtrip in flight). Bounded wait: a flush settles in ~300ms. */
  async function waitForVisibleFlush(): Promise<void> {
    while (isActive && (metadataFlushTimer !== null || flushBusy > 0)) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  /** Metered warm pipeline — GapWorker-style admission control. Drains the
   *  prefetch queue in ~64-term chunks, legs sequential per chunk, at most
   *  one SW/IDB request in flight. Queue order is document order, which is
   *  nearest-first under a top-down scroll. */
  async function warmLoop(): Promise<void> {
    if (warmLoopRunning) return;
    warmLoopRunning = true;
    try {
      if (stateStore.getState().readingDisplay !== 'off') warmEspeakIpa(langCode);
      while (isActive && prefetchQueue.size > 0) {
        await waitForVisibleFlush();
        if (!isActive || prefetchQueue.size === 0) break;
        const chunk: string[] = [];
        for (const term of prefetchQueue) {
          if (chunk.length >= 64) break;
          prefetchQueue.delete(term);
          prefetched.add(term);
          chunk.push(term);
        }
        if (chunk.length > 0) await warmChunk(chunk);
      }
    } finally {
      warmLoopRunning = false;
    }
  }

  async function warmChunk(terms: string[]): Promise<void> {
    const { readingDisplay, glossDisplay } = stateStore.getState();
    const tl = glossTargetLanguage;
    const metaTerms = terms.filter((t) => !statusCache.has(t));
    if (metaTerms.length > 0) {
      const meta = await getTokenizeMeta(langCode, metaTerms).catch(() => null);
      if (meta) {
        for (const term of metaTerms) {
          statusCache.set(term, meta.statuses.get(term) ?? 'unknown');
          const entries = meta.frequencyEntries.get(term);
          if (entries) freqCache.set(term, entries);
        }
      }
    }
    await waitForVisibleFlush();
    if (readingDisplay !== 'off' && isActive) {
      const uncovered = terms.filter((t) => !dictCovered.has(t));
      if (uncovered.length > 0) {
        const part = await getReadings(langCode, uncovered).catch(() => null);
        if (part) for (const [t, r] of part) dictTermReadings.set(t, r);
        for (const t of uncovered) dictCovered.add(t);
      }
      await waitForVisibleFlush();
      await resolveEspeakReadings(
        langCode,
        terms,
        (t) =>
          dictTermReadings.get(t)
          ?? pickFrequencyReading(t, freqCache.get(t) ?? [])
          ?? espeakCache.get(t),
        undefined,
        (batch) => {
          for (const [t, ipa] of batch) espeakCache.set(t, ipa);
        },
      ).catch(() => {});
    }
    // Gloss leg stays detached per chunk — provider latency must not hold the
    // metering loop; only meta/dict gate the cold-path worst case.
    if (glossDisplay !== 'off' && tl && isActive) {
      const glossTerms = terms.filter((t) => !glossCache.has(`${tl}|${t}`));
      if (glossTerms.length > 0) {
        void getWordTranslations(langCode, tl, glossTerms).then((g) => {
          if (!g || glossTargetLanguage !== tl) return;
          for (const [t, v] of g) glossCache.set(`${tl}|${t}`, v);
        }).catch(() => {});
      }
    }
  }

  // Token FAB removed — settings panel is now integrated into the orbital
  // badge (see webTextDictionaryController). The tokenize controller exposes
  // state + callbacks via the panel deps wired in content-script.ts.

  // MutationObserver is created lazily below and toggled via state. Keeping it
  // disconnected during page load prevents conflicts with Cloudflare Rocket
  // Loader / Angular hydration while scripts are still being injected.
  let mutationObserver: MutationObserver | null = null;
  let isObservingMutations = false;
  function updateMutationObservation(enabled: boolean): void {
    if (enabled === isObservingMutations || !mutationObserver) return;
    if (enabled) {
      mutationObserver.observe(root, { childList: true, subtree: true, characterData: true });
      isObservingMutations = true;
    } else {
      mutationObserver.disconnect();
      isObservingMutations = false;
    }
  }

  const blocks: TokenBlock[] = [];
  const blockSet = new Set<TokenBlock>();
  const blockElements = new Set<Element>();
  let isActive = false;
  let cancelPendingActivation: (() => void) | null = null;

  // Bind handlers are registered once per block — the prefetch tracker is
  // recreated on scroll-bucket changes and re-runs observeBlock, so a second
  // registration would stack duplicate onEnter callbacks on the bind ring.
  const bindObserved = new WeakSet<TokenBlock>();

  function observeBlock(block: TokenBlock, eager = false): void {
    if (!bindObserved.has(block)) {
      bindObserved.add(block);
      viewport.observe(block.element, {
        onEnter: () => {
          visibleElements.add(block.element);
          // Keep the block resident so metadata + rebinds can find it. Adding it
          // here (rather than in scanAndObserveBlocks) prevents the LRU cache from
          // evicting distant offscreen blocks over the viewport blocks we are
          // actively binding.
          cache.set(block);
          // Prepare tokens before binding. prepareBlock is a no-op if tokens are
          // already set, so re-entry from scroll/mutation never re-tokenizes.
          scheduler.schedule(() => prepareBlock(block), PRIORITY_PREPARE);
          // If the block is already bound (e.g. by eager tryBindVisible during a
          // mutation batch), skip scheduling a no-op bind task to keep the queue
          // short on low-end devices.
          if (stateStore.getState().enabled && !block.isBound) {
            scheduler.schedule(() => bindVisibleBlock(block), PRIORITY_VIEWPORT);
          }
        },
        onExit: () => {
          visibleElements.delete(block.element);
          // Unbind is owned by the prefetch ring's exit — blocks stay bound
          // across the ±1-screen bind margin so the previous screen renders
          // instantly on scroll-back.
        },
      });
    }
    prefetchViewport?.observe(block.element, {
      // Tokenize + warm metadata caches well ahead of visibility — the block's
      // own flush then paints status/reading/gloss in the bind turn.
      onEnter: () => {
        scheduler.schedule(() => {
          prepareBlock(block);
          enqueuePrefetchBlock(block);
        }, PRIORITY_BUFFER);
      },
      onExit: () => {
        // Leaving the deep ring means truly far away — reclaim the DOM spans
        // and the cache slot. The block stays in `blocks` for re-observation.
        scheduler.schedule(() => {
          unbindTokenBlock(block);
          cache.delete(block.id);
        }, PRIORITY_BUFFER);
      },
    });
    // Eager bind only for dynamically added nodes during scroll. The initial
    // full-page scan uses IntersectionObserver callbacks instead, avoiding a
    // synchronous layout read (getBoundingClientRect) for every block on load.
    if (eager) tryBindVisible(block);
  }

  function scanAndObserveBlocks(eagerViewport = false): void {
    const scanned = findTextBlocks(root, { langCode });
    const eager: TokenBlock[] = [];
    for (const block of scanned) {
      // VDLT-Predict FR4: bindViewportNow may have already scanned + cached
      // this block during cold-start. The same text node reuses one TokenBlock
      // object, so membership in `blocks` is the duplicate guard.
      if (blockSet.has(block)) continue;
      // Do not cache offscreen blocks yet. Adding them to the LRU cache now
      // would evict the viewport blocks we just bound during cold-start,
      // breaking scroll parse. The cache is populated lazily in onEnter when
      // the block enters the viewport/overscan.
      blocks.push(block);
      blockSet.add(block);
      blockElements.add(block.element);
      // Enable path: one scan both binds viewport blocks and registers the
      // rest — the old bindViewportNow+scan pair walked the whole DOM twice.
      // Rect reads are collected before any bind so DOM writes can't force a
      // layout pass per block. (observe() itself is ~0.5ms per 800 — cheap
      // enough to stay inline.)
      if (eagerViewport && block.element.isConnected && isElementInViewport(block.element)) {
        eager.push(block);
      }
      // Observe the new block immediately. Disconnected nodes are harmless to
      // observe (the callback simply won't fire) and match the original test
      // expectation that a root-only node is registered.
      observeBlock(block);
    }
    for (const block of eager) {
      visibleElements.add(block.element);
      cache.set(block);
      try {
        bindVisibleBlock(block);
      } catch (err) {
        console.error('[webTokenize] bindVisibleBlock failed during enable for', block.id, err);
      }
    }
    // bindViewportNow may have bound viewport blocks whose source nodes are no
    // longer discoverable by findTextBlocks (they became token spans). Make
    // sure those existing blocks are observed so scroll enter/exit keeps them
    // in sync.
    for (const block of blocks) {
      if (block.element.isConnected) observeBlock(block);
    }
    if (isTihokaDebug()) {
      const tagDistribution: Record<string, number> = {};
      for (const block of scanned) {
        const tag = block.element.tagName;
        tagDistribution[tag] = (tagDistribution[tag] ?? 0) + 1;
      }
      (window as unknown as Record<string, unknown>).__Tihoka_SCAN_INFO = {
        scanned: scanned.length,
        blocks: blocks.length,
        tags: tagDistribution,
      };
    }
  }

  /**
   * VDLT-Predict FR4 (cold-start viewport-first): scan + eagerly bind only the
   * blocks currently inside the visual viewport, without connecting observers
   * or the mutation listener. This makes toggle feel instant — viewport tokens
   * appear in the same turn — while the heavy offscreen hydrate (observe +
   * mutation + prepare) runs after the hydration quiet gate for SPA safety.
   * Returns true if at least one block was found and bound.
   */
  function bindViewportNow(): boolean {
    if (blocks.length === 0) {
      // FR4: only scan parents that are inside the visual viewport. This avoids
      // building TokenBlock objects for the entire page during cold-start.
      const scanned = findTextBlocks(root, { langCode, filter: isElementInViewport });
      for (const block of scanned) {
        cache.set(block);
        blocks.push(block);
        blockSet.add(block);
        blockElements.add(block.element);
        visibleElements.add(block.element);
        try {
          bindVisibleBlock(block);
        } catch (err) {
          // ponytail: one malformed block must not abort the cold-start scan;
          // activateAfterStability (off-screen observe) is needed for scroll.
          console.error('[webTokenize] bindVisibleBlock failed during cold-start for', block.id, err);
        }
      }
    }
    let bound = false;
    for (const block of blocks) {
      if (!block.isBound && block.element.isConnected && visibleElements.has(block.element)) {
        bindVisibleBlock(block);
      }
      if (block.isBound) bound = true;
    }
    return bound;
  }

  // MV3 suspends an idle SW after ~30s and the warm freq term index + DB
  // connections die with it — a ping each interval resets the suspension for
  // the controller's lifetime so a toggle after idle still lands on a hot SW.
  let keepAliveTimer: number | undefined;
  const KEEP_ALIVE_MS = 25_000;

  function setActive(active: boolean): void {
    if (active === isActive) return;
    isActive = active;
    if (active) {
      viewport = createViewport(resolveViewportRootMargin());
      scrollVelocity = 0;
      lastScrollT = 0;
      const initialPrefetch = resolvePrefetchMarginBucket();
      prefetchMarginBucket = initialPrefetch.bucket;
      prefetchViewport = createViewport(initialPrefetch.margin);
      lastScrollY = window.scrollY;
      scrollDirection = 'none';
      window.addEventListener('scroll', onScroll, { passive: true });
      // VDLT-Predict FR4: bind viewport blocks first so toggle feels instant.
      // The filtered scan only walks subtrees inside the viewport, so the
      // enable path pays for ~50 visible blocks instead of the whole page;
      // the full walk (observe + prepare for offscreen blocks) defers past
      // first paint — offscreen blocks only need observation before scroll.
      // Zero-bound means the viewport genuinely holds no text (or rects are
      // unavailable) — fall back to the full eager scan so blocks still bind.
      if (bindViewportNow()) {
        // The full walk must not land inside the first metadata window — a
        // +0ms scan competes with the meta response delivery + status apply
        // on the same thread (~+400ms observed). 300ms is past the critical
        // flush but still before a human can scroll to unseen content.
        setTimeout(() => {
          if (isActive) scanAndObserveBlocks(false);
        }, 300);
      } else {
        scanAndObserveBlocks(true);
      }
      updateMutationObservation(true);
      options.onBlocksChanged?.();
    } else {
      updateMutationObservation(false);
      window.removeEventListener('scroll', onScroll);
      if (scrollRafId !== undefined) {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = undefined;
      }
      scheduler.stop();
      scheduler.clear();
      viewport.destroy();
      prefetchViewport?.destroy();
      prefetchViewport = null;
      prefetchQueue.clear();
      visibleElements.clear();
      unbindAll();
      blocks.length = 0;
      blockSet.clear();
      blockElements.clear();
      cache.clear();
      pendingAddedNodes = [];
      pendingRemovedNodes = [];
      mutationFlushPending = false;
      if (mutationTimer) {
        clearTimeout(mutationTimer);
        mutationTimer = null;
      }
      if (metadataFlushTimer) {
        clearTimeout(metadataFlushTimer);
        metadataFlushTimer = null;
      }
      if (preparedNotifyTimer !== null) {
        clearTimeout(preparedNotifyTimer);
        preparedNotifyTimer = null;
      }
      metadataQueue = [];
      mutationWindowStart = 0;
    }
  }

  const unsubscribe = stateStore.subscribe((state) => {
    const wasActive = isActive;
    setActive(state.enabled);
    if (state.enabled && wasActive) scheduleVisible();
    if (!state.enabled) {
      cancelPendingActivation?.();
      cancelPendingActivation = null;
    }
  });

  let prevSelectedTerms = stateStore.getState().selectedTerms;
  const unsubscribeSelection = stateStore.subscribe((state) => {
    if (state.selectedTerms === prevSelectedTerms) return;
    const changed = new Set<string>();
    for (const term of state.selectedTerms) {
      if (!prevSelectedTerms.has(term)) changed.add(term);
    }
    for (const term of prevSelectedTerms) {
      if (!state.selectedTerms.has(term)) changed.add(term);
    }
    prevSelectedTerms = state.selectedTerms;
    for (const block of blocks) {
      if (!block.isBound || !block.tokens) continue;
      if (block.tokens.some((token) => !token.isSeparator && changed.has(token.term))) {
        rebindBlock(block);
      }
    }
  });

  // Display-flag changes (status/frequency/reading/gloss layers) restyle
  // bound visible blocks in place — classes and lane attrs swap without
  // rebuilding token DOM, so an open selection survives the toggle.
  // getState() returns the live state object, so the snapshot must copy the
  // flags out — keeping the reference would compare state against itself.
  let prevDisplay = displayFlags(stateStore.getState());
  const unsubscribeDisplay = stateStore.subscribe((state) => {
    const flagsChanged =
      state.showStatus !== prevDisplay.showStatus ||
      state.showFrequency !== prevDisplay.showFrequency ||
      state.readingDisplay !== prevDisplay.readingDisplay ||
      state.glossDisplay !== prevDisplay.glossDisplay;
    const annotationsEnabled =
      (state.readingDisplay !== 'off' && prevDisplay.readingDisplay === 'off') ||
      (state.glossDisplay !== 'off' && prevDisplay.glossDisplay === 'off');
    prevDisplay = displayFlags(state);
    if (!flagsChanged && !annotationsEnabled) return;
    for (const block of blocks) {
      if (!block.isBound) continue;
      if (visibleElements.has(block.element)) rebindBlock(block);
      // Blocks bound before an annotation lane was enabled never fetched
      // readings/glosses — re-queue so their lanes fill in.
      if (annotationsEnabled && !annotationsResolved.has(block)) {
        requeueForAnnotations(block);
      }
    }
    if (annotationsEnabled) scheduleMetadataFlush();
  });

  // === MutationObserver: handle dynamically added content (React/Vue/Angular/Cloudflare) ===
  // The observer is only connected when tokenize is enabled. Keeping it
  // disconnected during page load avoids conflicts with Cloudflare Rocket
  // Loader / Angular hydration while scripts are still being injected.
  let mutationTimer: ReturnType<typeof setTimeout> | null = null;
  let mutationFlushPending = false;
  // First-pending timestamp: when the current debounce window opened. Used to
  // enforce MAX_MUTATION_SCAN_DELAY_MS — without it, continuous mutations
  // (Facebook re-renders, polling) reset the trailing debounce forever and the
  // re-scan never fires, leaving dynamically added/replaced content untokenized.
  let mutationWindowStart = 0;
  let dynIdCounter = 0;
  // Accumulate added/removed nodes across multiple rapid MutationObserver
  // callbacks so the debounced re-scan does not lose nodes that arrived
  // between resets — and so removed-node cleanup sweeps `blocks` once per
  // flush instead of once per removed node.
  let pendingAddedNodes: Node[] = [];
  let pendingRemovedNodes: Node[] = [];

  function processAddedNodes(added: readonly Node[], eager: boolean): void {
    if (!stateStore.getState().enabled) return;
    if (added.length === 0) return;
    const scanId = dynIdCounter;
    dynIdCounter += 1000; // reserve a range for this scan
    const newBlocks = findTextBlocksInNodes(added, { langCode, idPrefix: `dyn-${scanId}-` });
    for (const block of newBlocks) {
      // The same text node now reuses a single TokenBlock object across scans,
      // so membership in the observed list is the duplicate guard.
      if (blockSet.has(block)) continue;
      blocks.push(block);
      blockSet.add(block);
      blockElements.add(block.element);
      // Only eager-bind small mutation batches. Large batches (e.g. hydration,
      // re-rendering a whole subtree) can produce hundreds of blocks; doing a
      // synchronous getBoundingClientRect for each one forces repeated layout.
      observeBlock(block, eager && added.length <= 50);
    }
    options.onBlocksChanged?.();
  }

  function handleCharacterDataMutation(textNode: Text): void {
    const parent = textNode.parentElement;
    if (!parent) return;
    const existing = cache.getByElement(parent);
    for (const block of existing) {
      if (block.sourceNodes[0] === textNode) {
        block.originalText = textNode.textContent ?? '';
        block.tokens = undefined;
        block.isBound = false;
        options.onBlocksChanged?.();
        if (visibleElements.has(parent)) {
          bindVisibleBlock(block);
        }
        break;
      }
    }
  }

  function flushRemovedNodes(removed: readonly Node[]): void {
    if (removed.length === 0 || blocks.length === 0) return;
    // A removed node can only drop tracked blocks when it can contain them
    // (has descendants) or is itself a block element — pure leaves and
    // non-Element nodes skip the sweep entirely.
    let needsSweep = false;
    for (const node of removed) {
      if (!(node instanceof Element)) continue;
      // Stop observing and release the element so a removed/re-rendered
      // subtree does not stay alive via the tracker set until cache eviction.
      viewport.unobserve(node);
      visibleElements.delete(node);
      if (node.hasChildNodes() || blockElements.has(node)) needsSweep = true;
    }
    if (!needsSweep) return;
    // Ancestor removals detach descendant blocks without hitting
    // cache.getByElement(node); sweep any block whose element is gone.
    let removedAny = false;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i]!;
      if (!block.element.isConnected) {
        blocks.splice(i, 1);
        blockSet.delete(block);
        blockElements.delete(block.element);
        cache.delete(block.id);
        viewport.unobserve(block.element);
        visibleElements.delete(block.element);
        removedAny = true;
      }
    }
    if (removedAny) options.onBlocksChanged?.();
  }

  function flushPendingMutations(): void {
    mutationFlushPending = false;
    if (!stateStore.getState().enabled) {
      pendingAddedNodes = [];
      pendingRemovedNodes = [];
      return;
    }
    const removed = pendingRemovedNodes;
    pendingRemovedNodes = [];
    flushRemovedNodes(removed);
    let added = pendingAddedNodes;
    if (added.length > PENDING_MUTATION_LIMIT) {
      // Chunk processing so a single microtask cannot walk an unbounded DOM
      // subtree on low-end devices with 500MB RAM.
      pendingAddedNodes = added.slice(PENDING_MUTATION_LIMIT);
      added = added.slice(0, PENDING_MUTATION_LIMIT);
    } else {
      pendingAddedNodes = [];
    }
    processAddedNodes(added, true);
    if (pendingAddedNodes.length > 0) {
      scheduleMutationFlush();
    }
  }

  function scheduleMutationFlush(): void {
    if (mutationFlushPending) return;
    mutationFlushPending = true;
    queueMicrotask(flushPendingMutations);
  }

  mutationObserver = new MutationObserver((mutations) => {
    const now = Date.now();
    for (const m of mutations) {
      if (m.type === 'characterData' && m.target instanceof Text) {
        handleCharacterDataMutation(m.target);
        continue;
      }
      for (const n of m.addedNodes ?? []) {
        // Skip our own token spans — every bind/rebind would otherwise feed
        // ~1600 nodes back into the rescan queue inside the critical window.
        if (n instanceof Element && n.classList.contains(TOKEN_CLASS)) continue;
        pendingAddedNodes.push(n);
      }
      for (const n of m.removedNodes ?? []) {
        if (n instanceof Element && n.classList.contains(TOKEN_CLASS)) continue;
        pendingRemovedNodes.push(n);
      }
    }
    if (pendingAddedNodes.length === 0 && pendingRemovedNodes.length === 0) return;
    if (!mutationWindowStart) mutationWindowStart = now;
    // Fast path: flush in the next microtask, before the browser paints, so new
    // content is tokenized immediately instead of waiting for a 16ms animation
    // frame or the trailing debounce.
    scheduleMutationFlush();
    // Fallback: if the microtask path somehow stalls (tab backgrounded, very
    // slow device), still process after the debounce/max-delay cap.
    if (mutationTimer) clearTimeout(mutationTimer);
    const remaining = MAX_MUTATION_SCAN_DELAY_MS - (now - mutationWindowStart);
    const delay = Math.min(MUTATION_DEBOUNCE_MS, Math.max(0, remaining));
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      mutationWindowStart = 0;
      scheduleMutationFlush();
    }, delay);
  });

  // Activate only when tokenize is already enabled for this URL. By default the
  // controller starts inactive, so no heavy DOM scanning/observation happens
  // during page load and Rocket Loader / Angular hydration can finish safely.
  // VDLT-Predict FR4: viewport tokens bind immediately after load (no quiet
  // wait); the quiet gate only delays the offscreen hydrate (observe + mutation
  // listener) so SPA hydration is not disturbed.
  if (initialEnabled) {
    const activateAfterStability = (): void => {
      let stabilityTimer: ReturnType<typeof setTimeout> | null = null;
      // Hard cap: activate after MAX_ACTIVATION_DELAY_MS regardless of ongoing
      // mutations. Without this, heavy SPAs that mutate continuously (Facebook,
      // Twitter) never reach the HYDRATION_QUIET_MS quiet period and tokenize
      // stays at 0 tokens indefinitely (observed: 9s+ delay under throttle).
      let maxDelayTimer: ReturnType<typeof setTimeout> | null = null;
      const stabilityObserver = new MutationObserver(() => scheduleStabilityCheck());
      const cleanup = (): void => {
        stabilityObserver.disconnect();
        if (stabilityTimer) clearTimeout(stabilityTimer);
        if (maxDelayTimer) clearTimeout(maxDelayTimer);
      };
      const activate = (): void => {
        cleanup();
        cancelPendingActivation = null;
        if (stateStore.getState().enabled) setActive(true);
      };
      const scheduleStabilityCheck = (): void => {
        if (stabilityTimer) clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(activate, HYDRATION_QUIET_MS);
      };
      // FR4: bind viewport blocks immediately so the user sees tokens without
      // waiting for the hydration quiet period. This only scans + binds blocks
      // whose getBoundingClientRect is inside the viewport — no observers, no
      // mutation listener — so it does not conflict with SPA hydration.
      if (stateStore.getState().enabled) bindViewportNow();
      stabilityObserver.observe(document.documentElement, { childList: true, subtree: true });
      scheduleStabilityCheck();
      maxDelayTimer = setTimeout(activate, MAX_ACTIVATION_DELAY_MS);
      cancelPendingActivation = cleanup;
    };
    const handleLoad = (): void => {
      cancelPendingActivation = null;
      if (stateStore.getState().enabled) activateAfterStability();
    };
    // Viewport paint can't wait for window.load — on ad/slow-asset pages that
    // event lands seconds after DOMContentLoaded while the text is already
    // there to scan. Full activation still gates on load/hydration-quiet.
    const handleInteractive = (): void => {
      if (stateStore.getState().enabled) bindViewportNow();
    };
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      if (document.readyState === 'interactive') handleInteractive();
      else document.addEventListener('DOMContentLoaded', handleInteractive, { once: true });
      window.addEventListener('load', handleLoad, { once: true });
      cancelPendingActivation = () => {
        document.removeEventListener('DOMContentLoaded', handleInteractive);
        window.removeEventListener('load', handleLoad);
      };
    }
  }

  window.addEventListener('yt-navigate-finish', reevaluateEnabledForCurrentUrl);
  window.addEventListener('popstate', reevaluateEnabledForCurrentUrl);
  keepAliveTimer = window.setInterval(() => pingTokenizeMeta(langCode), KEEP_ALIVE_MS);

  function pickDictionaryTerm(state: TokenizeState): string | null {
    if (state.selectedTerms.size > 0) return state.selectedTerms.values().next().value as string;
    if (state.hoveredTerm) return state.hoveredTerm;
    return null;
  }

  function toggleEnabled(): void {
    const nextEnabled = !stateStore.getState().enabled;
    stateStore.setEnabled(nextEnabled);
    void (async () => {
      const current = await loadTokenizeSettings();
      const next = setTokenizeEnabledForUrl(current, window.location.href, nextEnabled);
      await saveTokenizeSettings(next);
    })();
  }

  function reevaluateEnabledForCurrentUrl(): void {
    void loadTokenizeSettings().then((s) => {
      stateStore.setEnabled(isTokenizeEnabledForUrl(s, window.location.href));
    });
  }

  function schedulePreparedNotify(): void {
    if (preparedNotifyTimer !== null) return;
    preparedNotifyTimer = window.setTimeout(() => {
      preparedNotifyTimer = null;
      options.onBlocksChanged?.();
    }, 400);
  }

  function prepareBlock(block: TokenBlock): void {
    if (block.tokens !== undefined) return;
    prepareTokenBlock(block, langCode);
    if (block.tokens !== undefined) schedulePreparedNotify();
  }

  function sentenceKey(block: TokenBlock, element: HTMLElement): string {
    return `${block.id}:${element.getAttribute('data-tihoka-sentence') ?? '0'}`;
  }

  function clearSentenceWash(): void {
    clearSentenceHighlight(highlightedSpans);
    highlightedSpans = [];
    washedSentenceKey = null;
  }

  function washSentence(block: TokenBlock, element: HTMLElement): void {
    const key = sentenceKey(block, element);
    if (washedSentenceKey === key && highlightedSpans[0]?.isConnected) return;
    clearSentenceWash();
    highlightedSpans = highlightSentence(element);
    washedSentenceKey = key;
  }

  function getDisplayOptions(): TokenSpanBindOptions {
    const state = stateStore.getState();
    return {
      showStatus: state.showStatus,
      showFrequency: state.showFrequency,
      readingDisplay: state.readingDisplay,
      glossDisplay: state.glossDisplay,
      onTokenEnter: (term, block, element) => {
        stateStore.setHoveredTerm(term);
        const key = sentenceKey(block, element);
        if (pinnedSentenceKey && pinnedSentenceKey !== key) pinnedSentenceKey = null;
        washSentence(block, element);
      },
      onTokenLeave: (term) => {
        if (stateStore.getState().hoveredTerm === term) {
          stateStore.setHoveredTerm(null);
        }
        if (!pinnedSentenceKey) clearSentenceWash();
      },
      onTokenClick: (term, block, element, token, event) => {
        pinnedSentenceKey = sentenceKey(block, element);
        washSentence(block, element);
        const ctx = sentenceContextForSpan(element)
          ?? sentenceContextForIndex(block.tokens ?? [], block.originalText, token.sentenceIndex, token.start);
        options.onOpenDictionary?.(term, element, ctx?.sentence ?? block.originalText, event, ctx?.cursorOffset ?? 0);
      },
      onSeparatorEnter: (block, element) => {
        const key = sentenceKey(block, element);
        if (pinnedSentenceKey && pinnedSentenceKey !== key) pinnedSentenceKey = null;
        washSentence(block, element);
      },
      onSeparatorLeave: () => {
        if (!pinnedSentenceKey) clearSentenceWash();
      },
      onSeparatorClick: (block, element) => {
        pinnedSentenceKey = sentenceKey(block, element);
        washSentence(block, element);
      },
      onTokenCtrlClick: (term) => stateStore.toggleSelectedTerm(term),
      isSelected: (term) => stateStore.getState().selectedTerms.has(term),
    };
  }

  function rebindBlock(block: TokenBlock): void {
    if (restyleTokenBlock(block, getDisplayOptions())) return;
    unbindTokenBlock(block);
    bindTokenBlock(block, getDisplayOptions());
  }

  function bindVisibleBlock(block: TokenBlock): void {
    prepareBlock(block);
    if (!stateStore.getState().enabled || !visibleElements.has(block.element)) {
      return;
    }
    if (!block.isBound) {
      bindTokenBlock(block, getDisplayOptions());
    }
    // If binding could not replace the source node (e.g. SPA re-render detached
    // it between scan/observe and bind), evict the stale block so the next
    // mutation can create a fresh one instead of leaving text untokenized.
    if (!block.isBound) {
      const idx = blocks.indexOf(block);
      if (idx >= 0) {
        blocks.splice(idx, 1);
        blockSet.delete(block);
        blockElements.delete(block.element);
      }
      cache.delete(block.id);
      return;
    }
    cache.touch(block);
    scheduleMetadataResolve(block);
  }

  function rebindVisibleBlock(block: TokenBlock): void {
    prepareBlock(block);
    if (!stateStore.getState().enabled || !visibleElements.has(block.element)) return;
    rebindBlock(block);
    cache.touch(block);
    scheduleMetadataResolve(block);
  }

  function scheduleVisible(): void {
    for (const element of visibleElements) {
      const elementBlocks = cache.getByElement(element);
      for (const block of elementBlocks) {
        scheduler.schedule(() => rebindVisibleBlock(block), PRIORITY_VIEWPORT);
      }
    }
  }

  function isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    if (rect.height === 0) return false;
    // Tight margin: the cold-start fast path should only bind text that is
    // actually inside (or barely touching) the viewport. The IntersectionObserver
    // with its overscan rootMargin handles blocks just outside.
    const margin = 50;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }

  function tryBindVisible(block: TokenBlock): void {
    if (isElementInViewport(block.element)) {
      visibleElements.add(block.element);
      cache.set(block);
      bindVisibleBlock(block);
    }
  }

  function applyStatusToTerms(terms: readonly string[], status: WordStatus): void {
    statusVersionCounter++;
    const version = statusVersionCounter;
    for (const term of terms) {
      termStatusVersion.set(term, version);
      localStatusOverrides.set(term, { status, version });
    }
    const termSet = new Set(terms);
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (!token.isSeparator && termSet.has(token.term)) {
          token.status = status;
          changed = true;
        }
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
    for (const term of terms) {
      emitWordStatusChanged({ langCode, term, status });
      options.onStatusChange?.(term, langCode, status);
    }
    void Promise.all(terms.map((term) => setWordStatus(langCode, term, status).catch(() => { /* best-effort */ })));
  }

  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle (which already persists via its own
   *  WORD_STATUS_SET message) so token blocks rebind with the new status instead of
   *  reverting to the stale cached value on the next scroll/toggle rebind. */
  function applyStatusForTerm(term: string, status: WordStatus): void {
    statusVersionCounter++;
    termStatusVersion.set(term, statusVersionCounter);
    localStatusOverrides.set(term, { status, version: statusVersionCounter });
    statusCache.set(term, status);
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (!token.isSeparator && token.term === term) {
          token.status = status;
          changed = true;
        }
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
  }

  function getStatusForTerm(term: string): WordStatus {
    for (const block of blocks) {
      if (!block.tokens) continue;
      for (const token of block.tokens) {
        if (token.term === term) return token.status ?? 'unknown';
      }
    }
    return 'unknown';
  }

  function toggleTrackingToTerms(terms: readonly string[]): void {
    for (const term of terms) {
      const current = getStatusForTerm(term);
      const next = toggleTrackingFlag(current);
      if (next !== current) applyStatusToTerms([term], next);
    }
  }

  const unsubscribeWordStatus = onWordStatusChanged(({ langCode: eventLangCode, term, status }) => {
    if (eventLangCode === langCode) applyStatusForTerm(term, status);
  });

  async function refreshStatusesFromRemote(): Promise<void> {
    const baseline = statusVersionCounter;
    const terms = new Set<string>();
    for (const block of blocks) {
      if (!block.tokens) continue;
      for (const token of block.tokens) {
        if (!token.isSeparator) terms.add(token.term);
      }
    }
    if (terms.size === 0) return;
    let statusMap: Map<string, WordStatus>;
    try {
      statusMap = await getWordStatuses(langCode, [...terms]);
    } catch {
      return;
    }
    statusVersionCounter++;
    const version = statusVersionCounter;
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (token.isSeparator) continue;
        const override = localStatusOverrides.get(token.term);
        if (override !== undefined && override.version > baseline) continue;
        const next = statusMap.get(token.term) ?? 'unknown';
        statusCache.set(token.term, next);
        if (token.status === next) continue;
        token.status = next;
        termStatusVersion.set(token.term, version);
        localStatusOverrides.set(token.term, { status: next, version });
        changed = true;
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
  }

  const unsubscribeStatusesReload = onWordStatusesReload((eventLangCode) => {
    if (eventLangCode === langCode) void refreshStatusesFromRemote();
  });

  async function refreshCardFlagsFromRemote(): Promise<void> {
    invalidateSrsCardTermSet(langCode);
    let cardTerms: Set<string>;
    try {
      cardTerms = await getSrsCardTermSet(langCode);
    } catch {
      return;
    }
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (token.isSeparator) continue;
        const hasCard = cardTerms.has(token.term);
        if ((token.hasCard ?? false) === hasCard) continue;
        token.hasCard = hasCard;
        changed = true;
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
  }

  const unsubscribeSrsCards = onSrsCardsChanged((eventLangCode) => {
    if (eventLangCode === langCode) void refreshCardFlagsFromRemote();
  });

  function getShadowRoots(): ShadowRoot[] {
    const root = options.root?.getRootNode();
    return root instanceof ShadowRoot ? [root] : [];
  }

  const statusKeyControls = createStatusKeyControls({
    stateStore,
    getShadowRoots,
    applyStatusToTerms,
    toggleTrackingToTerms,
    getPopupTarget: options.getPopupStatusTarget,
  });

  function unbindAll(): void {
    for (const block of blocks) {
      unbindTokenBlock(block);
    }
    // Fallback: any token span that escaped the known block list is restored to plain text.
    for (const span of root.querySelectorAll('.' + TOKEN_CLASS)) {
      const text = span.textContent ?? '';
      span.replaceWith(document.createTextNode(text));
    }
  }

  return {
    getState: () => stateStore.getState(),

    enable: () => {
      if (!stateStore.getState().enabled) toggleEnabled();
    },

    disable: () => {
      if (stateStore.getState().enabled) toggleEnabled();
    },

    setShowStatus: (show) => stateStore.setShowStatus(show),
    setShowFrequency: (show) => stateStore.setShowFrequency(show),
    setReadingDisplay: (mode) => stateStore.setReadingDisplay(mode),
    setGlossDisplay: (mode) => stateStore.setGlossDisplay(mode),

    /** Subscribe to tokenize state changes (for orbital panel sync). */
    subscribe: (cb: (state: TokenizeState) => void) => stateStore.subscribe(cb),

    /** Toggle helpers exposed for the orbital badge panel. */
    toggleEnabled: () => toggleEnabled(),
    toggleShowStatus: () => stateStore.setShowStatus(!stateStore.getState().showStatus),
    toggleShowFrequency: () => stateStore.setShowFrequency(!stateStore.getState().showFrequency),
    toggleReadingDisplay: () => stateStore.setReadingDisplay(stateStore.getState().readingDisplay === 'off' ? 'always' : 'off'),
    toggleGlossDisplay: () => stateStore.setGlossDisplay(stateStore.getState().glossDisplay === 'off' ? 'always' : 'off'),

    setGlossTargetLanguage: (tl) => {
      if (glossTargetLanguage === tl) return;
      glossTargetLanguage = tl;
      if (stateStore.getState().glossDisplay === 'off') return;
      for (const block of blocks) requeueForAnnotations(block);
      scheduleMetadataFlush();
    },

    /** Pick a dictionary term from current state (for "Open Dictionary" btn). */
    pickDictionaryTerm: () => pickDictionaryTerm(stateStore.getState()),

    handleStatusKey: statusKeyControls.handleStatusKey,

    applyStatusForTerm,
    getStatusForTerm,

    getBlocks: () => blocks,

    getAllTokens: () => {
      const out: Token[] = [];
      for (const block of blocks) {
        if (!block.element.isConnected) continue;
        if (!block.tokens) prepareBlock(block);
        if (block.tokens) out.push(...block.tokens);
      }
      return out;
    },

    destroy: () => {
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('keydown', onCopyKeydown, true);
      clearSentenceHighlight(highlightedSpans);
      statusKeyControls.destroy();
      unsubscribe();
      unsubscribeSelection();
      unsubscribeDisplay();
      unsubscribeWordStatus();
      unsubscribeStatusesReload();
      unsubscribeSrsCards();
      scheduler.stop();
      setActive(false);
      cancelPendingActivation?.();
      if (keepAliveTimer !== undefined) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = undefined;
      }
      if (mutationTimer) clearTimeout(mutationTimer);
      window.removeEventListener('yt-navigate-finish', reevaluateEnabledForCurrentUrl);
      window.removeEventListener('popstate', reevaluateEnabledForCurrentUrl);
    },
  };
}
