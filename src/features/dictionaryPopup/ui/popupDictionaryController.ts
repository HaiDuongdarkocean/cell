// popupDictionaryController — spec §4.6.3 P0: wires the full flow
// subtitle token → lookup → popup → Quick Add / Send to Card.
//
// This is the orchestrator that ties together:
// 1. subtitleTokenWrap (Task 4.1) — wraps tokens, attaches trigger.
// 2. subtitleTriggerController (Task 2.4) — debounce + LOOKUP dispatch.
// 3. lookupOrchestrator (Task 2.3) — dispatches to language plugins.
// 4. popupShell (Task 4.2) — Shadow DOM + position + resize.
// 5. popupContent (Task 4.3) — header + definitions + footer.
// 6. popupToolbar (Task 4.4/4.5) — tab panels.
// 7. wordStatusStore (Task 3.1) — status cycle.
// 8. onCardCreatorAction — opens Card Creator dialog pre-filled (spec UC09.2).
//
// The controller manages the lifecycle: enable/disable, lookup → render,
// status cycle, tab toggle, Quick Add / Send to Card.

import type { MessageResponse } from '@/entities/message/types';
import type { LookupResult, WordStatus, PopupTab, AudioItem, ImageItem, FetchCommunityAudioResponse, FetchImagesResponse, TabPanelCache } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings, TtsVoiceRow } from '@/entities/settings/types';
import type { TokenWrapState } from '../trigger/subtitleTokenWrap';
import type { PopupShell, PopupSize } from './popupShell';
import type { DefinitionSelection, CandidateInfo, PopupContentCallbacks } from './popupContent';
import { PopupShell as PopupShellClass, clampPopupSize } from './popupShell';
import {
  renderPopupContent,
  renderActiveEntry,
  renderCandidateChips,
  getOrCreateCandidatesContainer,
  initDefinitionSelection,
  getSelectedDefinitions,
} from './popupContent';
import { renderToolbar, renderAudioPanel, renderImagePanel, renderTranslatePanel, renderLinksPanel } from './popupToolbar';
import type { SelectionCounts } from './popupToolbar';
import { nextStatus } from '../services/wordStatusStore';
import { fillExternalDictLinks } from './popupToolbar';
import { createTtsEngine, getTtsVoiceRows } from '../services/ttsEngineService';

/** Pre-fill data extracted from the popup dictionary for the Card Creator.
 *  Built from the lookup result + selections + context sentence + translation. */
export interface PopupCardCreatorPrefill {
  readonly term: string;
  readonly langCode: string;
  readonly reading: string;
  readonly definitions: readonly { readonly pos?: string; readonly text: string }[];
  readonly contextSentence: string;
  readonly translation?: string;
  readonly audioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
}

/** Card Creator action triggered by the popup's Quick Add / Send to Card buttons.
 *  'quick-add' = Quick Add button (hardcoded as Add mode for now),
 *  'edit-card' = Send to Card button (neutral — user picks Add/Update in dialog). */
export type PopupCardCreatorAction = 'quick-add' | 'edit-card';

/** Callback when the user clicks Quick Add or Send to Card in the popup.
 *  The content script controller opens the Card Creator dialog pre-filled. */
export type OnCardCreatorAction = (
  action: PopupCardCreatorAction,
  prefill: PopupCardCreatorPrefill,
) => void;

/** Per-candidate runtime state (for active candidate switching). */
export interface CandidateState {
  status: WordStatus;
  definitionSelection: DefinitionSelection;
  audioSelection: Map<string, boolean>;
  audioItems: AudioItem[];
  imageSelection: Map<string, boolean>;
  imageItems: ImageItem[];
  translation: string;
  translationSelected: boolean;
  translationLoading: boolean;
  activeTab: PopupTab | null;
}

/** Snapshot of the active candidate's mutable state.
 *  Used to read/write either winner fields (index 0) or a CandidateState (index > 0). */
interface ActiveCandidateSnapshot {
  result: LookupResult;
  status: WordStatus;
  definitionSelection: DefinitionSelection;
  audioSelection: Map<string, boolean>;
  audioItems: AudioItem[];
  imageSelection: Map<string, boolean>;
  imageItems: ImageItem[];
  translation: string;
  translationSelected: boolean;
  translationLoading: boolean;
  activeTab: PopupTab | null;
}

/** Controller state — holds all runtime state for the popup dictionary. */
export interface PopupDictionaryState {
  readonly settings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
  /** Callback to open the Card Creator dialog pre-filled (wired by content script). */
  onCardCreatorAction?: OnCardCreatorAction;
  /** Current lookup result — winner/first candidate (null when popup is closed). */
  currentResult: LookupResult | null;
  /** Additional candidates appended after winner. */
  additionalResults: LookupResult[];
  /** Index of the candidate currently shown in the active entry (0 = winner). */
  activeCandidateIndex: number;
  /** Per-candidate state for appended candidates (key = 1..n, 0 uses top-level winner fields). */
  candidateStates: Map<number, CandidateState>;
  /** Current word status (winner; appended candidates live in candidateStates). */
  currentStatus: WordStatus;
  /** Definition selection checkboxes (winner). */
  definitionSelection: DefinitionSelection;
  /** Audio selection checkboxes (winner). */
  audioSelection: Map<string, boolean>;
  /** Audio items fetched by the audio panel (winner). */
  audioItems: AudioItem[];
  /** Image selection checkboxes (winner). */
  imageSelection: Map<string, boolean>;
  /** Image items fetched by the image panel (winner). */
  imageItems: ImageItem[];
  /** Active tab (winner). */
  activeTab: PopupTab | null;
  /** Current translation text (winner). */
  translation: string;
  /** Whether translation is selected for Quick Add (winner). */
  translationSelected: boolean;
  /** Whether translation is currently loading (winner). */
  translationLoading: boolean;
  /** Current context sentence. */
  contextSentence: string;
  /** Popup shell instance. */
  shell: PopupShell | null;
  /** Token wrap state (for trigger integration). */
  tokenWrapState: TokenWrapState | null;
  /** Last cached result term — used to decide whether tab panel data can be reused. */
  cachedResultTerm: string;
  /** Last cached context sentence — used together with cachedResultTerm. */
  cachedContextSentence: string;
  /** Per-term cache for tab panel data (audio/image/translation). Cleared when the page closes. */
  tabPanelCache: Map<string, TabPanelCache>;
}

