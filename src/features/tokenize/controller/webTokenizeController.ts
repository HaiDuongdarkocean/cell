import { findTextBlocks } from '@/features/tokenize/logic/tokenizeBlock';
import { TokenizeCache } from '@/features/tokenize/logic/tokenizeCache';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_BUFFER, PRIORITY_IDLE } from '@/features/tokenize/logic/tokenizeScheduler';
import { ViewportTracker } from '@/features/tokenize/logic/viewportTracker';
import { tokenizeTextBlock, resolveTokenMetadata, getSentenceText } from '@/features/tokenize/logic/textTokenizer';
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
const VIEWPORT_ROOT_MARGIN = '150px';
const MUTATION_DEBOUNCE_MS = 300;
const HYDRATION_QUIET_MS = 500;

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
    onEvict: (block) => unbindTokenBlock(block),
  });

  const scheduler = new TokenizeScheduler();
  let viewport = createViewport();
  const visibleElements = new Set<Element>();

  function createViewport(): ViewportTracker {
    return new ViewportTracker({ rootMargin: VIEWPORT_ROOT_MARGIN });
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
      mutationObserver.observe(root, { childList: true, subtree: true });
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
          scheduler.schedule(() => prepareAndBind(block), PRIORITY_VIEWPORT);
        }
      },
      onExit: () => {
        visibleElements.delete(block.element);
        scheduler.schedule(() => unbindTokenBlock(block), PRIORITY_BUFFER);
      },
    });
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
      scheduleVisible();
    } else {
      updateMutationObservation(false);
      viewport.destroy();
      visibleElements.clear();
      unbindAll();
      blocks.length = 0;
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
  let dynIdCounter = 0;
  mutationObserver = new MutationObserver(() => {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      if (!stateStore.getState().enabled) return;
      // Re-scan root for text blocks. findTextBlocks walks all text nodes,
      // but we filter to only new ones (not already bound).
      const scanId = dynIdCounter;
      dynIdCounter += 1000; // reserve a range for this scan
      const newBlocks = findTextBlocks(root, { langCode, idPrefix: `dyn-${scanId}-` });
      for (const block of newBlocks) {
        // Skip if inside a token span (our own injected content)
        if (block.element.closest('.js-cell-token')) continue;
        // Skip if source node is already bound by another block
        const existing = cache.getByElement(block.element);
        if (existing.some((b) => b.sourceNodes[0] === block.sourceNodes[0])) continue;
        cache.set(block);
        blocks.push(block);
        observeBlock(block);
        // If element is already visible, schedule immediately
        if (visibleElements.has(block.element)) {
          scheduler.schedule(() => prepareAndBind(block), PRIORITY_VIEWPORT);
        }
      }
    }, MUTATION_DEBOUNCE_MS);
  });

  // Activate only when tokenize is already enabled for this URL. By default the
  // controller starts inactive, so no heavy DOM scanning/observation happens
  // during page load and Rocket Loader / Angular hydration can finish safely.
  if (initialEnabled) {
    const activateAfterStability = (): void => {
      let stabilityTimer: ReturnType<typeof setTimeout> | null = null;
      const stabilityObserver = new MutationObserver(() => scheduleStabilityCheck());
      const cleanup = (): void => {
        stabilityObserver.disconnect();
        if (stabilityTimer) clearTimeout(stabilityTimer);
      };
      const scheduleStabilityCheck = (): void => {
        if (stabilityTimer) clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(() => {
          cleanup();
          cancelPendingActivation = null;
          if (stateStore.getState().enabled) setActive(true);
        }, HYDRATION_QUIET_MS);
      };
      stabilityObserver.observe(document.documentElement, { childList: true, subtree: true });
      scheduleStabilityCheck();
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

  async function prepareBlock(block: TokenBlock): Promise<void> {
    if (block.tokens) return;
    const tokens = tokenizeTextBlock(block.originalText, langCode);
    const terms = [...new Set(tokens.filter((t) => !t.isSeparator).map((t) => t.term))];
    if (terms.length > 0) {
      const [statusMap, freqMaps] = await Promise.all([
        getWordStatuses(langCode, terms),
        getFrequencyEntries(langCode, terms),
      ]);
      await resolveTokenMetadata(
        tokens,
        (term) => Promise.resolve(statusMap.get(term) ?? 'unknown'),
        (term) => Promise.resolve(entriesToBand(freqMaps.get(term) ?? [])),
      );
    }
    block.tokens = tokens;
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

  async function prepareAndBind(block: TokenBlock): Promise<void> {
    await prepareBlock(block);
    if (stateStore.getState().enabled && visibleElements.has(block.element)) {
      // rebind (not bind): unbind is a no-op on first bind, but is required when
      // a layer toggle (showStatus/showFrequency) fires scheduleVisible() for an
      // already-bound block — plain bindTokenBlock would no-op on isBound=true
      // and the new display options would never apply.
      rebindBlock(block);
    }
  }

  function scheduleVisible(): void {
    for (const element of visibleElements) {
      const elementBlocks = cache.getByElement(element);
      for (const block of elementBlocks) {
        scheduler.schedule(() => prepareAndBind(block), PRIORITY_VIEWPORT);
      }
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
