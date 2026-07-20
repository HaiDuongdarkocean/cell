import { findTextBlocks } from '@/features/tokenize/logic/tokenizeBlock';
import { TokenizeCache } from '@/features/tokenize/logic/tokenizeCache';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_BUFFER, PRIORITY_IDLE } from '@/features/tokenize/logic/tokenizeScheduler';
import { ViewportTracker } from '@/features/tokenize/logic/viewportTracker';
import { tokenizeTextBlock, resolveTokenMetadata } from '@/features/tokenize/logic/textTokenizer';
import { bindTokenBlock, unbindTokenBlock } from '@/features/tokenize/ui/tokenSpanRenderer';
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
import { findFrequencyByTerms } from '@/features/dictionary/repositories/frequencyRepository';
import { getWordStatuses } from '@/features/dictionaryPopup/services/wordStatusStore';
import { entriesToBand } from '@/features/tokenize/utils/frequencyBand';
import type { TokenBlock, TokenizeController } from '@/features/tokenize/types';

const DEFAULT_LANG = 'en';
const CACHE_CAPACITY = 50; // ~50 blocks ≈ a few MB on 1GB RAM devices
const VIEWPORT_ROOT_MARGIN = '150px';

export interface WebTokenizeControllerOptions {
  /** Current page URL used for per-URL enable state. */
  readonly url: string;
  /** Root element to scan for text blocks. Defaults to document.body. */
  readonly root?: Element;
  /** Language code for lookups. */
  readonly langCode?: string;
  /** Callback when the user asks to open the Popup Dictionary. */
  readonly onOpenDictionary?: (term: string) => void;
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
  const root = options.root ?? document.body;

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
  const viewport = new ViewportTracker({ rootMargin: VIEWPORT_ROOT_MARGIN });
  const visibleElements = new Set<Element>();

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
      if (term) options.onOpenDictionary?.(term);
    },
  });

  const unsubscribe = stateStore.subscribe((state) => {
    badge.setState({
      enabled: state.enabled,
      showStatus: state.showStatus,
      showFrequency: state.showFrequency,
    });
    if (state.enabled) {
      scheduleVisible();
    } else {
      unbindAll();
    }
  });

  const blocks = findTextBlocks(root, { langCode });
  for (const block of blocks) {
    cache.set(block);
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

  // If the page is already enabled, eagerly prepare visible/buffer blocks.
  if (initialEnabled) {
    for (const block of blocks.slice(0, CACHE_CAPACITY)) {
      scheduler.schedule(() => prepareBlock(block), PRIORITY_IDLE);
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
        findFrequencyByTerms(langCode, terms),
      ]);
      await resolveTokenMetadata(
        tokens,
        (term) => Promise.resolve(statusMap.get(term) ?? 'unknown'),
        (term) => Promise.resolve(entriesToBand(freqMaps.get(term) ?? [])),
      );
    }
    block.tokens = tokens;
  }

  async function prepareAndBind(block: TokenBlock): Promise<void> {
    await prepareBlock(block);
    if (stateStore.getState().enabled && visibleElements.has(block.element)) {
      bindTokenBlock(block, {
        showStatus: stateStore.getState().showStatus,
        showFrequency: stateStore.getState().showFrequency,
      });
    }
  }

  function scheduleVisible(): void {
    for (const element of visibleElements) {
      const block = cache.getByElement(element);
      if (block) {
        scheduler.schedule(() => prepareAndBind(block), PRIORITY_VIEWPORT);
      }
    }
  }

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
      unsubscribe();
      scheduler.stop();
      viewport.destroy();
      unbindAll();
      badge.destroy();
    },
  };
}