/** Create an empty TabPanelCache entry. */
function createEmptyTabPanelCache(): TabPanelCache {
  return {
    audioItems: [],
    audioSelection: new Map(),
    imageItems: [],
    imageSelection: new Map(),
    translations: new Map(),
  };
}

/** Create initial per-candidate state. */
export function createCandidateState(result: LookupResult): CandidateState {
  return {
    status: result.status,
    definitionSelection: initDefinitionSelection(result),
    audioSelection: new Map(),
    audioItems: [],
    imageSelection: new Map(),
    imageItems: [],
    translation: '',
    translationSelected: false,
    translationLoading: false,
    activeTab: null,
  };
}

/** Create initial controller state. */
export function createPopupDictionaryState(
  settings: DictionaryPopupSettings,
  cardCreatorSettings: CardCreatorSettings,
  onCardCreatorAction?: OnCardCreatorAction,
): PopupDictionaryState {
  return {
    settings,
    cardCreatorSettings,
    onCardCreatorAction,
    currentResult: null,
    additionalResults: [],
    activeCandidateIndex: 0,
    candidateStates: new Map(),
    currentStatus: 'unknown',
    definitionSelection: new Map(),
    audioSelection: new Map(),
    audioItems: [],
    imageSelection: new Map(),
    imageItems: [],
    activeTab: settings.defaultActiveTab ?? null,
    translation: '',
    translationSelected: false,
    translationLoading: false,
    contextSentence: '',
    shell: null,
    tokenWrapState: null,
    cachedResultTerm: '',
    cachedContextSentence: '',
    tabPanelCache: new Map(),
  };
}

/** Show popup with a lookup result. */
export function showPopup(
  state: PopupDictionaryState,
  result: LookupResult,
  anchorTop: number,
  anchorLeft: number,
  anchorRight: number,
  anchorBottom: number,
  contextSentence: string,
  onDismiss?: (newState: PopupDictionaryState) => void,
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
      () => { state = hidePopup(state); onDismiss?.(state); }, // onDismiss
      (newSize: PopupSize) => onResizeEnd(state, newSize), // onResizeEnd
    );
    shell.mount();
  }
  // Reassign state so all closures below (and the onDismiss/onResizeEnd
  // callbacks above) see state.shell set. Without this, the closures
  // capture the original state with shell:null → hidePopup/cycleStatus/
  // rerender all no-op because state.shell is null.
  state = { ...state, shell };

  // Update shell callbacks on every showPopup so stale closures from a
  // previous lookup don't hide the wrong state or call an old onDismiss.
  shell.setOnDismiss(() => { state = hidePopup(state); onDismiss?.(state); });
  shell.setOnResizeEnd((newSize) => onResizeEnd(state, newSize));

  // Initialize state from result.
  const definitionSelection = initDefinitionSelection(result);
  const status = result.status;

  // Apply default active tab (spec §9.3 D2): per-lang override → global default.
  const perLang = state.settings.defaultActiveTabPerLang?.[result.langCode];
  const defaultTab = perLang !== undefined ? perLang : state.settings.defaultActiveTab;

  // Save the previous term's tab-panel data into the per-term cache before
  // switching. This lets A → B → A keep A's fetched audio/image/translation.
  if (state.cachedResultTerm && state.activeCandidateIndex === 0) {
    const cache = state.tabPanelCache.get(state.cachedResultTerm) ?? createEmptyTabPanelCache();
    cache.audioItems = state.audioItems;
    cache.audioSelection = state.audioSelection;
    cache.imageItems = state.imageItems;
    cache.imageSelection = state.imageSelection;
    cache.translations.set(state.cachedContextSentence, { translation: state.translation, selected: state.translationSelected });
    state.tabPanelCache.set(state.cachedResultTerm, cache);
  }

  // Load cached data for the new term (if any). Audio/image are per term;
  // translation is keyed by term + context sentence.
  const newCache = state.tabPanelCache.get(result.term) ?? createEmptyTabPanelCache();
  const translationEntry = newCache.translations.get(contextSentence);
  state = {
    ...state,
    activeCandidateIndex: 0,
    activeTab: defaultTab ?? null,
    contextSentence,
    cachedResultTerm: result.term,
    cachedContextSentence: contextSentence,
    currentResult: result,
    additionalResults: [],
    candidateStates: new Map(),
    currentStatus: status,
    definitionSelection,
    audioItems: newCache.audioItems,
    audioSelection: newCache.audioSelection,
    imageItems: newCache.imageItems,
    imageSelection: newCache.imageSelection,
    translation: translationEntry?.translation ?? '',
    translationSelected: translationEntry?.selected ?? false,
  };

  // Render content FIRST so setPosition can use actual offsetHeight.
  const container = shell.getContainer();
  if (container) {
    renderPopupContent(container, result, status, definitionSelection, {
      onStatusCycle: () => { state = cycleStatus(state); },
      onDefinitionToggle: (id, selected) => { state = toggleDefinition(state, id, selected); },
      onQuickAdd: () => { state = triggerCardCreatorAction(state, 'quick-add'); onDismiss?.(state); },
      onSendToCreator: () => { state = triggerCardCreatorAction(state, 'edit-card'); onDismiss?.(state); },
      onSettings: () => openSettings(state),
      onClose: () => {
        state = hidePopup(state);
        onDismiss?.(state);
      },
      onPlayTerm: () => {
        const active = getActiveResult(state);
        if (!active) return;
        void playTermAudio(active.term, active.langCode, getActiveSnapshot(state).audioItems);
      },
      onPlaySentence: () => {
        const active = getActiveResult(state);
        if (!active) return;
        void playSentenceAudio(state.contextSentence, active.langCode, getActiveSnapshot(state).audioItems);
      },
      onCandidateSelect: (idx) => { state = setActiveCandidate(state, idx); },
    });

    // Render toolbar (1 per popup, context = active candidate).
    renderPopupToolbar(state, container);
    // Render candidates chips + list.
    renderCandidateChipsAndList(state, container);
  }

  // Show first so offsetHeight is correct (display:none → offsetHeight=0).
  // Then position using actual rendered height. No visible flash because
  // setPosition runs synchronously in the same frame.
  shell.show();
  shell.setPosition(anchorTop, anchorLeft, anchorRight, anchorBottom);

  return state;
}

