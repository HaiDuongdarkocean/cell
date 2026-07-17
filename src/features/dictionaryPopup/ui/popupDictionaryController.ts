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

import type { LookupResult, WordStatus, PopupTab, QuickAddResponse, AudioItem } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import type { TokenWrapState } from '../trigger/subtitleTokenWrap';
import type { PopupShell, PopupSize } from './popupShell';
import type { DefinitionSelection } from './popupContent';
import { PopupShell as PopupShellClass, clampPopupSize } from './popupShell';
import {
  renderPopupContent,
  appendCandidateContent,
  initDefinitionSelection,
  getSelectedDefinitions,
} from './popupContent';
import { renderToolbar, renderAudioPanel, renderImagePanel, renderTranslatePanel, renderLinksPanel } from './popupToolbar';
import { nextStatus } from '../services/wordStatusStore';
import { assembleQuickAddPayload } from '../services/quickAddAssembler';
import { executeQuickAdd } from '../services/quickAddHandler';
import { extractPrefill, sendToCreator } from '../services/sendToCreator';
import { fillExternalDictLinks } from './popupToolbar';

/** Controller state — holds all runtime state for the popup dictionary. */
export interface PopupDictionaryState {
  readonly settings: DictionaryPopupSettings;
  readonly cardCreatorSettings: CardCreatorSettings;
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
    additionalResults: [],
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

  // Initialize state from result.
  const definitionSelection = initDefinitionSelection(result);
  const status = result.status;

  // Apply default active tab (spec §9.3 D2): per-lang override → global default.
  const perLang = state.settings.defaultActiveTabPerLang?.[result.langCode];
  const defaultTab = perLang !== undefined ? perLang : state.settings.defaultActiveTab;
  state = { ...state, activeTab: defaultTab ?? null };

  // Render content FIRST so setPosition can use actual offsetHeight.
  const container = shell.getContainer();
  if (container) {
    renderPopupContent(container, result, status, definitionSelection, {
      onStatusCycle: () => cycleStatus(state),
      onDefinitionToggle: (id, selected) => toggleDefinition(state, id, selected),
      onQuickAdd: () => doQuickAdd(state),
      onSendToCreator: () => void sendToCreatorFromPopup(state),
      onSettings: () => openSettings(state),
    });

    // Re-append resize handle after clearContainer wiped it.
    shell.reAppendResizeHandle();

    // Render winner toolbar into its slot (mirrors appendCandidate's
    // rerenderCandidateTab) — toolbar icons always visible, panel only
    // when activeTab is set. Without this the winner lacks .js-cell-toolbar
    // while appended candidates have one (inconsistent UI).
    renderWinnerToolbar({ ...state, currentResult: result }, container);
  }

  // Show first so offsetHeight is correct (display:none → offsetHeight=0).
  // Then position using actual rendered height. No visible flash because
  // setPosition runs synchronously in the same frame.
  shell.show();
  shell.setPosition(anchorTop, anchorLeft, anchorRight, anchorBottom);

  return {
    ...state,
    currentResult: result,
    additionalResults: [],
    currentStatus: status,
    definitionSelection,
    contextSentence,
    shell,
  };
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

  const candidateEl = appendCandidateContent(container, result, candidateStatus, candidateSelection, {
    onStatusCycle: () => {
      candidateStatus = nextStatus(candidateStatus);
      void persistStatus(result.term, result.langCode, candidateStatus);
      const badge = candidateEl.querySelector('.js-cell-status');
      if (badge) badge.textContent = candidateStatus;
    },
    onDefinitionToggle: (id, selected) => {
      candidateSelection.set(id, selected);
    },
    onQuickAdd: () => void doQuickAddForCandidate(
      result, candidateSelection, candidateStatus,
      state.contextSentence, state.cardCreatorSettings,
    ),
    onSendToCreator: () => void sendToCreatorForCandidate(
      result, candidateSelection,
      state.contextSentence, state.cardCreatorSettings,
    ),
    onSettings: () => openSettings(state),
  });

