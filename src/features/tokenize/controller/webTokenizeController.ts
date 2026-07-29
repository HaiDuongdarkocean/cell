import { findTextBlocks, findTextBlocksInNodes } from '@/features/tokenize/logic/tokenizeBlock';
import { TokenizeCache } from '@/features/tokenize/logic/tokenizeCache';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_BUFFER } from '@/features/tokenize/logic/tokenizeScheduler';
import { ViewportTracker } from '@/features/tokenize/logic/viewportTracker';
import { resolveScrollPredictMargin, type ScrollDirection } from '@/features/tokenize/logic/scrollDirection';
import { prepareTokenBlock, resolveTokenMetadata, getSentenceText } from '@/features/tokenize/logic/textTokenizer';
import { bindTokenBlock, unbindTokenBlock, TOKEN_CLASS, type TokenSpanBindOptions } from '@/features/tokenize/ui/tokenSpanRenderer';
import { createTokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import type { TokenizeState, TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import {
  loadTokenizeSettings,
  saveTokenizeSettings,
  isTokenizeEnabledForUrl,
  setTokenizeEnabledForUrl,
} from '@/features/tokenize/services/tokenizeSettingsStore';
import { getFrequencyEntries } from '@/features/dictionaryPopup/services/frequencyClient';
import { getWordStatuses, setWordStatus } from '@/features/dictionaryPopup/services/wordStatusClient';
import type { WordStatus } from '@/features/dictionaryPopup/types';
import { entriesToBand } from '@/features/tokenize/utils/frequencyBand';
import { extractTermsFromSelection } from '@/features/tokenize/utils/selectionTerms';
import type { TokenBlock, TokenizeController } from '@/features/tokenize/types';

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
// Phase A uses an isotropic large near-zone (above + below). This guarantees
// the viewport immediately above and below the current view is already parsed
// and bound, so a one-viewport scroll in either direction shows no plain text.
// In Phase B the tracker is recreated with an asymmetric margin from
// resolveScrollPredictMargin; this constant is the initial / no-direction value.
const BASE_OVERSCAN_ROOT_MARGIN_PX = 600;
function resolveViewportRootMargin(): string {
  // Use explicit `0px` units — some Chromium builds reject a bare `0` token
  // in an IntersectionObserver rootMargin string.
  return `${BASE_OVERSCAN_ROOT_MARGIN_PX}px 0px ${BASE_OVERSCAN_ROOT_MARGIN_PX}px 0px`;
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

const STATUS_BY_KEY: Readonly<Record<string, WordStatus>> = {
  '1': 'unknown',
  '2': 'tracking',
  '3': 'known',
  '4': 'ignore',
};

export interface WebTokenizeControllerOptions {
  /** Current page URL used for per-URL enable state. */
  readonly url: string;
  /** Root element to scan for text blocks. Defaults to document.body. */
  readonly root?: Element | null;
  /** Language code for lookups. */
  readonly langCode?: string;
  /** Callback when the user asks to open the Popup Dictionary.
   *  Provides the clicked token element and the original sentence for context. */
  readonly onOpenDictionary?: (term: string, element: HTMLElement, contextSentence: string) => void;
  /** Callback when a word status changes via keyboard shortcut or other action. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
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
  /** Pick a dictionary term from current state (for "Open Dictionary" btn). */
  readonly pickDictionaryTerm: () => string | null;
  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle so token blocks rebind with the new
   *  status instead of reverting to the stale cached value on the next rebind. */
  readonly applyStatusForTerm: (term: string, status: WordStatus) => void;
  /** Get the locally cached word status for a term. */
  readonly getStatusForTerm: (term: string) => WordStatus;
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
  });

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

  // Batch metadata resolver: gather terms from all blocks that become visible in
  // the same microtask, then send a single message pair (status + frequency) to
  // the background. Per-block messages are the main bottleneck on pages like
  // Facebook with many visible paragraphs.
  let metadataQueue: TokenBlock[] = [];
  let metadataFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const metadataResolved = new WeakSet<TokenBlock>();
  const metadataPending = new WeakSet<TokenBlock>();
  // Race guard: keyboard / popup status changes that happen while a metadata
  // flush is mid-await must win over the stale background snapshot. Each local
  // override records the status and a monotonic version; the flush captures the
  // version at the moment it is scheduled so a stale background snapshot cannot
  // clobber a user change made while the flush was in flight.
  let statusVersionCounter = 0;
  let nextFlushVersion = 0;
  const termStatusVersion = new Map<string, number>();
  const localStatusOverrides = new Map<string, { status: WordStatus; version: number }>();

  function createViewport(rootMargin: string): ViewportTracker {
    return new ViewportTracker({ rootMargin });
  }

  /** Recreate the ViewportTracker with a new rootMargin and re-observe all connected blocks. */
  function recreateViewportWithMargin(rootMargin: string): void {
    viewport.destroy();
    viewport = createViewport(rootMargin);
    // Re-observe every block whose element is still connected. ADR-055: the
    // synchronous onEnter path in ViewportTracker.observe fires for blocks that
    // are already intersecting, so visibleElements + bind scheduling resumes
    // without waiting for a new IO callback.
    for (const block of blocks) {
      if (block.element.isConnected) observeBlock(block);
    }
  }

  /** rAF-coalesced scroll handler: update direction + recreate tracker on change. */
  function onScroll(): void {
    if (scrollRafId !== undefined) return;
    scrollRafId = window.requestAnimationFrame(() => {
      scrollRafId = undefined;
      const scrollY = window.scrollY;
      const result = resolveScrollPredictMargin({
        scrollY,
        lastScrollY,
        viewportHeight: window.innerHeight,
        lastDirection: scrollDirection,
      });
      lastScrollY = scrollY;
      if (result.direction !== scrollDirection && result.direction !== 'none') {
        scrollDirection = result.direction;
        recreateViewportWithMargin(result.rootMargin);
      }
    });
  }

  async function flushMetadataQueue(): Promise<void> {
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
    const [statusMap, freqMaps] = await Promise.all([
      getWordStatuses(langCode, termList),
      getFrequencyEntries(langCode, termList),
    ]);
    for (const block of batch) {
      if (!block.tokens) {
        metadataPending.delete(block);
        continue;
      }
      await resolveTokenMetadata(
        block.tokens,
        (term) => Promise.resolve(statusMap.get(term) ?? 'unknown'),
        (term) => Promise.resolve(entriesToBand(freqMaps.get(term) ?? [])),
      );
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
  }

  function scheduleMetadataResolve(block: TokenBlock): void {
    if (metadataResolved.has(block) || metadataPending.has(block)) return;
    metadataPending.add(block);
    metadataQueue.push(block);
    if (!metadataFlushTimer) {
      // Flush in the next microtask so multiple visible blocks arriving in the
      // same scheduler tick are batched into one background request. Capture the
      // status version at scheduling time so a stale in-flight snapshot can be
      // detected and overruled by any user change that happens before it runs.
      nextFlushVersion = statusVersionCounter;
      metadataFlushTimer = setTimeout(() => void flushMetadataQueue(), 0);
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
  let isActive = false;
  let cancelPendingActivation: (() => void) | null = null;

  function observeBlock(block: TokenBlock, eager = false): void {
    viewport.observe(block.element, {
      onEnter: () => {
        visibleElements.add(block.element);
        // Keep the block resident so metadata + rebinds can find it. Adding it
        // here (rather than in scanAndObserveBlocks) prevents the LRU cache from
        // evicting distant offscreen blocks over the viewport blocks we are
        // actively binding.
        cache.set(block);
        // If the block is already bound (e.g. by eager tryBindVisible during a
        // mutation batch), skip scheduling a no-op bind task to keep the queue
        // short on low-end devices.
        if (stateStore.getState().enabled && !block.isBound) {
          // bindVisibleBlock calls prepareBlock internally, so one task is
          // enough; scheduling a separate prepare task causes it to run *after*
          // bind because PRIORITY_VIEWPORT (0) sorts before PRIORITY_PREPARE (5).
          scheduler.schedule(() => bindVisibleBlock(block), PRIORITY_VIEWPORT);
        }
      },
      onExit: () => {
        visibleElements.delete(block.element);
        // Soft-unbind and release the cache slot for blocks that leave the
        // observed range. The block stays in `blocks` so it can be re-observed.
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

  function scanAndObserveBlocks(): void {
    const scanned = findTextBlocks(root, { langCode });
    for (const block of scanned) {
      // VDLT-Predict FR4: bindViewportNow may have already scanned + cached
      // this block during cold-start. The same text node reuses one TokenBlock
      // object, so membership in `blocks` is the duplicate guard.
      if (blocks.includes(block)) continue;
      // Do not cache offscreen blocks yet. Adding them to the LRU cache now
      // would evict the viewport blocks we just bound during cold-start,
      // breaking scroll parse. The cache is populated lazily in onEnter when
      // the block enters the viewport/overscan.
      blocks.push(block);
      // Observe the new block immediately. Disconnected nodes are harmless to
      // observe (the callback simply won't fire) and match the original test
      // expectation that a root-only node is registered.
      observeBlock(block);
    }
    // bindViewportNow may have bound viewport blocks whose source nodes are no
    // longer discoverable by findTextBlocks (they became token spans). Make
    // sure those existing blocks are observed so scroll enter/exit keeps them
    // in sync.
    for (const block of blocks) {
      if (block.element.isConnected) observeBlock(block);
    }
    const tagDistribution: Record<string, number> = {};
    for (const block of scanned) {
      const tag = block.element.tagName;
      tagDistribution[tag] = (tagDistribution[tag] ?? 0) + 1;
    }
    (window as unknown as Record<string, unknown>).__CELL_SCAN_INFO = {
      scanned: scanned.length,
      blocks: blocks.length,
      tags: tagDistribution,
    };
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

  function setActive(active: boolean): void {
    if (active === isActive) return;
    isActive = active;
    if (active) {
      viewport = createViewport(resolveViewportRootMargin());
      lastScrollY = window.scrollY;
      scrollDirection = 'none';
      window.addEventListener('scroll', onScroll, { passive: true });
      // VDLT-Predict FR4: bind viewport blocks first so toggle feels instant,
      // then observe + prepare the rest. bindViewportNow scans if needed and
      // only touches blocks whose getBoundingClientRect is inside the viewport
      // (one batched layout pass), so it does not force a reflow per block.
      bindViewportNow();
      scanAndObserveBlocks();
      updateMutationObservation(true);
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
      visibleElements.clear();
      unbindAll();
      blocks.length = 0;
      cache.clear();
      pendingAddedNodes = [];
      mutationFlushPending = false;
      if (mutationTimer) {
        clearTimeout(mutationTimer);
        mutationTimer = null;
      }
      if (metadataFlushTimer) {
        clearTimeout(metadataFlushTimer);
        metadataFlushTimer = null;
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
  // Accumulate added nodes across multiple rapid MutationObserver callbacks so
  // the debounced re-scan does not lose nodes that arrived between resets.
  let pendingAddedNodes: Node[] = [];

  function processAddedNodes(added: readonly Node[], eager: boolean): void {
    if (!stateStore.getState().enabled) return;
    if (added.length === 0) return;
    const scanId = dynIdCounter;
    dynIdCounter += 1000; // reserve a range for this scan
    const newBlocks = findTextBlocksInNodes(added, { langCode, idPrefix: `dyn-${scanId}-` });
    for (const block of newBlocks) {
      // The same text node now reuses a single TokenBlock object across scans,
      // so membership in the observed list is the duplicate guard.
      if (blocks.includes(block)) continue;
      blocks.push(block);
      // Only eager-bind small mutation batches. Large batches (e.g. hydration,
      // re-rendering a whole subtree) can produce hundreds of blocks; doing a
      // synchronous getBoundingClientRect for each one forces repeated layout.
      observeBlock(block, eager && added.length <= 50);
    }
  }

  function handleCharacterDataMutation(textNode: Text): void {
    const parent = textNode.parentElement;
    if (!parent) return;
    const existing = cache.getByElement(parent);
    for (const block of existing) {
      if (block.sourceNodes[0] === textNode) {
        block.tokens = undefined;
        block.isBound = false;
        if (visibleElements.has(parent)) {
          bindVisibleBlock(block);
        }
        break;
      }
    }
  }

  function handleRemovedNode(node: Node): void {
    if (!(node instanceof Element)) return;
    // Stop observing and release the element so a removed/re-rendered subtree
    // does not stay alive via the tracker set until cache eviction.
    viewport.unobserve(node);
    visibleElements.delete(node);
    const existing = cache.getByElement(node);
    for (const block of existing) {
      const idx = blocks.indexOf(block);
      if (idx >= 0) blocks.splice(idx, 1);
      cache.delete(block.id);
    }
  }

  function flushPendingAddedNodes(): void {
    mutationFlushPending = false;
    if (!stateStore.getState().enabled) {
      pendingAddedNodes = [];
      return;
    }
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
    queueMicrotask(flushPendingAddedNodes);
  }

  mutationObserver = new MutationObserver((mutations) => {
    const now = Date.now();
    for (const m of mutations) {
      if (m.type === 'characterData' && m.target instanceof Text) {
        handleCharacterDataMutation(m.target);
        continue;
      }
      for (const n of m.addedNodes ?? []) {
        pendingAddedNodes.push(n);
      }
      for (const n of m.removedNodes ?? []) {
        handleRemovedNode(n);
      }
    }
    if (pendingAddedNodes.length === 0) return;
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
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
      cancelPendingActivation = () => window.removeEventListener('load', handleLoad);
    }
  }

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
      const next = setTokenizeEnabledForUrl(current, url, nextEnabled);
      await saveTokenizeSettings(next);
    })();
  }

  function prepareBlock(block: TokenBlock): void {
    prepareTokenBlock(block, langCode);
  }

  function getDisplayOptions(): TokenSpanBindOptions {
    const state = stateStore.getState();
    return {
      showStatus: state.showStatus,
      showFrequency: state.showFrequency,
      onTokenEnter: (term) => stateStore.setHoveredTerm(term),
      onTokenLeave: (term) => {
        if (stateStore.getState().hoveredTerm === term) {
          stateStore.setHoveredTerm(null);
        }
      },
      onTokenClick: (term, block, element, token) =>
        options.onOpenDictionary?.(term, element, getSentenceText(block, token)),
      onTokenCtrlClick: (term) => stateStore.toggleSelectedTerm(term),
    };
  }

  function rebindBlock(block: TokenBlock): void {
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
      if (idx >= 0) blocks.splice(idx, 1);
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

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return target.getAttribute('contenteditable') === 'true' || target.isContentEditable === true;
  }

  async function applyStatusToTerms(terms: readonly string[], status: WordStatus): Promise<void> {
    statusVersionCounter++;
    const version = statusVersionCounter;
    for (const term of terms) {
      termStatusVersion.set(term, version);
      localStatusOverrides.set(term, { status, version });
    }
    await Promise.all(terms.map((term) => setWordStatus(langCode, term, status).catch(() => { /* best-effort */ })));
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
      options.onStatusChange?.(term, langCode, status);
    }
  }

  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle (which already persists via its own
   *  WORD_STATUS_SET message) so token blocks rebind with the new status instead of
   *  reverting to the stale cached value on the next scroll/toggle rebind. */
  function applyStatusForTerm(term: string, status: WordStatus): void {
    statusVersionCounter++;
    termStatusVersion.set(term, statusVersionCounter);
    localStatusOverrides.set(term, { status, version: statusVersionCounter });
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

  function handleKeydown(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    if (e.key === 'Escape') {
      stateStore.clearSelection();
      stateStore.setHoveredTerm(null);
      return;
    }
    const status = STATUS_BY_KEY[e.key];
    if (!status) return;
    const state = stateStore.getState();
    // Priority: Ctrl+Click selection > hovered token > native text selection.
    let terms = state.selectedTerms.size > 0 ? [...state.selectedTerms] : state.hoveredTerm ? [state.hoveredTerm] : [];
    let usedNativeSelection = false;
    if (terms.length === 0) {
      terms = extractTermsFromSelection(window.getSelection());
      usedNativeSelection = terms.length > 0;
    }
    if (terms.length === 0) return;
    e.preventDefault();
    void applyStatusToTerms(terms, status);
    if (state.selectedTerms.size > 0) stateStore.clearSelection();
    if (usedNativeSelection) window.getSelection()?.removeAllRanges();
  }

  document.addEventListener('keydown', handleKeydown);

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

    /** Subscribe to tokenize state changes (for orbital panel sync). */
    subscribe: (cb: (state: TokenizeState) => void) => stateStore.subscribe(cb),

    /** Toggle helpers exposed for the orbital badge panel. */
    toggleEnabled: () => toggleEnabled(),
    toggleShowStatus: () => stateStore.setShowStatus(!stateStore.getState().showStatus),
    toggleShowFrequency: () => stateStore.setShowFrequency(!stateStore.getState().showFrequency),

    /** Pick a dictionary term from current state (for "Open Dictionary" btn). */
    pickDictionaryTerm: () => pickDictionaryTerm(stateStore.getState()),

    applyStatusForTerm,
    getStatusForTerm,

    destroy: () => {
      document.removeEventListener('keydown', handleKeydown);
      unsubscribe();
      scheduler.stop();
      setActive(false);
      cancelPendingActivation?.();
      if (mutationTimer) clearTimeout(mutationTimer);
    },
  };
}