/**
 * Append an additional candidate to the existing popup.
 * Spec redesign: candidates shown as chips; active entry stays on winner.
 */
export function appendCandidate(
  state: PopupDictionaryState,
  result: LookupResult,
  _contextSentence: string,
): PopupDictionaryState {
  if (!state.shell) return state;
  const container = state.shell.getContainer();
  if (!container) return state;

  const index = state.additionalResults.length + 1;
  const candidateState = createCandidateState(result);
  state.candidateStates.set(index, candidateState);
  state.additionalResults = [...state.additionalResults, result];

  // Re-render candidates chips + list (active entry and toolbar stay unchanged).
  renderCandidateChipsAndList(state, container);
  state.shell?.rePosition();

  // Persist candidate status when it changes (async).
  void persistStatus(result.term, result.langCode, candidateState.status);

  return state;
}

/** Switch the active candidate shown in the active entry + toolbar. */
export function setActiveCandidate(
  state: PopupDictionaryState,
  idx: number,
): PopupDictionaryState {
  if (!state.shell) return state;
  if (idx < 0 || idx > state.additionalResults.length) return state;

  state.activeCandidateIndex = idx;
  const container = state.shell.getContainer();
  if (!container) return state;

  // Re-render active entry + toolbar + candidates (chips active highlight).
  renderActiveEntryFromState(state, container);
  renderPopupToolbar(state, container);
  renderCandidateChipsAndList(state, container);
  state.shell?.rePosition();
  return state;
}

/** Build a PopupCardCreatorPrefill from the active candidate's state. */
function buildPopupPrefill(state: PopupDictionaryState): PopupCardCreatorPrefill | null {
  const result = getActiveResult(state);
  if (!result) return null;
  const snapshot = getActiveSnapshot(state);

  // Definitions: use selected; if none selected, fall back to first.
  const selectedDefs = getSelectedDefinitions(result, snapshot.definitionSelection);
  const defs = selectedDefs.length > 0
    ? selectedDefs
    : result.definitions.slice(0, 1);
  // Audio: use selected; if none selected, fall back to first with a URL.
  const selectedAudio = snapshot.audioItems
    .filter((a) => a.url && snapshot.audioSelection.get(a.id) === true);
  const audioUrls = selectedAudio.length > 0
    ? selectedAudio.map((a) => a.url!)
    : snapshot.audioItems.filter((a) => a.url).slice(0, 1).map((a) => a.url!);
  // Image: use selected; if none selected, fall back to first.
  const selectedImages = snapshot.imageItems
    .filter((img) => snapshot.imageSelection.get(img.id) === true);
  const imageUrls = selectedImages.length > 0
    ? selectedImages.map((img) => img.src)
    : snapshot.imageItems.slice(0, 1).map((img) => img.src);
  return {
    term: result.term,
    langCode: result.langCode,
    reading: result.reading,
    definitions: defs.map((d) => ({ pos: d.pos, text: d.text })),
    contextSentence: state.contextSentence,
    translation: snapshot.translationSelected ? snapshot.translation : undefined,
    audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
  };
}

/** Trigger Card Creator action for the active candidate — opens dialog pre-filled. */
function triggerCardCreatorAction(
  state: PopupDictionaryState,
  action: PopupCardCreatorAction,
): PopupDictionaryState {
  if (!state.onCardCreatorAction) {
    showToast('Card Creator not available — open from subtitle cluster.', state.shell);
    return state;
  }
  const prefill = buildPopupPrefill(state);
  if (!prefill) return state;
  state.onCardCreatorAction(action, prefill);
  // Dismiss popup — user no longer needs it after triggering card creation.
  return hidePopup(state);
}

/** Hide popup (dismiss). Keeps the per-term tab-panel cache so reopening any
 *  previously looked-up term on this page reuses its fetched data. */
export function hidePopup(state: PopupDictionaryState): PopupDictionaryState {
  if (state.shell) {
    state.shell.hide();
  }
  return {
    ...state,
    currentResult: null,
    additionalResults: [],
    activeTab: null,
    translationLoading: false,
    activeCandidateIndex: 0,
    candidateStates: new Map(),
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
    translationLoading: false,
    activeCandidateIndex: 0,
    candidateStates: new Map(),
    currentStatus: 'unknown',
    definitionSelection: new Map(),
    audioSelection: new Map(),
    audioItems: [],
    imageSelection: new Map(),
    imageItems: [],
    translation: '',
    translationSelected: false,
  };
}