  // Per-candidate toolbar: render toolbar + panel into toolbar slot
  // (between header and definitions).
  const rerenderCandidateTab = (): void => {
    const slot = candidateEl.querySelector('.js-cell-toolbar-slot');
    if (!slot) return;
    slot.innerHTML = '';
    // Always render toolbar (tab icons visible, panel only when tab active).
    renderToolbar(slot as HTMLElement, candidateTab, (t) => {
      candidateTab = candidateTab === t ? null : t;
      rerenderCandidateTab();
      state.shell?.rePosition();
    }, () => {
      candidateTab = null;
      rerenderCandidateTab();
      state.shell?.rePosition();
    });
    if (!candidateTab) return;
    // Render panel into slot after toolbar.
    renderTabPanel(slot as HTMLElement, candidateTab, result, {
      contextSentence: state.contextSentence,
      settings: state.settings,
      translation: candidateTranslation,
      audioSelection: candidateAudioSelection,
      imageSelection: candidateImageSelection,
    }, {
      onTranslationDone: (text) => {
        candidateTranslation = text;
        rerenderCandidateTab();
      },
      onPlayTts: (item, term, sentence, langCode) => playTts(item, term, sentence, langCode),
    });
    state.shell?.rePosition();
  };

  // Initial toolbar render (no tab active — just icons).
  rerenderCandidateTab();

  // Re-append resize handle after content change.
  state.shell.reAppendResizeHandle();

  return {
    ...state,
    additionalResults: [...state.additionalResults, result],
  };
}

/** Per-candidate Quick Add — builds payload from candidate's own result + selection. */
async function doQuickAddForCandidate(
  result: LookupResult,
  selection: DefinitionSelection,
  status: WordStatus,
  contextSentence: string,
  cardCreatorSettings: CardCreatorSettings,
): Promise<QuickAddResponse> {
  const selectedResult: LookupResult = {
    ...result,
    definitions: getSelectedDefinitions(result, selection),
  };
  const payload = assembleQuickAddPayload(
    selectedResult,
    { definitions: selection, audios: new Map(), images: new Map() },
    contextSentence,
    '', // no translation for additional candidates
    status,
    cardCreatorSettings,
  );
  const fieldMapping: Record<string, string> = {
    Front: 'term', Back: 'definitions', Sentence: 'sentence', Translation: 'translation',
  };
  return executeQuickAdd(payload, cardCreatorSettings, fieldMapping);
}

/** Per-candidate Send to Creator — uses candidate's own result + selection. */
async function sendToCreatorForCandidate(
  result: LookupResult,
  selection: DefinitionSelection,
  contextSentence: string,
  cardCreatorSettings: CardCreatorSettings,
): Promise<void> {
  const prefill = extractPrefill(result, selection, contextSentence, undefined);
  await sendToCreator(prefill, cardCreatorSettings);
}

