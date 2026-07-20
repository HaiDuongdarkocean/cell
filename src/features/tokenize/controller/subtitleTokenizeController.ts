import type { SrtCue } from '@/entities/media';
import type { Token, TokenBlock, TokenizeController, TokenizeState } from '@/features/tokenize/types';
import type { WordStatus } from '@/features/dictionaryPopup/types';
import { createTokenizeStateStore, type TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_IDLE } from '@/features/tokenize/logic/tokenizeScheduler';
import { tokenizeTextBlock, resolveTokenMetadata } from '@/features/tokenize/logic/textTokenizer';
import { bindTokenBlock, unbindTokenBlock, type TokenSpanBindOptions } from '@/features/tokenize/ui/tokenSpanRenderer';
import { getWordStatuses, setWordStatus } from '@/features/dictionaryPopup/services/wordStatusClient';
import { getFrequencyEntries } from '@/features/dictionaryPopup/services/frequencyClient';
import { entriesToBand } from '@/features/tokenize/utils/frequencyBand';

const DEFAULT_WINDOW = 1;

const STATUS_BY_KEY: Readonly<Record<string, WordStatus>> = {
  '1': 'unknown',
  '2': 'tracking',
  '3': 'known',
  '4': 'ignore',
};

interface PreparedCue {
  text: string;
  tokens?: Token[];
}

export interface SubtitleTokenizeController extends TokenizeController {
  /** Set the current cue lists. Resets cache and prepares the active window. */
  setCues(targetCues: readonly SrtCue[], nativeCues: readonly SrtCue[]): void;
  /** Render token spans for the active cue indices. Call after subtitle text is set. */
  render(activeTargetIndex: number, activeNativeIndex: number): void;
  /** Force rebind with current state (used after showStatus/showFrequency changes). */
  rebind(): void;
  /** Current tokenize state. */
  getState(): TokenizeState;
}

export interface SubtitleTokenizeControllerOptions {
  /** Language code for status/frequency lookups. */
  readonly langCode: string;
  /** Retrieve the current target and native line elements from the subtitle overlay. */
  readonly getLineElements: () => { target: HTMLDivElement | null; native: HTMLDivElement | null };
  /** Called when the user clicks a token to open the Popup Dictionary. */
  readonly onOpenDictionary: (term: string, element: HTMLElement, contextSentence: string) => void;
  /** Number of cues before/after the active cue to keep prepared. */
  readonly windowSize?: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.getAttribute('contenteditable') === 'true' || target.isContentEditable === true;
}

/** Build a TokenBlock from the current text node of a cue line. */
function createBlock(element: Element, text: string, tokens: Token[] | undefined): TokenBlock | null {
  if (!tokens || tokens.length === 0) return null;
  const textNode = element.firstChild as Text | null;
  if (!textNode) return null;
  return {
    id: `sub-${Math.random().toString(36).slice(2, 9)}`,
    element,
    sourceNodes: [textNode],
    originalText: text,
    tokens,
    isBound: false,
    lastAccessedAt: Date.now(),
  };
}