/** Cycle word status for the active candidate. */
export function cycleStatus(state: PopupDictionaryState): PopupDictionaryState {
  const active = getActiveResult(state);
  if (!active) return state;
  const newStatus = nextStatus(getActiveSnapshot(state).status);
  void persistStatus(active.term, active.langCode, newStatus);
  setActiveSnapshot(state, { status: newStatus });
  rerender(state);
  return state;
}

/** Toggle a definition checkbox for the active candidate. */
export function toggleDefinition(
  state: PopupDictionaryState,
  id: string,
  selected: boolean,
): PopupDictionaryState {
  const snapshot = getActiveSnapshot(state);
  const newSelection = new Map(snapshot.definitionSelection);
  newSelection.set(id, selected);
  return setActiveSnapshot(state, { definitionSelection: newSelection });
}

/** Toggle a tab for the active candidate. */
export function toggleTab(state: PopupDictionaryState, tab: PopupTab): PopupDictionaryState {
  const snapshot = getActiveSnapshot(state);
  const newTab = snapshot.activeTab === tab ? null : tab;
  if (state.shell?.getContainer()) {
    rerender(state, newTab);
  } else {
    state.activeTab = newTab;
  }
  return state;
}

// --- Internal helpers ---

/** Count selected items per tab for the active candidate. */
function countActiveSelections(snapshot: ActiveCandidateSnapshot): SelectionCounts {
  const counts: SelectionCounts = {};
  const audioCount = countMapTrue(snapshot.audioSelection);
  const imageCount = countMapTrue(snapshot.imageSelection);
  const translateCount = snapshot.translationSelected ? 1 : 0;
  if (audioCount > 0) counts.audio = audioCount;
  if (imageCount > 0) counts.image = imageCount;
  if (translateCount > 0) counts.translate = translateCount;
  return counts;
}

/** Get the active candidate result (0 = winner). */
function getActiveResult(state: PopupDictionaryState): LookupResult | null {
  if (state.activeCandidateIndex === 0) return state.currentResult;
  return state.additionalResults[state.activeCandidateIndex - 1] ?? null;
}

/** Build a snapshot of the active candidate's mutable state. */
function getActiveSnapshot(state: PopupDictionaryState): ActiveCandidateSnapshot {
  const result = getActiveResult(state);
  if (!result) {
    throw new Error('No active candidate result');
  }
  if (state.activeCandidateIndex === 0) {
    return {
      result,
      status: state.currentStatus,
      definitionSelection: state.definitionSelection,
      audioSelection: state.audioSelection,
      audioItems: state.audioItems,
      imageSelection: state.imageSelection,
      imageItems: state.imageItems,
      translation: state.translation,
      translationSelected: state.translationSelected,
      translationLoading: state.translationLoading,
      activeTab: state.activeTab,
    };
  }
  const cs = state.candidateStates.get(state.activeCandidateIndex) ?? createCandidateState(result);
  return {
    result,
    status: cs.status,
    definitionSelection: cs.definitionSelection,
    audioSelection: cs.audioSelection,
    audioItems: cs.audioItems,
    imageSelection: cs.imageSelection,
    imageItems: cs.imageItems,
    translation: cs.translation,
    translationSelected: cs.translationSelected,
    translationLoading: cs.translationLoading,
    activeTab: cs.activeTab,
  };
}

/** Apply a partial snapshot update to the active candidate in state (mutates in place). */
function setActiveSnapshot(state: PopupDictionaryState, patch: Partial<ActiveCandidateSnapshot>): PopupDictionaryState {
  if (state.activeCandidateIndex === 0) {
    state.currentStatus = patch.status ?? state.currentStatus;
    state.definitionSelection = patch.definitionSelection ?? state.definitionSelection;
    state.audioSelection = patch.audioSelection ?? state.audioSelection;
    state.audioItems = patch.audioItems ?? state.audioItems;
    state.imageSelection = patch.imageSelection ?? state.imageSelection;
    state.imageItems = patch.imageItems ?? state.imageItems;
    state.translation = patch.translation ?? state.translation;
    state.translationSelected = patch.translationSelected ?? state.translationSelected;
    state.translationLoading = patch.translationLoading ?? state.translationLoading;
    state.activeTab = patch.activeTab ?? state.activeTab;
    return state;
  }
  const result = getActiveResult(state);
  if (!result) return state;
  const old = state.candidateStates.get(state.activeCandidateIndex) ?? createCandidateState(result);
  const updated: CandidateState = {
    status: patch.status ?? old.status,
    definitionSelection: patch.definitionSelection ?? old.definitionSelection,
    audioSelection: patch.audioSelection ?? old.audioSelection,
    audioItems: patch.audioItems ?? old.audioItems,
    imageSelection: patch.imageSelection ?? old.imageSelection,
    imageItems: patch.imageItems ?? old.imageItems,
    translation: patch.translation ?? old.translation,
    translationSelected: patch.translationSelected ?? old.translationSelected,
    translationLoading: patch.translationLoading ?? old.translationLoading,
    activeTab: patch.activeTab ?? old.activeTab,
  };
  state.candidateStates.set(state.activeCandidateIndex, updated);
  return state;
}

