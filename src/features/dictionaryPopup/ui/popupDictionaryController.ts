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
import type { DefinitionSelection } from './popupContent';
import { PopupShell as PopupShellClass, clampPopupSize } from './popupShell';
import {
  renderPopupContent,
  renderCandidate,
  appendCandidateContent,
  getOrCreateCandidateList,
  initDefinitionSelection,
  getSelectedDefinitions,
  STATUS_BADGE_VARIANT,
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
  /** Current word status. */
  currentStatus: WordStatus;
  /** Definition selection checkboxes. */
  definitionSelection: DefinitionSelection;
  /** Audio selection checkboxes. */
  audioSelection: Map<string, boolean>;
  /** Audio items fetched by the audio panel (stored for Quick Add payload). */
  audioItems: AudioItem[];
  /** Image selection checkboxes. */
  imageSelection: Map<string, boolean>;
  /** Image items fetched by the image panel (stored for Quick Add payload). */
  imageItems: ImageItem[];
  /** Active tab (null = no panel open). */
  activeTab: PopupTab | null;
  /** Current translation text. */
  translation: string;
  /** Whether translation is selected for Quick Add. */
  translationSelected: boolean;
  /** Whether translation is currently loading. */
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
  if (state.cachedResultTerm) {
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
    activeTab: defaultTab ?? null,
    contextSentence,
    cachedResultTerm: result.term,
    cachedContextSentence: contextSentence,
    currentResult: result,
    additionalResults: [],
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
      onQuickAdd: () => { triggerCardCreatorAction(state, 'quick-add'); },
      onSendToCreator: () => { triggerCardCreatorAction(state, 'edit-card'); },
      onSettings: () => openSettings(state),
      onClose: () => {
        state = hidePopup(state);
        onDismiss?.(state);
      },
      onPlayTerm: () => {
        if (!state.currentResult) return;
        void playTermAudio(state.currentResult.term, state.currentResult.langCode, state.audioItems);
      },
    });

    // Render winner toolbar into its slot (mirrors appendCandidate's
    // rerenderCandidateTab) — toolbar icons always visible, panel only
    // when activeTab is set. Without this the winner lacks .js-cell-toolbar
    // while appended candidates have one (inconsistent UI).
    renderWinnerToolbar(state, container);
  }

  // Show first so offsetHeight is correct (display:none → offsetHeight=0).
  // Then position using actual rendered height. No visible flash because
  // setPosition runs synchronously in the same frame.
  shell.show();
  shell.setPosition(anchorTop, anchorLeft, anchorRight, anchorBottom);

  return state;
}

/**
 * Append an additional candidate to an existing popup.
 * Renders header + definitions for the candidate below the existing content.
 * Per-candidate buttons (Quick Add, status cycle, Send to Creator) are wired
 * with closures that capture this candidate's result + selection — independent
 * of the winner's state.
 */
