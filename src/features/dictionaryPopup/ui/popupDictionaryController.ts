// popupDictionaryController — spec §4.6.3 P0: wires the full flow
// subtitle token → lookup → popup → Quick Add.
//
// This is the orchestrator that ties together:
// 1. subtitleTokenWrap (Task 4.1) — wraps tokens, attaches trigger.
// 2. subtitleTriggerController (Task 2.4) — debounce + LOOKUP dispatch.
// 3. lookupOrchestrator (Task 2.3) — dispatches to language plugins.
// 4. popupShell (Task 4.2) — Shadow DOM + position + resize.
// 5. popupContent (Task 4.3) — header + definitions + footer.
// 6. popupToolbar (Task 4.4/4.5) — tab panels.
// 7. wordStatusStore (Task 3.1) — status cycle.
// 8. quickAddAssembler + quickAddHandler (Task 5.1/5.2) — Quick Add.
//
// The controller manages the lifecycle: enable/disable, lookup → render,
// status cycle, tab toggle, Quick Add.

import type { LookupResult, WordStatus, PopupTab, QuickAddResponse } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { TokenWrapState } from '../trigger/subtitleTokenWrap';
import type { PopupShell, PopupSize } from './popupShell';
import type { DefinitionSelection } from './popupContent';
import { PopupShell as PopupShellClass, clampPopupSize } from './popupShell';
import {
  renderPopupContent,
  initDefinitionSelection,
} from './popupContent';
import { renderToolbar, renderAudioPanel, renderImagePanel, renderTranslatePanel, renderLinksPanel } from './popupToolbar';
import { nextStatus } from '../services/wordStatusStore';
import { assembleQuickAddPayload } from '../services/quickAddAssembler';
import { executeQuickAdd } from '../services/quickAddHandler';
import { fillExternalDictLinks } from './popupToolbar';

/** Controller state — holds all runtime state for the popup dictionary. */
export interface PopupDictionaryState {
  readonly settings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
  /** Current lookup result (null when popup is closed). */
  currentResult: LookupResult | null;
  /** Current word status. */
  currentStatus: WordStatus;
  /** Definition selection checkboxes. */
  definitionSelection: DefinitionSelection;
  /** Audio selection checkboxes. */
  audioSelection: Map<string, boolean>;
  /** Image selection checkboxes. */
  imageSelection: Map<string, boolean>;
  /** Active tab (null = no panel open). */
  activeTab: PopupTab | null;
  /** Current translation text. */
  translation: string;
  /** Current context sentence. */
  contextSentence: string;
  /** Popup shell instance. */
  shell: PopupShell | null;
  /** Token wrap state (for trigger integration). */
  tokenWrapState: TokenWrapState | null;
}

/** Create initial controller state. */
export function createPopupDictionaryState(
  settings: DictionaryPopupSettings,
  cardCreatorSettings: CardCreatorSettings,
): PopupDictionaryState {
  return {
    settings,
    cardCreatorSettings,
    currentResult: null,
    currentStatus: 'unknown',
    definitionSelection: new Map(),
    audioSelection: new Map(),
    imageSelection: new Map(),
    activeTab: settings.defaultActiveTab ?? null,
    translation: '',
    contextSentence: '',
    shell: null,
    tokenWrapState: null,
  };
}

/** Show popup with a lookup result. */
export function showPopup(
  state: PopupDictionaryState,
  result: LookupResult,
  anchorX: number,
  anchorY: number,
  contextSentence: string,
): PopupDictionaryState {
  // Create shell if needed.
  let shell = state.shell;
  if (!shell) {
    const size = clampPopupSize(
      { width: state.settings.popupWidthPx, maxHeight: state.settings.popupMaxHeightPx },
      window.innerWidth,
      window.innerHeight,
    );
    shell = new PopupShellClass(
      size,
      () => hidePopup(state), // onDismiss
      (newSize: PopupSize) => onResizeEnd(state, newSize), // onResizeEnd
    );
    shell.mount();
  }

  // Position + show.
  shell.setPosition(anchorX, anchorY);
  shell.show();

  // Initialize state from result.
  const definitionSelection = initDefinitionSelection(result);
  const status = result.status;

  // Render content.
  const container = shell.getContainer();
  if (container) {
    renderPopupContent(container, result, status, definitionSelection, {
      onStatusCycle: () => cycleStatus(state),
      onDefinitionToggle: (id, selected) => toggleDefinition(state, id, selected),
      onQuickAdd: () => doQuickAdd(state),
    });

    // Render toolbar if there's an active tab.
    if (state.activeTab) {
      renderActiveTab(state, container);
    }
  }

  return {
    ...state,
    currentResult: result,
    currentStatus: status,
    definitionSelection,
    contextSentence,
    shell,
  };
}

/** Hide popup (dismiss). */
export function hidePopup(state: PopupDictionaryState): PopupDictionaryState {
  if (state.shell) {
    state.shell.hide();
  }
  return {
    ...state,
    currentResult: null,
    activeTab: null,
    translation: '',
  };
}

/** Destroy popup (full cleanup). */
export function destroyPopup(state: PopupDictionaryState): PopupDictionaryState {
  if (state.shell) {
    state.shell.destroy();
  }
  return {
    ...state,
    shell: null,
    currentResult: null,
    activeTab: null,
  };
}