/** Hide popup (dismiss). */
export function hidePopup(state: PopupDictionaryState): PopupDictionaryState {
  if (state.shell) {
    state.shell.hide();
  }
  return {
    ...state,
    currentResult: null,
    additionalResults: [],
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

  // Build a result that only contains the selected senses/definitions.
  const selectedResult: LookupResult = {
    ...state.currentResult,
    definitions: getSelectedDefinitions(state.currentResult, state.definitionSelection),
  };

  const payload = assembleQuickAddPayload(
    selectedResult,
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
  renderToolbar(slot, state.activeTab, (t) => toggleTab(state, t), () => {
    state.activeTab = null;
    rerender(state, null);
  });
  if (!state.activeTab) return;
  renderTabPanel(slot, state.activeTab, state.currentResult, {
    contextSentence: state.contextSentence,
    settings: state.settings,
    translation: state.translation,
    audioSelection: state.audioSelection,
    imageSelection: state.imageSelection,
  }, {
    onTranslationDone: () => rerender(state),
    onPlayTts: (item, _term, _sentence, langCode) => playTts(item, state.currentResult?.term ?? '', state.contextSentence, langCode),
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
    audioSelection: Map<string, boolean>;
    imageSelection: Map<string, boolean>;
  },
  callbacks?: {
    onTranslationDone?: (text: string) => void;
    onPlayTts?: (item: AudioItem, term: string, sentence: string, langCode: string) => void;
  },
): void {
  if (!tab) return;
  switch (tab) {
    case 'audio': {
      const langCode = result.langCode;
      const wordAudios: AudioItem[] = [
        { id: `tts-word-${result.term}`, kind: 'word', source: 'system-tts', label: `System TTS · ${langCode.toUpperCase()}`, state: 'idle', defaultSelected: true },
      ];
      const sentenceAudios: AudioItem[] = ctx.contextSentence
        ? [{ id: `tts-sentence-${result.term}`, kind: 'sentence', source: 'system-tts', label: `System TTS · Sentence`, state: 'idle', defaultSelected: false }]
        : [];
      renderAudioPanel(
        container, wordAudios, sentenceAudios, ctx.audioSelection,
        (id, selected) => { ctx.audioSelection.set(id, selected); },
        (item) => {
          if (callbacks?.onPlayTts) callbacks.onPlayTts(item, result.term, ctx.contextSentence, result.langCode);
        },
      );
      break;
    }
    case 'image':
      renderImagePanel(container, [], ctx.imageSelection, () => {}, result.term);
      break;
    case 'translate':
      renderTranslatePanel(
        container,
        ctx.translation,
        ctx.contextSentence,
        ctx.settings.translateTargetLang,
        async () => {
          const text = ctx.contextSentence || result.term;
          const sl = result.langCode;
          const tl = ctx.settings.translateTargetLang;
          if (!text || !sl || !tl) return;
          try {
            const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
            type TranslateResponse = { success: boolean; data?: { translated: string[] }; error?: string };
            const res = await sendMessage<TranslateResponse>({ type: 'TRANSLATE', payload: { text, sl, tl } });
            if (res?.success && res.data?.translated?.length) {
              const translated = res.data.translated.join(' ');
              ctx.translation = translated;
              callbacks?.onTranslationDone?.(translated);
            }
          } catch { /* best-effort */ }
        },
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
  renderPopupContent(container, state.currentResult, state.currentStatus, state.definitionSelection, {
    onStatusCycle: () => cycleStatus(state),
    onDefinitionToggle: (id, selected) => toggleDefinition(state, id, selected),
    onQuickAdd: () => void doQuickAdd(state),
    onSendToCreator: () => void sendToCreatorFromPopup(state),
    onSettings: () => openSettings(state),
  });
  // Re-append resize handle after clearContainer wiped it.
  state.shell?.reAppendResizeHandle();
  // Render winner toolbar into its slot (consistent with showPopup/appendCandidate).
  renderWinnerToolbar({ ...state, activeTab: tab }, container);
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
function showToast(message: string): void {
  // ponytail: MVP uses console.warn. Real toast = a div in Shadow DOM that
  // auto-dismisses after 3s. Upgrade: renderToast(shell, message).
  console.warn(`[popupDictionary] ${message}`);
}

/** Send to Creator — open Card Creator pre-filled with lookup result (P1.2). */
export async function sendToCreatorFromPopup(state: PopupDictionaryState): Promise<void> {
  if (!state.currentResult) return;
  const prefill = extractPrefill(
    state.currentResult,
    state.definitionSelection,
    state.contextSentence,
    state.translation ?? undefined,
  );
  await sendToCreator(prefill, state.cardCreatorSettings);
  // Hide popup after sending to Creator.
  hidePopup(state);
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

/** Play TTS using Web Speech API (available in content script). */
function playTts(item: AudioItem, term: string, sentence: string, langCode: string): void {
  if (typeof speechSynthesis === 'undefined') {
    showToast('Trình duyệt không hỗ trợ TTS');
    return;
  }
  speechSynthesis.cancel();
  const text = item.kind === 'sentence' ? sentence : term;
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode ?? 'en';
  utter.rate = 0.9;
  speechSynthesis.speak(utter);
}

/** Get the initial popup size from settings, clamped to viewport. */
export function getInitialPopupSize(settings: DictionaryPopupSettings): PopupSize {
  return clampPopupSize(
    { width: settings.popupWidthPx, maxHeight: settings.popupMaxHeightPx },
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080,
  );
}
