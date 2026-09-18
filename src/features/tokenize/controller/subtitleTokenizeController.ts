import type { SrtCue } from '@/entities/media';
import type { Token, TokenBlock, TokenizeController, TokenizeState } from '@/features/tokenize/types';
import type { WordStatus } from '@/entities/dictionary';
import { createTokenizeStateStore, type TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import { TokenizeScheduler } from '@/features/tokenize/logic/tokenizeScheduler';
import { bindTokenBlock, restyleTokenBlock, unbindTokenBlock, type TokenSpanBindOptions } from '@/features/tokenize/ui/tokenSpanRenderer';
import { setWordStatus } from '@/features/dictionary/services/wordStatusClient';
import {
  emitWordStatusChanged,
  onWordStatusChanged,
} from '@/features/dictionary/services/wordStatusEvents';
import { createVideoTokenMap, type VideoTokenMap } from '@/features/tokenize/logic/videoTokenMap';
import { createVideoTokenPreloader, type VideoTokenPreloader } from '@/features/tokenize/logic/videoTokenPreloader';
import { createStatusKeyControls, type PopupStatusTarget } from '@/features/tokenize/logic/statusKeyControls';

const DEFAULT_WINDOW = 1;

export interface SubtitleTokenizeController extends TokenizeController {
  /** Set the current cue lists. Resets cache and prepares the active window. */
  setCues(targetCues: readonly SrtCue[], nativeCues: readonly SrtCue[]): void;
  /** Render token spans for the active cue indices. Call after subtitle text is set. */
  render(activeTargetIndex: number, activeNativeIndex: number): void;
  /** Force rebind with current state (used after showStatus/showFrequency changes). */
  rebind(): void;
  handleStatusKey(key: string): boolean;
  /** Current tokenize state. */
  getState(): TokenizeState;
}

export interface SubtitleTokenizeControllerOptions {
  /** Language code for status/frequency lookups. */
  readonly langCode: string;
  /** Retrieve the current target and native line elements from the subtitle overlay.
   *  Each element must directly contain a Text node (e.g. a <span> with text content). */
  readonly getLineElements: () => { target: HTMLElement | null; native: HTMLElement | null };
  /** Additional open shadow roots holding token spans outside the overlay lines
   *  (e.g. the split-view subtitle panel). Merged into selection extraction so
   *  1-4 status keys work on selections inside those surfaces. */
  readonly getExtraShadowRoots?: () => readonly ShadowRoot[];
  /** Called when the user clicks a token to open the Popup Dictionary. */
  readonly onOpenDictionary: (term: string, element: HTMLElement, contextSentence: string) => void;
  /** Open popup's looked-up term — 1-4 status keys target it before selection/hover. */
  readonly getPopupStatusTarget?: () => PopupStatusTarget | null;
  /** Number of cues before/after the active cue to keep prepared. */
  readonly windowSize?: number;
}

/** Build a TokenBlock from the current text node of a cue line. */
function createBlock(element: Element, text: string, tokens: Token[] | undefined): TokenBlock | null {
  if (!tokens || tokens.length === 0) return null;
  const textNode = element.firstChild;
  if (!(textNode instanceof Text)) return null;
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
  const { langCode, getLineElements, getExtraShadowRoots, onOpenDictionary, windowSize = DEFAULT_WINDOW } = options;
  const scheduler = new TokenizeScheduler();
  const stateStore: TokenizeStateStore = createTokenizeStateStore({
    initialEnabled: false,
  });
  const videoTokenMap: VideoTokenMap = createVideoTokenMap(langCode);
  const preloader: VideoTokenPreloader = createVideoTokenPreloader({
    langCode,
    map: videoTokenMap,
    scheduler,
    bufferSize: windowSize,
  });
  let targetCues: readonly SrtCue[] = [];
  let lastTargetIndex = -1;
  let currentTargetBlock: TokenBlock | null = null;

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
      onTokenClick: (term, block, element) => onOpenDictionary(term, element, block.originalText),
      onTokenCtrlClick: (term) => stateStore.toggleSelectedTerm(term),
    };
  }

  const unsubscribeWordStatus = onWordStatusChanged(({ langCode: eventLangCode, term, status }) => {
    if (eventLangCode !== langCode) return;
    videoTokenMap.applyStatus(term, status);
  });

  const unsubscribeMapUpdate = videoTokenMap.onUpdate((cueIndex: number) => {
    if (cueIndex !== lastTargetIndex) return;
    const prepared = videoTokenMap.get(cueIndex);
    const bound = currentTargetBlock;
    if (prepared && bound?.isBound && bound.element === getLineElements().target) {
      bound.tokens = prepared.tokens as Token[];
      if (restyleTokenBlock(bound, getDisplayOptions())) return;
    }
    bindLine(
      () => getLineElements().target,
      cueIndex,
      () => lastTargetIndex === cueIndex,
    );
  });

  function unbindLineElement(element: Element | null, block: TokenBlock | null): void {
    if (element && block) {
      unbindTokenBlock(block);
    }
  }

  function forceUnbindStaleTokens(element: Element | null, text: string): void {
    if (!element) return;
    const rendered = Array.from(element.querySelectorAll('[data-cell-block-id]'));
    if (rendered.length === 0) return;
    for (const node of rendered) {
      node.remove();
    }
    element.appendChild(document.createTextNode(text));
  }

  function clearCurrentBlocks(): void {
    unbindLineElement(getLineElements().target, currentTargetBlock);
    currentTargetBlock = null;
  }

  function bindLine(
    getElement: () => Element | null,
    cueIndex: number,
    isActive: () => boolean,
  ): void {
    if (cueIndex < 0 || !stateStore.getState().enabled) return;
    const element = getElement();
    if (!element) return;
    const text = targetCues[cueIndex]?.text ?? '';
    const prepared = videoTokenMap.get(cueIndex);
    if (prepared) {
      unbindLineElement(element, currentTargetBlock);
      forceUnbindStaleTokens(element, text);
      const block = createBlock(element, text, prepared.tokens as Token[]);
      if (block) {
        bindTokenBlock(block, getDisplayOptions());
        currentTargetBlock = block;
      }
      return;
    }
    if (element.querySelector('[data-cell-block-id]')) return;
    if (!prepared) {
      // Not prepared yet; prepare inline so the viewport cue binds immediately.
      videoTokenMap.prepare(cueIndex, text);
      bindLine(getElement, cueIndex, isActive);
    }
  }

  function applyStatusToTerms(terms: readonly string[], status: WordStatus): void {
    if (terms.length === 0) return;

    void Promise.all(terms.map((term) => setWordStatus(langCode, term, status).catch(() => { /* best-effort */ })));

    for (const term of terms) {
      emitWordStatusChanged({ langCode, term, status });
    }
  }

  function getShadowRoots(): ShadowRoot[] {
    const { target, native } = getLineElements();
    const roots = new Set<ShadowRoot>(getExtraShadowRoots?.() ?? []);
    for (const el of [target, native]) {
      const root = el?.getRootNode();
      if (root instanceof ShadowRoot) roots.add(root);
    }
    return [...roots];
  }

  const statusKeyControls = createStatusKeyControls({
    stateStore,
    getShadowRoots,
    applyStatusToTerms,
    getPopupTarget: options.getPopupStatusTarget,
  });

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

    setCues(nextTargetCues, _nextNativeCues) {
      targetCues = nextTargetCues;
      preloader.setCues(targetCues);
      clearCurrentBlocks();
      lastTargetIndex = -1;
    },

    rebind() {
      this.render(lastTargetIndex, -1);
    },

    handleStatusKey: statusKeyControls.handleStatusKey,

    render(activeTargetIndex, _activeNativeIndex) {
      const { target } = getLineElements();
      const targetText = targetCues[activeTargetIndex]?.text ?? '';
      const bound = currentTargetBlock;
      lastTargetIndex = activeTargetIndex;
      if (!stateStore.getState().enabled) return;

      if (
        bound &&
        bound.isBound &&
        bound.element === target &&
        bound.originalText === targetText &&
        restyleTokenBlock(bound, getDisplayOptions())
      ) {
        preloader.setActiveIndex(activeTargetIndex);
        return;
      }

      unbindLineElement(target, bound);
      forceUnbindStaleTokens(target, targetText);
      bindLine(
        () => getLineElements().target,
        activeTargetIndex,
        () => lastTargetIndex === activeTargetIndex,
      );
      preloader.setActiveIndex(activeTargetIndex);
    },

    getState() {
      const s = stateStore.getState();
      return { ...s, hoveredTerm: s.hoveredTerm ?? undefined };
    },

    destroy() {
      statusKeyControls.destroy();
      unsubscribeWordStatus();
      unsubscribeMapUpdate();
      preloader.destroy();
      scheduler.stop();
      clearCurrentBlocks();
      videoTokenMap.clear();
    },
  };
}