export function appendCandidate(
  state: PopupDictionaryState,
  result: LookupResult,
  _contextSentence: string,
  onDismiss?: (newState: PopupDictionaryState) => void,
): PopupDictionaryState {
  if (!state.shell) return state;
  const container = state.shell.getContainer();
  if (!container) return state;

  const candidateSelection = initDefinitionSelection(result);
  let candidateStatus = result.status; // mutable per-candidate status
  // Per-candidate tab state (independent from winner's tab).
  let candidateTab: PopupTab | null = null;
  let candidateTranslation = '';
  const candidateAudioSelection = new Map<string, boolean>();
  const candidateImageSelection = new Map<string, boolean>();
  const candidateAudioItems: AudioItem[] = [];
  const candidateImageItems: ImageItem[] = [];
  let candidateTranslationLoading = false;

  const candidateEl = appendCandidateContent(container, result, candidateStatus, candidateSelection, {
    onStatusCycle: () => {
      candidateStatus = nextStatus(candidateStatus);
      void persistStatus(result.term, result.langCode, candidateStatus);
      const badge = candidateEl.querySelector('.js-cell-status');
      if (badge) {
        badge.textContent = candidateStatus;
        badge.className = `cell-header__status cell-header__status--${STATUS_BADGE_VARIANT[candidateStatus]} js-cell-status`;
      }
    },
    onDefinitionToggle: (id, selected) => {
      candidateSelection.set(id, selected);
    },
    onQuickAdd: () => {
      triggerCardCreatorActionForCandidate(state, 'quick-add', result, candidateSelection);
    },
    onSendToCreator: () => {
      triggerCardCreatorActionForCandidate(state, 'edit-card', result, candidateSelection);
    },
    onSettings: () => openSettings(state),
    onClose: () => {
      state = hidePopup(state);
      onDismiss?.(state);
    },
    onPlayTerm: () => { void playTermAudio(result.term, result.langCode, candidateAudioItems); },
  });

  // Per-candidate toolbar: render toolbar + panel into toolbar slot
  // (between header and definitions).
  const rerenderCandidateTab = (): void => {
    const slot = candidateEl.querySelector('.js-cell-toolbar-slot');
    if (!slot) return;
    slot.innerHTML = '';
    let toolbarEl: HTMLElement | null = null;

    // Always render toolbar (tab icons visible, panel only when tab active).
    const renderToolbarOnly = (): void => {
      const newToolbar = renderToolbar(slot as HTMLElement, candidateTab, (t) => {
        candidateTab = candidateTab === t ? null : t;
        rerenderCandidateTab();
        state.shell?.rePosition();
      }, countSelectionsForCandidate(candidateAudioSelection, candidateImageSelection), (tab) => {
        if (tab === 'translate' && !candidateTranslation && !candidateTranslationLoading) {
          candidateTranslationLoading = true;
          rerenderCandidateTab();
          translateSentence(result, state.contextSentence, state.settings.translateTargetLang, (text) => {
            candidateTranslation = text;
            candidateTranslationLoading = false;
            rerenderCandidateTab();
          });
        }
      });
      if (toolbarEl && toolbarEl.parentNode === slot) {
        slot.replaceChild(newToolbar, toolbarEl);
      }
      toolbarEl = newToolbar;
    };

    renderToolbarOnly();
    if (!candidateTab) return;
    // Render panel into slot after toolbar.
    renderTabPanel(slot as HTMLElement, candidateTab, result, {
      contextSentence: state.contextSentence,
      settings: state.settings,
      translation: candidateTranslation,
      translateSelected: false,
      translationLoading: candidateTranslationLoading,
      audioSelection: candidateAudioSelection,
      audioItems: candidateAudioItems,
      imageSelection: candidateImageSelection,
      imageItems: candidateImageItems,
    }, {
      onTranslationDone: (text) => {
        candidateTranslation = text;
        rerenderCandidateTab();
      },
      onTranslationLoading: (loading) => {
        candidateTranslationLoading = loading;
        rerenderCandidateTab();
      },
      onPlayTts: (item, term, sentence, langCode) => playTts(item, term, sentence, langCode),
      onSelectionChange: renderToolbarOnly,
    });
    state.shell?.rePosition();
  };

  // Initial toolbar render (no tab active — just icons).
  rerenderCandidateTab();

  return {
    ...state,
    additionalResults: [...state.additionalResults, result],
  };
}

/** Build a PopupCardCreatorPrefill from the winner's state (lookup result +
 *  selected definitions + context sentence + translation + selected audio/image URLs). */
function buildPopupPrefill(state: PopupDictionaryState): PopupCardCreatorPrefill | null {
  if (!state.currentResult) return null;
  const selectedDefs = getSelectedDefinitions(state.currentResult, state.definitionSelection);
  const audioUrls = state.audioItems
    .filter((a) => a.url && state.audioSelection.get(a.id) === true)
    .map((a) => a.url!) ;
  const imageUrls = state.imageItems
    .filter((img) => state.imageSelection.get(img.id) === true)
    .map((img) => img.src);
  return {
    term: state.currentResult.term,
    langCode: state.currentResult.langCode,
    reading: state.currentResult.reading,
    definitions: selectedDefs.map((d) => ({ pos: d.pos, text: d.text })),
    contextSentence: state.contextSentence,
    translation: state.translationSelected ? state.translation : undefined,
    audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
  };
}

/** Build a PopupCardCreatorPrefill for an appended candidate (own result + selection). */
function buildCandidatePrefill(
  result: LookupResult,
  selection: DefinitionSelection,
  contextSentence: string,
): PopupCardCreatorPrefill {
  const selectedDefs = getSelectedDefinitions(result, selection);
  return {
    term: result.term,
    langCode: result.langCode,
    reading: result.reading,
    definitions: selectedDefs.map((d) => ({ pos: d.pos, text: d.text })),
    contextSentence,
  };
}