/** Render the active entry (header + definitions) from state. */
function renderActiveEntryFromState(state: PopupDictionaryState, container: HTMLElement): void {
  const active = getActiveResult(state);
  if (!active) return;
  const snapshot = getActiveSnapshot(state);

  // Replace existing active entry if any.
  const existing = container.querySelector('.js-cell-active-entry');
  if (existing) existing.remove();

  const callbacks: PopupContentCallbacks = {
    onStatusCycle: () => { state = cycleStatus(state); },
    onDefinitionToggle: (id, selected) => { state = toggleDefinition(state, id, selected); },
    onQuickAdd: () => { state = triggerCardCreatorAction(state, 'quick-add'); },
    onSendToCreator: () => { state = triggerCardCreatorAction(state, 'edit-card'); },
    onSettings: () => openSettings(state),
    onClose: () => { state = hidePopup(state); },
    onPlayTerm: () => {
      const r = getActiveResult(state);
      if (!r) return;
      void playTermAudio(r.term, r.langCode, getActiveSnapshot(state).audioItems);
    },
    onPlaySentence: () => {
      const r = getActiveResult(state);
      if (!r) return;
      void playSentenceAudio(state.contextSentence, r.langCode, getActiveSnapshot(state).audioItems);
    },
    onCandidateSelect: (idx) => { state = setActiveCandidate(state, idx); },
  };

  renderActiveEntry(container, active, snapshot.status, snapshot.definitionSelection, callbacks);

  // Keep the active entry as the first child (candidates + footer follow it).
  const newEntry = container.querySelector('.js-cell-active-entry');
  if (newEntry && container.firstChild !== newEntry) {
    container.insertBefore(newEntry, container.firstChild);
  }
}

/** Render candidates as a single horizontal scrollable chips row. */
function renderCandidateChipsAndList(state: PopupDictionaryState, container: HTMLElement): void {
  const candidatesEl = getOrCreateCandidatesContainer(container);
  candidatesEl.innerHTML = '';

  const candidates: CandidateInfo[] = [];
  if (state.currentResult) {
    candidates.push({ idx: 0, result: state.currentResult, status: state.currentStatus });
  }
  for (let i = 0; i < state.additionalResults.length; i++) {
    const r = state.additionalResults[i]!;
    const cs = state.candidateStates.get(i + 1);
    candidates.push({ idx: i + 1, result: r, status: cs?.status ?? r.status });
  }

  renderCandidateChips(
    candidatesEl,
    candidates,
    state.activeCandidateIndex,
    (idx) => { state = setActiveCandidate(state, idx); },
  );
}

function renderPopupToolbar(state: PopupDictionaryState, container: HTMLElement): void {
  const slot = container.querySelector('.js-cell-materials-slot') as HTMLElement | null;
  if (!slot) return;

  const active = getActiveResult(state);
  if (!active) return;
  const snapshot = getActiveSnapshot(state);
  slot.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'cell-materials__bar';
  slot.appendChild(bar);
  const body = document.createElement('div');
  body.className = 'cell-materials__body';
  slot.appendChild(body);

  slot.classList.toggle('cell-materials--open', !!snapshot.activeTab);

  let toolbarEl: HTMLElement | null = null;

  const renderToolbarOnly = (): void => {
    const s = getActiveSnapshot(state);
    const newToolbar = renderToolbar(bar, s.activeTab, (t) => {
      const newTab = s.activeTab === t ? null : t;
      setActiveSnapshot(state, { activeTab: newTab });
      rerender(state, newTab);
    }, countActiveSelections(s), (tab) => {
      if (tab === 'translate') {
        const s2 = getActiveSnapshot(state);
        if (!s2.translation && !s2.translationLoading) {
          setActiveSnapshot(state, { translationLoading: true, activeTab: 'translate' });
          rerender(state, 'translate');
          const r = getActiveResult(state);
          if (!r) return;
          translateSentence(r, state.contextSentence, state.settings.translateTargetLang, (text) => {
            setActiveSnapshot(state, { translation: text, translationLoading: false, activeTab: 'translate' });
            rerender(state, 'translate');
          });
        }
      }
    });
    if (toolbarEl && toolbarEl.parentNode === bar) {
      bar.replaceChild(newToolbar, toolbarEl);
    }
    toolbarEl = newToolbar;
  };

  renderToolbarOnly();
  if (!snapshot.activeTab) return;

  renderTabPanel(body, snapshot.activeTab, active, {
    contextSentence: state.contextSentence,
    settings: state.settings,
    translation: snapshot.translation,
    translateSelected: snapshot.translationSelected,
    translationLoading: snapshot.translationLoading,
    audioSelection: snapshot.audioSelection,
    audioItems: snapshot.audioItems,
    imageSelection: snapshot.imageSelection,
    imageItems: snapshot.imageItems,
  }, {
    onTranslationDone: (text: string) => {
      setActiveSnapshot(state, { translation: text });
      rerender(state);
    },
    onTranslationLoading: (loading: boolean) => {
      setActiveSnapshot(state, { translationLoading: loading });
      rerender(state);
    },
    onToggleTranslate: () => {
      setActiveSnapshot(state, { translationSelected: !snapshot.translationSelected });
      rerender(state);
    },
    onPlayTts: (item, term, sentence, langCode) => playTts(item, term, sentence, langCode),
    onSelectionChange: renderToolbarOnly,
  });
}

/** Count true values in a Map. */
function countMapTrue(map: Map<string, boolean>): number {
  let n = 0;
  for (const v of map.values()) if (v) n++;
  return n;
}

