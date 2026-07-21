import { findTextBlocks, findTextBlocksInNodes } from '@/features/tokenize/logic/tokenizeBlock';
import { TokenizeCache } from '@/features/tokenize/logic/tokenizeCache';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_BUFFER, PRIORITY_IDLE } from '@/features/tokenize/logic/tokenizeScheduler';
import { ViewportTracker } from '@/features/tokenize/logic/viewportTracker';
import { prepareTokenBlock, resolveTokenMetadata, getSentenceText } from '@/features/tokenize/logic/textTokenizer';
import { bindTokenBlock, unbindTokenBlock, type TokenSpanBindOptions } from '@/features/tokenize/ui/tokenSpanRenderer';
import { createTokenBadge } from '@/features/tokenize/ui/tokenBadge';
import type { TokenBadge } from '@/features/tokenize/ui/tokenBadge';
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
import type { TokenBlock, TokenizeController } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';
const CACHE_CAPACITY = 500; // enough for most article pages without eviction churn
const VIEWPORT_ROOT_MARGIN = '300px';
const MUTATION_DEBOUNCE_MS = 300;
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
}

export interface WebTokenizeController extends TokenizeController {
  /** Expose the live state for tests/inspectors. */
  readonly getState: () => TokenizeState;
  /** Expose the badge for tests. */
  readonly badge: TokenBadge;
  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle so token blocks rebind with the new
   *  status instead of reverting to the stale cached value on the next rebind. */
  readonly applyStatusForTerm: (term: string, status: WordStatus) => void;
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
      unbindTokenBlock(block);
      const idx = blocks.indexOf(block);
      if (idx >= 0) blocks.splice(idx, 1);
    },
  });

  const scheduler = new TokenizeScheduler();
  let viewport = createViewport();
  const visibleElements = new Set<Element>();

  // Batch metadata resolver: gather terms from all blocks that become visible in
  // the same microtask, then send a single message pair (status + frequency) to
  // the background. Per-block messages are the main bottleneck on pages like
  // Facebook with many visible paragraphs.
  let metadataQueue: TokenBlock[] = [];
  let metadataFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const metadataResolved = new WeakSet<TokenBlock>();
  const metadataPending = new WeakSet<TokenBlock>();

  function createViewport(): ViewportTracker {
    return new ViewportTracker({ rootMargin: VIEWPORT_ROOT_MARGIN });
  }

  async function flushMetadataQueue(): Promise<void> {
    metadataFlushTimer = null;
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
      // same scheduler tick are batched into one background request.
      metadataFlushTimer = setTimeout(() => void flushMetadataQueue(), 0);
    }
  }

  const badge = createTokenBadge({
    initialState: {
      enabled: stateStore.getState().enabled,
      showStatus: stateStore.getState().showStatus,
      showFrequency: stateStore.getState().showFrequency,
    },
    onToggleEnabled: () => toggleEnabled(),
    onToggleStatus: () => stateStore.setShowStatus(!stateStore.getState().showStatus),
    onToggleFrequency: () => stateStore.setShowFrequency(!stateStore.getState().showFrequency),
    onOpenDictionary: () => {
      const term = pickDictionaryTerm(stateStore.getState());
      if (term) options.onOpenDictionary?.(term, document.body, '');
    },
  });

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

  function observeBlock(block: TokenBlock): void {
    viewport.observe(block.element, {
      onEnter: () => {
        visibleElements.add(block.element);
        if (stateStore.getState().enabled) {
          scheduler.schedule(() => bindVisibleBlock(block), PRIORITY_VIEWPORT);
        }
      },
      onExit: () => {
        visibleElements.delete(block.element);
        scheduler.schedule(() => unbindTokenBlock(block), PRIORITY_BUFFER);
      },
    });
    // Eager bind: if the element is already in the viewport (e.g. it was just
    // created by a MutationObserver batch during scroll), don't wait for the
    // IntersectionObserver callback, which may not fire until the next frame.
    tryBindVisible(block);
  }

  function scanAndObserveBlocks(): void {
    const scanned = findTextBlocks(root, { langCode });
    for (const block of scanned) {
      cache.set(block);
      blocks.push(block);
      observeBlock(block);
    }
    for (const block of blocks.slice(0, CACHE_CAPACITY)) {
      scheduler.schedule(() => prepareBlock(block), PRIORITY_IDLE);
    }
  }

  function setActive(active: boolean): void {
    if (active === isActive) return;
    isActive = active;
    if (active) {
      viewport = createViewport();
      scanAndObserveBlocks();
      updateMutationObservation(true);
    } else {
      updateMutationObservation(false);
      viewport.destroy();
      visibleElements.clear();
      unbindAll();
      blocks.length = 0;
      pendingAddedNodes = [];
      if (mutationRafHandle !== null) {
        cancelAnimationFrame(mutationRafHandle);
        mutationRafHandle = null;
      }
      if (mutationTimer) {
        clearTimeout(mutationTimer);
        mutationTimer = null;
      }
      mutationWindowStart = 0;
    }
  }

  const unsubscribe = stateStore.subscribe((state) => {
    badge.setState({
      enabled: state.enabled,
      showStatus: state.showStatus,
      showFrequency: state.showFrequency,
    });
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
  let mutationRafHandle: number | null = null;
  // First-pending timestamp: when the current debounce window opened. Used to
  // enforce MAX_MUTATION_SCAN_DELAY_MS — without it, continuous mutations
  // (Facebook re-renders, polling) reset the trailing debounce forever and the
  // re-scan never fires, leaving dynamically added/replaced content untokenized.
  let mutationWindowStart = 0;
  let dynIdCounter = 0;
  // Accumulate added nodes across multiple rapid MutationObserver callbacks so
  // the debounced re-scan does not lose nodes that arrived between resets.
  let pendingAddedNodes: Node[] = [];

  function processAddedNodes(added: readonly Node[]): void {
    if (!stateStore.getState().enabled) return;
    if (added.length === 0) return;
    const scanId = dynIdCounter;
    dynIdCounter += 1000; // reserve a range for this scan
    const newBlocks = findTextBlocksInNodes(added, { langCode, idPrefix: `dyn-${scanId}-` });
    for (const block of newBlocks) {
      // Skip if source node is already bound by another block
      const existing = cache.getByElement(block.element);
      if (existing.some((b) => b.sourceNodes[0] === block.sourceNodes[0])) continue;
      cache.set(block);
      blocks.push(block);
      observeBlock(block);
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

  function processPendingAddedNodes(): void {
    mutationRafHandle = null;
    if (!stateStore.getState().enabled) {
      pendingAddedNodes = [];
      return;
    }
    const added = pendingAddedNodes;
    pendingAddedNodes = [];
    processAddedNodes(added);
  }

  mutationObserver = new MutationObserver((mutations) => {
    const now = Date.now();
    for (const m of mutations) {
      if (m.type === 'characterData' && m.target instanceof Text) {
        handleCharacterDataMutation(m.target);
        continue;
      }
      for (const n of m.addedNodes) {
        pendingAddedNodes.push(n);
      }
    }
    if (pendingAddedNodes.length === 0) return;
    if (!mutationWindowStart) mutationWindowStart = now;
    // Fast path: schedule a scan on the next animation frame so new content
    // starts tokenizing immediately instead of waiting for the trailing debounce.
    if (mutationRafHandle === null) {
      mutationRafHandle = requestAnimationFrame(processPendingAddedNodes);
    }
    // Fallback: if rAF is throttled (background tab, very slow device), still
    // process after the debounce/max-delay cap so we never starve.
    if (mutationTimer) clearTimeout(mutationTimer);
    const remaining = MAX_MUTATION_SCAN_DELAY_MS - (now - mutationWindowStart);
    const delay = Math.min(MUTATION_DEBOUNCE_MS, Math.max(0, remaining));
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      mutationWindowStart = 0;
      if (mutationRafHandle !== null) {
        cancelAnimationFrame(mutationRafHandle);
        mutationRafHandle = null;
      }
      processPendingAddedNodes();
    }, delay);
  });

  // Activate only when tokenize is already enabled for this URL. By default the
  // controller starts inactive, so no heavy DOM scanning/observation happens
  // during page load and Rocket Loader / Angular hydration can finish safely.
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
    if (!stateStore.getState().enabled || !visibleElements.has(block.element)) return;
    if (!block.isBound) {
      bindTokenBlock(block, getDisplayOptions());
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
    const margin = 300;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }

  function tryBindVisible(block: TokenBlock): void {
    if (isElementInViewport(block.element)) {
      visibleElements.add(block.element);
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
    await Promise.all(terms.map((term) => setWordStatus(langCode, term, status).catch(() => { /* best-effort */ })));
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (terms.includes(token.term)) {
          token.status = status;
          changed = true;
        }
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
  }

  /** Apply a status change to all cached tokens matching `term` without persisting.
   *  Used by the popup dictionary status cycle (which already persists via its own
   *  WORD_STATUS_SET message) so token blocks rebind with the new status instead of
   *  reverting to the stale cached value on the next scroll/toggle rebind. */
  function applyStatusForTerm(term: string, status: WordStatus): void {
    for (const block of blocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (token.term === term) {
          token.status = status;
          changed = true;
        }
      }
      if (changed && visibleElements.has(block.element)) {
        rebindBlock(block);
      }
    }
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
    const terms = state.selectedTerms.size > 0 ? [...state.selectedTerms] : state.hoveredTerm ? [state.hoveredTerm] : [];
    if (terms.length === 0) return;
    e.preventDefault();
    void applyStatusToTerms(terms, status);
    if (state.selectedTerms.size > 0) stateStore.clearSelection();
  }

  document.addEventListener('keydown', handleKeydown);

  function unbindAll(): void {
    for (const block of blocks) {
      unbindTokenBlock(block);
    }
  }

  return {
    getState: () => stateStore.getState(),
    badge,

    enable: () => {
      if (!stateStore.getState().enabled) toggleEnabled();
    },

    disable: () => {
      if (stateStore.getState().enabled) toggleEnabled();
    },

    setShowStatus: (show) => stateStore.setShowStatus(show),
    setShowFrequency: (show) => stateStore.setShowFrequency(show),

    applyStatusForTerm,

    destroy: () => {
      document.removeEventListener('keydown', handleKeydown);
      unsubscribe();
      scheduler.stop();
      setActive(false);
      cancelPendingActivation?.();
      if (mutationTimer) clearTimeout(mutationTimer);
      badge.destroy();
    },
  };
}