/** Cycle word status: unknown → tracking → known → ignore → unknown. */
export function cycleStatus(state: PopupDictionaryState): PopupDictionaryState {
  if (!state.currentResult) return state;
  const newStatus = nextStatus(state.currentStatus);
  // Persist to word status store (async — fire and forget).
  void persistStatus(state.currentResult.term, state.currentResult.langCode, newStatus);
  // Re-render header + footer with new status.
  rerender(state);
  return { ...state, currentStatus: newStatus };
}

/** Toggle a definition checkbox. */
export function toggleDefinition(
  state: PopupDictionaryState,
  id: string,
  selected: boolean,
): PopupDictionaryState {
  const newSelection = new Map(state.definitionSelection);
  newSelection.set(id, selected);
  return { ...state, definitionSelection: newSelection };
}

/** Toggle a tab (open/close panel). */
export function toggleTab(state: PopupDictionaryState, tab: PopupTab): PopupDictionaryState {
  const newTab = state.activeTab === tab ? null : tab;
  if (state.shell?.getContainer()) {
    rerender(state, newTab);
  }
  return { ...state, activeTab: newTab };
}

/** Execute Quick Add. */
export async function doQuickAdd(state: PopupDictionaryState): Promise<QuickAddResponse> {
  if (!state.currentResult) {
    return { ok: false, error: 'No lookup result to Quick Add' };
  }

  const payload = assembleQuickAddPayload(
    state.currentResult,
    {
      definitions: state.definitionSelection,
      audios: state.audioSelection,
      images: state.imageSelection,
    },
    state.contextSentence,
    state.translation,
    state.currentStatus,
    state.cardCreatorSettings,
  );

  // ponytail: fieldMapping comes from Card Creator draft settings.
  // For MVP, use a default mapping. Real mapping comes from the Card Creator dialog.
  const fieldMapping: Record<string, string> = {
    Front: 'term',
    Back: 'definitions',
    Sentence: 'sentence',
    Translation: 'translation',
  };

  return executeQuickAdd(payload, state.cardCreatorSettings, fieldMapping);
}

// --- Internal helpers ---

function renderActiveTab(state: PopupDictionaryState, container: HTMLElement): void {
  if (!state.currentResult) return;
  // ponytail: audio/image items come from the lookup result's resource panels.
  // For MVP, we render empty panels — real data comes from FETCH_AUDIO/IMAGE messages.
  switch (state.activeTab) {
    case 'audio':
      renderAudioPanel(container, [], [], state.audioSelection, () => {}, () => {});
      break;
    case 'image':
      renderImagePanel(container, [], state.imageSelection, () => {});
      break;
    case 'translate':
      renderTranslatePanel(
        container,
        state.translation,
        state.contextSentence,
        state.settings.translateTargetLang,
        () => void requestTranslation(state),
      );
      break;
    case 'links': {
      // ponytail: external dict link templates come from settings.
      // For MVP, use a default set.
      const templates = [
        { id: 'cambridge', name: 'Cambridge', urlTemplate: 'https://dictionary.cambridge.org/dictionary/english/{term}', langCodes: ['en'] },
        { id: 'wiktionary', name: 'Wiktionary', urlTemplate: 'https://en.wiktionary.org/wiki/{term}', langCodes: [] },
      ];
      const links = fillExternalDictLinks(templates, state.currentResult.term, state.currentResult.langCode);
      renderLinksPanel(container, links);
      break;
    }
  }
}

function rerender(state: PopupDictionaryState, activeTab?: PopupTab | null): void {
  if (!state.shell?.getContainer() || !state.currentResult) return;
  const tab = activeTab ?? state.activeTab;
  const container = state.shell.getContainer()!;
  renderPopupContent(container, state.currentResult, state.currentStatus, state.definitionSelection, {
    onStatusCycle: () => cycleStatus(state),
    onDefinitionToggle: (id, selected) => toggleDefinition(state, id, selected),
    onQuickAdd: () => void doQuickAdd(state),
  });
  if (tab) {
    renderToolbar(container, tab, (t) => toggleTab(state, t));
    renderActiveTab({ ...state, activeTab: tab }, container);
  }
}

async function persistStatus(term: string, langCode: string, status: WordStatus): Promise<void> {
  // ponytail: wordStatusStore.put requires IndexedDB — delegate to background.
  // For MVP, send a message to the background script.
  try {
    const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
    await sendMessage({
      type: 'WORD_STATUS_SET',
      payload: { term, langCode, status },
    });
  } catch {
    // Best-effort — fail silently.
  }
}

async function requestTranslation(state: PopupDictionaryState): Promise<void> {
  if (!state.currentResult) return;
  // ponytail: translation requires a FETCH_TRANSLATE message to background.
  // For MVP, this is a placeholder — real implementation sends a message
  // and updates state.translation on response.
}

function onResizeEnd(_state: PopupDictionaryState, _size: PopupSize): void {
  // ponytail: persist sticky size to settings via background message.
  // For MVP, this is a placeholder.
}

/** Get the initial popup size from settings, clamped to viewport. */
export function getInitialPopupSize(settings: DictionaryPopupSettings): PopupSize {
  return clampPopupSize(
    { width: settings.popupWidthPx, maxHeight: settings.popupMaxHeightPx },
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080,
  );
}