export function createSubtitleTokenizeController(
  options: SubtitleTokenizeControllerOptions,
): SubtitleTokenizeController {
  const { langCode, getLineElements, onOpenDictionary, windowSize = DEFAULT_WINDOW } = options;
  const scheduler = new TokenizeScheduler();
  const stateStore: TokenizeStateStore = createTokenizeStateStore({ initialEnabled: false });
  const targetCache = new Map<number, PreparedCue>();
  const nativeCache = new Map<number, PreparedCue>();
  let targetCues: readonly SrtCue[] = [];
  let nativeCues: readonly SrtCue[] = [];
  let lastTargetIndex = -1;
  let lastNativeIndex = -1;
  let currentTargetBlock: TokenBlock | null = null;
  let currentNativeBlock: TokenBlock | null = null;

  function getDisplayOptions(): TokenSpanBindOptions {
    return {
      showStatus: stateStore.getState().showStatus,
      showFrequency: stateStore.getState().showFrequency,
      onTokenEnter: (term) => stateStore.setHoveredTerm(term),
      onTokenLeave: (term) => {
        if (stateStore.getState().hoveredTerm === term) {
          stateStore.setHoveredTerm(null);
        }
      },
      onTokenClick: (term, block, element) => onOpenDictionary(term, element, block.originalText),
      onTokenCtrlClick: (term) => stateStore.toggleSelectedTerm(term),
    };
  }

  async function prepareCue(
    cache: Map<number, PreparedCue>,
    cues: readonly SrtCue[],
    index: number,
  ): Promise<void> {
    if (index < 0 || index >= cues.length) return;
    const existing = cache.get(index);
    if (existing?.tokens) return;
    const text = cues[index]?.text ?? '';
    if (!text.trim()) {
      cache.set(index, { text, tokens: [] });
      return;
    }
    const tokens = tokenizeTextBlock(text, langCode);
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
    cache.set(index, { text, tokens });
  }

  function unbindLineElement(element: Element | null, block: TokenBlock | null): void {
    if (element && block) {
      unbindTokenBlock(block);
    }
  }

  function clearCurrentBlocks(): void {
    unbindLineElement(getLineElements().target, currentTargetBlock);
    unbindLineElement(getLineElements().native, currentNativeBlock);
    currentTargetBlock = null;
    currentNativeBlock = null;
  }

  function bindLine(
    element: Element | null,
    text: string,
    cueIndex: number,
    cache: Map<number, PreparedCue>,
    cues: readonly SrtCue[],
    isActive: () => boolean,
    setCurrent: (block: TokenBlock | null) => void,
  ): void {
    if (!element || cueIndex < 0 || !stateStore.getState().enabled) {
      setCurrent(null);
      return;
    }
    const prepared = cache.get(cueIndex);
    const block = createBlock(element, text, prepared?.tokens);
    if (block) {
      bindTokenBlock(block, getDisplayOptions());
      setCurrent(block);
      return;
    }
    setCurrent(null);
    if (!prepared) {
      // Not prepared yet; schedule and bind when ready.
      scheduler.schedule(async () => {
        await prepareCue(cache, cues, cueIndex);
        if (stateStore.getState().enabled && isActive()) {
          bindLine(element, text, cueIndex, cache, cues, isActive, setCurrent);
        }
      }, PRIORITY_VIEWPORT);
    }
  }

  function prepareWindow(cache: Map<number, PreparedCue>, cues: readonly SrtCue[], active: number): void {
    const start = Math.max(0, active - windowSize);
    const end = Math.min(cues.length - 1, active + windowSize);
    for (let i = start; i <= end; i++) {
      scheduler.schedule(() => prepareCue(cache, cues, i), PRIORITY_IDLE);
    }
    // Evict cues outside the window to bound memory.
    for (const key of cache.keys()) {
      if (key < start || key > end) {
        cache.delete(key);
      }
    }
  }

  function applyStatusToTerms(terms: readonly string[], status: WordStatus): void {
    const allBlocks: TokenBlock[] = [];
    if (currentTargetBlock) allBlocks.push(currentTargetBlock);
    if (currentNativeBlock) allBlocks.push(currentNativeBlock);
    if (allBlocks.length === 0 || terms.length === 0) return;

    void Promise.all(terms.map((term) => setWordStatus(langCode, term, status).catch(() => { /* best-effort */ })));

    for (const block of allBlocks) {
      if (!block.tokens) continue;
      let changed = false;
      for (const token of block.tokens) {
        if (terms.includes(token.term)) {
          token.status = status;
          changed = true;
        }
      }
      if (changed) {
        unbindTokenBlock(block);
        bindTokenBlock(block, getDisplayOptions());
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
    applyStatusToTerms(terms, status);
    if (state.selectedTerms.size > 0) stateStore.clearSelection();
  }

  document.addEventListener('keydown', handleKeydown);

  return {
    enable() {
      if (stateStore.getState().enabled) return;
      stateStore.setEnabled(true);
    },

    disable() {
      if (!stateStore.getState().enabled) return;
      stateStore.setEnabled(false);
      clearCurrentBlocks();
    },

    setShowStatus(show) {
      stateStore.setShowStatus(show);
      this.rebind();
    },

    setShowFrequency(show) {
      stateStore.setShowFrequency(show);
      this.rebind();
    },

    setCues(nextTargetCues, nextNativeCues) {
      targetCues = nextTargetCues;
      nativeCues = nextNativeCues;
      targetCache.clear();
      nativeCache.clear();
      clearCurrentBlocks();
      lastTargetIndex = -1;
      lastNativeIndex = -1;
    },

    rebind() {
      this.render(lastTargetIndex, lastNativeIndex);
    },

    render(activeTargetIndex, activeNativeIndex) {
      lastTargetIndex = activeTargetIndex;
      lastNativeIndex = activeNativeIndex;
      const { target, native } = getLineElements();
      if (!stateStore.getState().enabled) return;

      const targetText = targetCues[activeTargetIndex]?.text ?? '';
      const nativeText = nativeCues[activeNativeIndex]?.text ?? '';

      unbindLineElement(target, currentTargetBlock);
      bindLine(
        target,
        targetText,
        activeTargetIndex,
        targetCache,
        targetCues,
        () => lastTargetIndex === activeTargetIndex,
        (block) => { currentTargetBlock = block; },
      );
      prepareWindow(targetCache, targetCues, activeTargetIndex);

      unbindLineElement(native, currentNativeBlock);
      bindLine(
        native,
        nativeText,
        activeNativeIndex,
        nativeCache,
        nativeCues,
        () => lastNativeIndex === activeNativeIndex,
        (block) => { currentNativeBlock = block; },
      );
      prepareWindow(nativeCache, nativeCues, activeNativeIndex);
    },

    getState() {
      const s = stateStore.getState();
      return { ...s, hoveredTerm: s.hoveredTerm ?? undefined };
    },

    destroy() {
      document.removeEventListener('keydown', handleKeydown);
      scheduler.stop();
      clearCurrentBlocks();
      targetCache.clear();
      nativeCache.clear();
    },
  };
}