/** Trigger translation for the current sentence. */
function translateSentence(
  result: LookupResult,
  contextSentence: string,
  targetLang: string,
  onDone: (text: string) => void,
): void {
  if (!contextSentence) return;
  const text = contextSentence;
  const sl = result.langCode;
  const tl = targetLang;
  if (!sl || !tl) return;
  void (async () => {
    try {
      const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
      type TranslateResponse = { success: boolean; data?: { translated: string[] }; error?: string };
      const res = await sendMessage<TranslateResponse>({ type: 'TRANSLATE', payload: { tabId: 0, text, sl, tl } });
      if (res?.success && res.data?.translated?.length) {
        const translated = res.data.translated.join(' ');
        onDone(translated);
      } else {
        console.warn('[popup] Translate failed:', res?.error ?? 'empty response');
      }
    } catch (err) {
      console.warn('[popup] Translate error:', err);
    }
  })();
}

/** Render a tab panel for the active candidate (reused by renderPopupToolbar). */
function renderTabPanel(
  container: HTMLElement,
  tab: PopupTab | null,
  result: LookupResult,
  ctx: {
    contextSentence: string;
    settings: DictionaryPopupSettings;
    translation: string;
    translateSelected: boolean;
    translationLoading?: boolean;
    audioSelection: Map<string, boolean>;
    audioItems: AudioItem[];
    imageSelection: Map<string, boolean>;
    imageItems: ImageItem[];
  },
  callbacks?: {
    onTranslationDone?: (text: string) => void;
    onTranslationLoading?: (loading: boolean) => void;
    onToggleTranslate?: () => void;
    onPlayTts?: (item: AudioItem, term: string, sentence: string, langCode: string) => void;
    onSelectionChange?: () => void;
  },
): void {
  if (!tab) return;
  switch (tab) {
    case 'audio': {
      const langCode = result.langCode;
      let currentlyPlayingAudioId: string | null = null;
      let currentlyPlayingAudio: HTMLAudioElement | null = null;
      let wordAudios: AudioItem[] = [];
      let sentenceAudios: AudioItem[] = [];

      // Show all audio items in the tab — header play buttons are quick-play
      // shortcuts (first available), not "owners" of the first item. Hiding the
      // first item when it's the only one made the tab show "No audio available"
      // even though audio exists.
      const tabWordAudios = (): AudioItem[] => wordAudios;
      const tabSentenceAudios = (): AudioItem[] => sentenceAudios;

      const stopCurrentAudio = (): void => {
        if (currentlyPlayingAudio) {
          currentlyPlayingAudio.pause();
          currentlyPlayingAudio = null;
        }
        currentlyPlayingAudioId = null;
      };

      const onToggle = (id: string, selected: boolean): void => { ctx.audioSelection.set(id, selected); };

      const onTts = (): void => {
        void playTts({ id: 'tts-fallback', kind: 'word', source: 'system-tts', label: '', state: 'idle', defaultSelected: false }, result.term, '', result.langCode);
      };

      const onPlay: (item: AudioItem) => void = (item) => {
        // Pause if already playing this Forvo item.
        if (currentlyPlayingAudioId === item.id && currentlyPlayingAudio) {
          currentlyPlayingAudio.pause();
          stopCurrentAudio();
          renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        stopCurrentAudio();
        if (item.url) {
          const audio = new Audio(item.url);
          currentlyPlayingAudio = audio;
          currentlyPlayingAudioId = item.id;
          audio.addEventListener('ended', () => {
            stopCurrentAudio();
            renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          audio.addEventListener('pause', () => {
            stopCurrentAudio();
            renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          void audio.play().catch(() => {
            stopCurrentAudio();
            renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        // TTS: we can't reliably track finish time, so keep the play icon.
        if (callbacks?.onPlayTts) callbacks.onPlayTts(item, result.term, ctx.contextSentence, result.langCode);
      };

      // Cache hit: audio panel data already exists for this term+sentence.
      if (ctx.audioItems.length > 0) {
        wordAudios = ctx.audioItems.filter((a) => a.kind === 'word');
        sentenceAudios = ctx.audioItems.filter((a) => a.kind === 'sentence');
        renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
        break;
      }
      // Loading state while fetching Forvo + TTS voices.
      renderAudioPanel(container, [], [], ctx.audioSelection, onToggle, onPlay, true, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
      void (async () => {
        // TTS settings: enabled gate + maxDisplay cap.
        // ponytail: autoplayCount skip — autoplay implement sau, cần user-gesture
        // policy check (Chrome blocks autoplay without user interaction).
        const ttsEnabled = ctx.settings.tts?.enabled !== false;
        const maxDisplay = ctx.settings.tts?.maxDisplay ?? 3;
        const [forvoItems, allTtsVoices] = await Promise.all([
          fetchForvoAudio(result.term, langCode),
          ttsEnabled ? fetchTtsVoiceRows(ctx.settings, langCode) : Promise.resolve([]),
        ]);
        const ttsVoices = allTtsVoices.slice(0, maxDisplay);
        const ttsWordItems: AudioItem[] = ttsVoices.map((v) => ({
          id: `tts-word-${v.voiceName}`,
          kind: 'word',
          source: 'system-tts',
          label: `${v.voiceName} · ${v.lang}`,
          state: 'idle',
          defaultSelected: false,
        }));
        const ttsSentenceItems: AudioItem[] = ctx.contextSentence
          ? ttsVoices.map((v) => ({
              id: `tts-sentence-${v.voiceName}`,
              kind: 'sentence',
              source: 'system-tts',
              label: `${v.voiceName} · Sentence`,
              state: 'idle',
              defaultSelected: false,
            }))
          : [];
        wordAudios = [...forvoItems, ...ttsWordItems].slice(0, 3);
        sentenceAudios = ttsSentenceItems.slice(0, 3);
        // Store fetched items in ctx (same array ref as state) for Quick Add payload.
        ctx.audioItems.length = 0;
        ctx.audioItems.push(...wordAudios, ...sentenceAudios);
        // Replace loading panel if still mounted (user may have closed tab).
        const existing = container.querySelector('.js-cell-panel[data-cell-panel="audio"]');
        if (!existing) return;
        existing.remove();
        // Fallback to hardcoded system TTS when both fetches return empty.
        if (wordAudios.length === 0 && sentenceAudios.length === 0) {
          const fallbackWord: AudioItem[] = [
            { id: `tts-word-${result.term}`, kind: 'word', source: 'system-tts', label: `System TTS · ${langCode.toUpperCase()}`, state: 'idle', defaultSelected: false },
          ];
          const fallbackSentence: AudioItem[] = ctx.contextSentence
            ? [{ id: `tts-sentence-${result.term}`, kind: 'sentence', source: 'system-tts', label: 'System TTS · Sentence', state: 'idle', defaultSelected: false }]
            : [];
          ctx.audioItems.length = 0;
          ctx.audioItems.push(...fallbackWord, ...fallbackSentence);
          wordAudios = fallbackWord;
          sentenceAudios = fallbackSentence;
          renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        renderAudioPanel(container, tabWordAudios(), tabSentenceAudios(), ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
      })();
      break;
    }
    case 'image': {
      const onToggle = (id: string, selected: boolean): void => { ctx.imageSelection.set(id, selected); };
      // Cache hit: image panel data already exists for this term.
      if (ctx.imageItems.length > 0) {
        renderImagePanel(container, ctx.imageItems, ctx.imageSelection, onToggle, result.term, false, undefined, callbacks?.onSelectionChange);
        break;
      }
      // Loading state while fetching images.
      renderImagePanel(container, [], ctx.imageSelection, onToggle, result.term, true, undefined, callbacks?.onSelectionChange);
      void (async () => {
        try {
          const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
          const res = await sendMessage<MessageResponse<FetchImagesResponse>>({
            type: 'FETCH_IMAGES',
            payload: { tabId: 0, term: result.term, langCode: result.langCode, maxResults: 8 },
          });
          const items = res?.data?.items ?? [];
          // Store fetched items in ctx (same array ref as state) for Quick Add payload.
          ctx.imageItems.length = 0;
          ctx.imageItems.push(...items);
          const existing = container.querySelector('.js-cell-panel[data-cell-panel="image"]');
          if (!existing) return;
          existing.remove();
          renderImagePanel(container, items, ctx.imageSelection, onToggle, result.term, false, undefined, callbacks?.onSelectionChange);
        } catch (err) {
          const existing = container.querySelector('.js-cell-panel[data-cell-panel="image"]');
          if (!existing) return;
          existing.remove();
          renderImagePanel(
            container, [], ctx.imageSelection, onToggle, result.term,
            false, err instanceof Error ? err.message : 'Failed to load images',
            callbacks?.onSelectionChange,
          );
        }
      })();
      break;
    }
    case 'translate':
      renderTranslatePanel(
        container,
        ctx.translation,
        ctx.contextSentence,
        ctx.settings.translateTargetLang,
        () => {
          // Translate sentence only — never fall back to term.
          if (!ctx.contextSentence) return;
          callbacks?.onTranslationLoading?.(true);
          translateSentence(result, ctx.contextSentence, ctx.settings.translateTargetLang, (text) => {
            callbacks?.onTranslationLoading?.(false);
            callbacks?.onTranslationDone?.(text);
          });
        },
        ctx.translateSelected,
        () => {
          // B3: mutate state via callback so toggle persists across rerenders.
          // Mutating ctx.translateSelected alone is lost when rerender rebuilds
          // ctx from state.translationSelected.
          if (callbacks?.onToggleTranslate) {
            callbacks.onToggleTranslate();
          } else {
            ctx.translateSelected = !ctx.translateSelected;
            callbacks?.onTranslationDone?.(ctx.translation);
          }
        },
        ctx.translationLoading ?? false,
        callbacks?.onSelectionChange,
      );
      break;
    case 'links': {
      const templates = ctx.settings.externalDictLinks;
      const links = fillExternalDictLinks(templates, result.term, result.langCode);
      renderLinksPanel(container, links);
      break;
    }
  }
}

function rerender(state: PopupDictionaryState, activeTab?: PopupTab | null): void {
  if (!state.shell?.getContainer() || !state.currentResult) return;
  if (activeTab !== undefined) {
    state.activeTab = activeTab;
  }
  const container = state.shell.getContainer()!;
  renderActiveEntryFromState(state, container);
  renderPopupToolbar(state, container);
  renderCandidateChipsAndList(state, container);
  state.shell?.rePosition();
}

/** Open extension settings page (Dictionary Popup section). */
function openSettings(_state: PopupDictionaryState): void {
  // ponytail: open extension options page — chrome.runtime.openOptionsPage
  // focuses the Dictionary Popup settings section.
  try {
    void chrome.runtime.openOptionsPage();
  } catch {
    // Fallback: open options URL directly.
    void window.open(chrome.runtime.getURL('src/entrypoints/options/index.html'));
  }
}

async function persistStatus(term: string, langCode: string, status: WordStatus): Promise<void> {
  // ponytail: wordStatusStore.put requires IndexedDB — delegate to background.
  // For MVP, send a message to the background script.
  // On quota error (spec §10): background catches WordStatusQuotaError,
  // returns error response → caller shows toast. UI status already updated
  // (graceful degradation — next lookup shows old status).
  try {
    const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
    await sendMessage({
      type: 'WORD_STATUS_SET',
      payload: { term, langCode, status },
    });
  } catch (err) {
    // Quota error → show toast (spec §10 failure path).
    if (err instanceof Error && (err.name === 'WordStatusQuotaError' || err.message.toLowerCase().includes('quota'))) {
      showToast('Bộ nhớ đầy — xóa resource cũ trong Settings → Resources');
    }
    // Other errors — fail silently (best-effort persist).
  }
}

/** Show a toast message in the popup's Shadow DOM. */
function showToast(message: string, shell?: PopupShell | null): void {
  if (shell) {
    shell.showToast(message);
  } else {
    // ponytail: no popup mounted yet → fallback to console.
    console.warn(`[popupDictionary] ${message}`);
  }
}

function onResizeEnd(state: PopupDictionaryState, size: PopupSize): void {
  // Persist sticky size to settings via UPDATE_SETTINGS (spec §9.3).
  void (async () => {
    try {
      const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
      await sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: {
          settings: {
            dictionaryPopup: {
              ...state.settings,
              popupWidthPx: size.width,
              popupMaxHeightPx: size.maxHeight,
            },
          },
        },
      });
    } catch {
      // Best-effort — fail silently (next popup uses last persisted size).
    }
  })();
}

/** Play the term from the header audio button: use first cached Forvo URL or TTS. */
async function playTermAudio(term: string, langCode: string, audioItems: readonly AudioItem[]): Promise<void> {
  // ponytail: state.audioItems may not be loaded yet (lazy Audio tab). If a Forvo
  // word URL is already cached, play it; otherwise fall back to system TTS.
  const forvoItem = audioItems.find((a) => a.kind === 'word' && a.url);
  if (forvoItem?.url) {
    void new Audio(forvoItem.url).play().catch(() => { /* best-effort */ });
    return;
  }
  await playTts({ id: 'tts-word-', kind: 'word', source: 'system-tts', label: '', state: 'idle', defaultSelected: false }, term, '', langCode);
}

/** Play the sentence from the header audio button: use first cached sentence URL or TTS. */
async function playSentenceAudio(sentence: string, langCode: string, audioItems: readonly AudioItem[]): Promise<void> {
  if (!sentence) return;
  const sentenceItem = audioItems.find((a) => a.kind === 'sentence' && a.url);
  if (sentenceItem?.url) {
    void new Audio(sentenceItem.url).play().catch(() => { /* best-effort */ });
    return;
  }
  await playTts({ id: 'tts-sentence-', kind: 'sentence', source: 'system-tts', label: '', state: 'idle', defaultSelected: false }, '', sentence, langCode);
}

/** Play TTS — sends TTS_SPEAK to background (chrome.tts engine). Falls back to
 *  Web Speech API (content-script available) if the message fails. For Forvo
 *  items (item.url set), the caller plays via HTMLAudioElement directly. */
async function playTts(item: AudioItem, term: string, sentence: string, langCode: string): Promise<void> {
  const text = item.kind === 'sentence' ? sentence : term;
  if (!text) return;
  // Extract voiceName from id pattern `tts-{word|sentence}-{voiceName}`.
  const voiceName = item.id.replace(/^tts-(?:word|sentence)-/, '');
  try {
    const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
    await sendMessage({
      type: 'TTS_SPEAK',
      payload: { tabId: 0, text, langCode, voiceName: voiceName || undefined },
    });
  } catch {
    // Fallback: Web Speech API (available in content script context).
    if (typeof speechSynthesis === 'undefined') {
      showToast('Trình duyệt không hỗ trợ TTS');
      return;
    }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode ?? 'en';
    utter.rate = 0.9;
    if (voiceName) {
      const voices = speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === voiceName);
      if (match) utter.voice = match;
    }
    speechSynthesis.speak(utter);
  }
}

/** Fetch community (Forvo) audio items via background handler. Returns [] on
 *  error — caller falls back to TTS. tabId=0 (best-effort; background fetches
 *  regardless of tab — AGENTS.md MV3 fan-out rule). */
async function fetchForvoAudio(term: string, langCode: string): Promise<AudioItem[]> {
  try {
    const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
    const res = await sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
      type: 'FETCH_COMMUNITY_AUDIO',
      payload: { tabId: 0, term, langCode, kind: 'word' },
    });
    if (!res?.success) {
      console.warn('[fetchForvoAudio] handler failed:', res?.error);
      return [];
    }
    return res?.data?.items ? [...res.data.items] : [];
  } catch (err) {
    console.warn('[fetchForvoAudio] message error:', err);
    return [];
  }
}

/** Resolve TTS voice rows from settings + engine voice list. Returns [] on
 *  error (engine unavailable). When savedVoices is non-empty, returns them
 *  directly — content scripts fall back to Web Speech (no chrome.tts), which
 *  would hide chrome.tts-saved voices. Only query the engine for auto-detect
 *  (savedVoices empty). */
async function fetchTtsVoiceRows(settings: DictionaryPopupSettings, langCode: string): Promise<TtsVoiceRow[]> {
  const savedVoices = settings.tts?.savedVoices ?? [];
  if (savedVoices.length > 0) {
    return savedVoices.slice().sort((a, b) => a.order - b.order);
  }
  try {
    const engine = createTtsEngine();
    const allVoices = await engine.getVoices();
    return getTtsVoiceRows(savedVoices, allVoices, langCode);
  } catch {
    return [];
  }
}

/** Get the initial popup size from settings, clamped to viewport. */
export function getInitialPopupSize(settings: DictionaryPopupSettings): PopupSize {
  return clampPopupSize(
    { width: settings.popupWidthPx, maxHeight: settings.popupMaxHeightPx },
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080,
  );
}