/** Trigger Card Creator action for the winner — opens dialog pre-filled. */
function triggerCardCreatorAction(
  state: PopupDictionaryState,
  action: PopupCardCreatorAction,
): void {
  if (!state.onCardCreatorAction) {
    showToast('Card Creator not available — open from subtitle cluster.', state.shell);
    return;
  }
  const prefill = buildPopupPrefill(state);
  if (!prefill) return;
  state.onCardCreatorAction(action, prefill);
}

/** Trigger Card Creator action for an appended candidate. */
function triggerCardCreatorActionForCandidate(
  state: PopupDictionaryState,
  action: PopupCardCreatorAction,
  result: LookupResult,
  selection: DefinitionSelection,
): void {
  if (!state.onCardCreatorAction) {
    showToast('Card Creator not available — open from subtitle cluster.', state.shell);
    return;
  }
  const prefill = buildCandidatePrefill(result, selection, state.contextSentence);
  state.onCardCreatorAction(action, prefill);
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
  };
}

/** Cycle word status: unknown → tracking → known → ignore → unknown. */
export function cycleStatus(state: PopupDictionaryState): PopupDictionaryState {
  if (!state.currentResult) return state;
  const newStatus = nextStatus(state.currentStatus);
  // Persist to word status store (async — fire and forget).
  void persistStatus(state.currentResult.term, state.currentResult.langCode, newStatus);
  // Re-render header with new status.
  const newState = { ...state, currentStatus: newStatus };
  rerender(newState);
  return newState;
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

// --- Internal helpers ---

/** Count selected items per tab for toolbar badges. */
function countSelections(state: PopupDictionaryState): SelectionCounts {
  const audioCount = countMapTrue(state.audioSelection);
  const imageCount = countMapTrue(state.imageSelection);
  const translateCount = state.translationSelected ? 1 : 0;
  const counts: SelectionCounts = {};
  if (audioCount > 0) counts.audio = audioCount;
  if (imageCount > 0) counts.image = imageCount;
  if (translateCount > 0) counts.translate = translateCount;
  return counts;
}

/** Count selected items per tab for an appended candidate. */
function countSelectionsForCandidate(
  audioSelection: Map<string, boolean>,
  imageSelection: Map<string, boolean>,
): SelectionCounts {
  const counts: SelectionCounts = {};
  const audioCount = countMapTrue(audioSelection);
  const imageCount = countMapTrue(imageSelection);
  if (audioCount > 0) counts.audio = audioCount;
  if (imageCount > 0) counts.image = imageCount;
  return counts;
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

/** Render the winner's toolbar + optional panel into its .js-cell-toolbar-slot.
 *  Mirrors appendCandidate's rerenderCandidateTab so the winner has the same
 *  .js-cell-toolbar as appended candidates. */
function renderWinnerToolbar(state: PopupDictionaryState, container: HTMLElement): void {
  if (!state.currentResult) return;
  const candidate = container.querySelector('.js-cell-popup-candidate');
  if (!candidate) return;
  const slot = candidate.querySelector('.js-cell-toolbar-slot') as HTMLElement | null;
  if (!slot) return;
  slot.innerHTML = '';
  let toolbarEl: HTMLElement | null = null;

  const renderToolbarOnly = (): void => {
    const newToolbar = renderToolbar(slot, state.activeTab, (t) => toggleTab(state, t), countSelections(state), (tab) => {
      if (tab === 'translate' && !state.translation && !state.translationLoading && state.currentResult) {
        state.translationLoading = true;
        rerender(state, 'translate');
        translateSentence(state.currentResult, state.contextSentence, state.settings.translateTargetLang, (text) => {
          state.translation = text;
          state.translationLoading = false;
          // Force translate tab to stay open: the onTabOpen closure may capture
          // a stale state object with activeTab=null, so pass 'translate' explicitly.
          rerender(state, 'translate');
        });
      }
    });
    if (toolbarEl && toolbarEl.parentNode === slot) {
      slot.replaceChild(newToolbar, toolbarEl);
    }
    toolbarEl = newToolbar;
  };

  renderToolbarOnly();
  if (!state.activeTab) return;
  renderTabPanel(slot, state.activeTab, state.currentResult, {
    contextSentence: state.contextSentence,
    settings: state.settings,
    translation: state.translation,
    translateSelected: state.translationSelected,
    translationLoading: state.translationLoading,
    audioSelection: state.audioSelection,
    audioItems: state.audioItems,
    imageSelection: state.imageSelection,
    imageItems: state.imageItems,
  }, {
    onTranslationDone: (text: string) => {
      state.translation = text;
      rerender(state);
    },
    onTranslationLoading: (loading: boolean) => {
      state.translationLoading = loading;
      rerender(state);
    },
    onToggleTranslate: () => {
      state.translationSelected = !state.translationSelected;
      rerender(state);
    },
    onPlayTts: (item, _term, _sentence, langCode) => playTts(item, state.currentResult?.term ?? '', state.contextSentence, langCode),
    onSelectionChange: renderToolbarOnly,
  });
}

/** Render a tab panel for any result (winner or candidate). Reused by appendCandidate. */
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
          renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        stopCurrentAudio();
        if (item.url) {
          const audio = new Audio(item.url);
          currentlyPlayingAudio = audio;
          currentlyPlayingAudioId = item.id;
          audio.addEventListener('ended', () => {
            stopCurrentAudio();
            renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          audio.addEventListener('pause', () => {
            stopCurrentAudio();
            renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          void audio.play().catch(() => {
            stopCurrentAudio();
            renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          });
          renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        // TTS: we can't reliably track finish time, so keep the play icon.
        if (callbacks?.onPlayTts) callbacks.onPlayTts(item, result.term, ctx.contextSentence, result.langCode);
      };

      // Cache hit: audio panel data already exists for this term+sentence.
      if (ctx.audioItems.length > 0) {
        wordAudios = ctx.audioItems.filter((a) => a.kind === 'word');
        sentenceAudios = ctx.audioItems.filter((a) => a.kind === 'sentence');
        renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
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
            { id: `tts-word-${result.term}`, kind: 'word', source: 'system-tts', label: `System TTS · ${langCode.toUpperCase()}`, state: 'idle', defaultSelected: true },
          ];
          const fallbackSentence: AudioItem[] = ctx.contextSentence
            ? [{ id: `tts-sentence-${result.term}`, kind: 'sentence', source: 'system-tts', label: 'System TTS · Sentence', state: 'idle', defaultSelected: false }]
            : [];
          ctx.audioItems.length = 0;
          ctx.audioItems.push(...fallbackWord, ...fallbackSentence);
          wordAudios = fallbackWord;
          sentenceAudios = fallbackSentence;
          renderAudioPanel(container, fallbackWord, fallbackSentence, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
          return;
        }
        renderAudioPanel(container, wordAudios, sentenceAudios, ctx.audioSelection, onToggle, onPlay, false, undefined, currentlyPlayingAudioId ?? undefined, onTts, callbacks?.onSelectionChange);
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
  const tab = activeTab ?? state.activeTab;
  const container = state.shell.getContainer()!;
  // Re-render only the winner candidate and preserve appended candidates.
  const list = getOrCreateCandidateList(container);
  const existing = Array.from(list.children);
  const winnerCandidate = existing.shift();
  if (winnerCandidate) winnerCandidate.remove();
  renderCandidate(list, state.currentResult, state.currentStatus, state.definitionSelection, {
    onStatusCycle: () => { state = cycleStatus(state); },
    onDefinitionToggle: (id, selected) => { state = toggleDefinition(state, id, selected); },
    onQuickAdd: () => { triggerCardCreatorAction(state, 'quick-add'); },
    onSendToCreator: () => { triggerCardCreatorAction(state, 'edit-card'); },
    onSettings: () => openSettings(state),
    onClose: () => { state = hidePopup(state); },
    onPlayTerm: () => {
      if (!state.currentResult) return;
      void playTermAudio(state.currentResult.term, state.currentResult.langCode, state.audioItems);
    },
  }, true);
  existing.forEach((c) => list.appendChild(c));
  // Render winner toolbar into its slot (consistent with showPopup/appendCandidate).
  // Use the live state object so async tab callbacks mutate the same state.
  state.activeTab = tab;
  renderWinnerToolbar(state, container);
  // Re-position after content change (height may have changed).
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
