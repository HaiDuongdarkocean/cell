import type { WordStatus } from '@/entities/dictionary';
import type { TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';
import { extractTermsFromSelection } from '@/features/tokenize/utils/selectionTerms';
import { createSelectionAnnouncer } from '@/features/tokenize/logic/selectionAnnouncer';
import { isEditableEvent } from '@/shared/lib/dom/isEditable';

const STATUS_BY_KEY: Readonly<Record<string, WordStatus>> = {
  '1': 'unknown',
  '2': 'known',
  '3': 'ignore',
};

const TRACKING_TOGGLE_KEY = '4';

/** The word an open dictionary popup is currently showing — status keys apply
 *  to it (and its own persist/render path) while the popup is up. */
export interface PopupStatusTarget {
  readonly term: string;
  readonly langCode: string;
  readonly apply: (status: WordStatus) => void;
  /** Key-4 tracking toggle routed through the popup's own path. When absent,
   *  key 4 falls back to the selection/hover terms path. */
  readonly toggleTracking?: () => void;
}

export interface StatusKeyControlsOptions {
  readonly stateStore: TokenizeStateStore;
  readonly getShadowRoots: () => ShadowRoot[];
  readonly applyStatusToTerms: (terms: readonly string[], status: WordStatus) => void;
  readonly toggleTrackingToTerms: (terms: readonly string[]) => void;
  /** Open popup's looked-up term, when a result is displayed. Takes priority
   *  over selection/hover because the popup is the user's current context. */
  readonly getPopupTarget?: () => PopupStatusTarget | null;
}

export interface StatusKeyControls {
  readonly handleStatusKey: (key: string) => boolean;
  readonly destroy: () => void;
}

export function createStatusKeyControls(options: StatusKeyControlsOptions): StatusKeyControls {
  const { stateStore, getShadowRoots, applyStatusToTerms, toggleTrackingToTerms, getPopupTarget } = options;

  function applyToResolvedTerms(apply: (terms: string[]) => void): boolean {
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
    apply(terms);
    if (state.selectedTerms.size > 0) stateStore.clearSelection();
    if (usedNativeSelection) window.getSelection()?.removeAllRanges();
    return true;
  }

  function applyStatusKey(key: string): boolean {
    const popupTarget = getPopupTarget?.();
    if (key === TRACKING_TOGGLE_KEY) {
      if (popupTarget?.toggleTracking) {
        popupTarget.toggleTracking();
        return true;
      }
      return applyToResolvedTerms(toggleTrackingToTerms);
    }
    const status = STATUS_BY_KEY[key];
    if (!status) return false;
    if (popupTarget) {
      popupTarget.apply(status);
      return true;
    }
    return applyToResolvedTerms((terms) => applyStatusToTerms(terms, status));
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (isEditableEvent(e)) return;
    if (e.key === 'Escape') {
      const state = stateStore.getState();
      if (state.selectedTerms.size === 0 && !state.hoveredTerm) return;
      e.preventDefault();
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
