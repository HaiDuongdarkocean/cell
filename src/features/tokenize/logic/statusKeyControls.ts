import type { WordStatus } from '@/entities/dictionary';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import { extractTermsFromSelection } from '@/features/tokenize/utils/selectionTerms';
import { createSelectionAnnouncer } from '@/features/tokenize/logic/selectionAnnouncer';
import { isEditableEvent } from '@/shared/lib/dom/isEditable';

const STATUS_BY_KEY: Readonly<Record<string, WordStatus>> = {
  '1': 'unknown',
  '2': 'tracking',
  '3': 'known',
  '4': 'ignore',
  '5': 'learning',
};

/** The word an open dictionary popup is currently showing — 1-4 keys apply to
 *  it (and its own persist/render path) while the popup is up. */
export interface PopupStatusTarget {
  readonly term: string;
  readonly langCode: string;
  readonly apply: (status: WordStatus) => void;
}

export interface StatusKeyControlsOptions {
  readonly stateStore: TokenizeStateStore;
  readonly getShadowRoots: () => ShadowRoot[];
  readonly applyStatusToTerms: (terms: readonly string[], status: WordStatus) => void;
  /** Open popup's looked-up term, when a result is displayed. Takes priority
   *  over selection/hover because the popup is the user's current context. */
  readonly getPopupTarget?: () => PopupStatusTarget | null;
}

export interface StatusKeyControls {
  readonly handleStatusKey: (key: string) => boolean;
  readonly destroy: () => void;
}

export function createStatusKeyControls(options: StatusKeyControlsOptions): StatusKeyControls {
  const { stateStore, getShadowRoots, applyStatusToTerms, getPopupTarget } = options;

  function applyStatusKey(key: string): boolean {
    const status = STATUS_BY_KEY[key];
    if (!status) return false;
    const popupTarget = getPopupTarget?.();
    if (popupTarget) {
      popupTarget.apply(status);
      return true;
    }
    const state = stateStore.getState();
    let terms = state.selectedTerms.size > 0 ? [...state.selectedTerms] : [];
    let usedNativeSelection = false;
    if (terms.length === 0) {
      terms = extractTermsFromSelection(window.getSelection(), getShadowRoots());
      usedNativeSelection = terms.length > 0;
    }
    if (terms.length === 0 && state.hoveredTerm) {
      terms = [state.hoveredTerm];
    }
    if (terms.length === 0) return false;
    applyStatusToTerms(terms, status);
    if (state.selectedTerms.size > 0) stateStore.clearSelection();
    if (usedNativeSelection) window.getSelection()?.removeAllRanges();
    return true;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (isEditableEvent(e)) return;
    if (e.key === 'Escape') {
      stateStore.clearSelection();
      stateStore.setHoveredTerm(null);
      return;
    }
    if (!applyStatusKey(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  window.addEventListener('keydown', handleKeydown, true);
  const unsubscribeAnnouncer = createSelectionAnnouncer(stateStore);

  return {
    handleStatusKey: applyStatusKey,
    destroy: () => {
      window.removeEventListener('keydown', handleKeydown, true);
      unsubscribeAnnouncer();
    },
  };
}
