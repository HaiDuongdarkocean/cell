// useDictionaryPanel — React state hook for the universal panel's dictionary left pane.
//
// Composes useDictionaryLookup (search + results + definitions) with
// useDictionaryToolbar (active tab + audio/image/translate + selection counts).

import { useCallback } from 'react';
import { useDictionaryLookup } from '../logic/useDictionaryLookup';
import { useDictionaryToolbar } from '../logic/useDictionaryToolbar';
import { buildPrefill } from './buildCandidatePrefill';
import type { LookupResult } from '../types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

export interface UseDictionaryPanelOptions {
  /** Language code of the dictionary being searched (e.g. 'en', 'zh'). */
  readonly langCode: string;
  /** Source / target language for the term being looked up. Usually equals langCode. */
  readonly sourceLang: string;
  /** User's native language — used for translation tab and card-creator prefill. */
  readonly targetLang: string;
  /** Optional term to search on first mount. */
  readonly initialTerm?: string;
  /** Called when the user presses "Send to Card" — receives the built prefill. */
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user presses "Quick Add" — receives the built prefill. */
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
}

export interface UseDictionaryPanelReturn {
  /** Current text in the search input (controlled). */
  readonly searchTerm: string;
  /** Update the search input text without submitting a lookup. */
  readonly setSearchTerm: (term: string) => void;
  /** Submit a dictionary lookup for the given term. */
  readonly search: (term: string) => void;
  /** Winner result from the last lookup, or null before any search. */
  readonly currentResult: LookupResult | null;
  /** Additional candidates returned by lookupOrchestratorMulti (phrase matches, surface token, lemmas). */
  readonly candidates: readonly LookupResult[];
  /** Index of the candidate currently shown as currentResult. */
  readonly activeCandidateIndex: number;
  /** Switch to a different candidate. */
  readonly setActiveCandidate: (index: number) => void;
  /** True while waiting for LOOKUP_REQUEST. */
  readonly isLoading: boolean;
  /** Error message from the last failed lookup, or null. */
  readonly error: string | null;
  /** Currently open dictionary tab (audio/image/translate/links), null when none. */
  readonly activeTab: import('../types').PopupTab | null;
  /** Open or close a dictionary tab. */
  readonly setActiveTab: (tab: import('../types').PopupTab | null) => void;
  /** Current word status (mirrors currentResult.status). */
  readonly status: import('../types').WordStatus;
  /** Cycle the word status to the next value and persist via background. */
  readonly cycleStatus: () => void;
  /** Translation result from the translate tab, or empty. */
  readonly translation: string;
  /** Translate the current search term/sentence. */
  readonly translate: () => Promise<string>;
  /** True while translation is in progress. */
  readonly isTranslating: boolean;
  /** Error from the last translation attempt, or null. */
  readonly translationError: string | null;
  /** Audio items for the active candidate. */
  readonly audioItems: readonly import('../types').AudioItem[];
  /** True while fetching audio items. */
  readonly audioLoading: boolean;
  /** Error from the last audio fetch, or null. */
  readonly audioError: string | null;
  /** Map of audio item id → selected state. */
  readonly audioSelection: Map<string, boolean>;
  /** Toggle an audio item's selected state. */
  readonly toggleAudio: (id: string, selected: boolean) => void;
  /** Image items for the active candidate. */
  readonly imageItems: readonly import('../types').ImageItem[];
  /** True while fetching image items. */
  readonly imageLoading: boolean;
  /** Error from the last image fetch, or null. */
  readonly imageError: string | null;
  /** Map of image id → selected state. */
  readonly imageSelection: Map<string, boolean>;
  /** Toggle an image's selected state. */
  readonly toggleImage: (id: string, selected: boolean) => void;
  /** Remove a broken image from the active candidate's image list. */
  readonly removeImageItem: (id: string) => void;
  /** Fetch audio items for the active candidate. */
  readonly fetchAudio: () => Promise<readonly import('../types').AudioItem[]>;
  /** Fetch image items for the active candidate. */
  readonly fetchImages: () => Promise<readonly import('../types').ImageItem[]>;
  /** Build a prefill from the current result and call onSendToCard. */
  readonly sendToCard: () => void;
  /** Build a prefill from the current result and call onQuickAdd. */
  readonly quickAdd: () => void;
  /** Build a prefill from a candidate and call onSendToCard. */
  readonly sendCandidateToCard: (index: number) => void;
  /** Build a prefill from a candidate and call onQuickAdd. */
  readonly quickAddCandidate: (index: number) => void;
  /** Map of definition id → selected state for the active candidate. */
  readonly definitionSelection: Map<string, boolean>;
  /** Toggle a definition's selected state. */
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  /** Currently selected definitions for the active candidate (respects defaultSelected). */
  readonly selectedDefinitions: readonly import('../types').DefinitionEntry[];
}

export function useDictionaryPanel(options: UseDictionaryPanelOptions): UseDictionaryPanelReturn {
  const { langCode, sourceLang, targetLang, initialTerm, onSendToCard, onQuickAdd } = options;

  const lookup = useDictionaryLookup({ langCode, sourceLang, targetLang, initialTerm });
  const toolbar = useDictionaryToolbar({
    result: lookup.currentResult,
    contextSentence: lookup.latestSearchedTerm,
    sourceLang,
    targetLang,
  });

  const { currentResult, activeCandidateIndex, candidates, selectedDefinitions, latestSearchedTerm } = lookup;

  const buildActivePrefill = useCallback((): PopupCardCreatorPrefill | null => {
    if (!currentResult) return null;
    return buildPrefill(
      currentResult,
      selectedDefinitions,
      latestSearchedTerm,
      toolbar.translation,
      toolbar.audioItems,
      toolbar.audioSelection,
      toolbar.imageItems,
      toolbar.imageSelection,
    );
  }, [currentResult, selectedDefinitions, latestSearchedTerm, toolbar.translation, toolbar.audioItems, toolbar.audioSelection, toolbar.imageItems, toolbar.imageSelection]);

  const buildCandidatePrefill = useCallback((index: number): PopupCardCreatorPrefill | null => {
    const allCandidates = [currentResult, ...candidates].filter((candidate): candidate is LookupResult => candidate !== null);
    const candidate = allCandidates[index];
    if (!candidate) return null;
    const isActive = index === activeCandidateIndex;
    return buildPrefill(
      candidate,
      isActive ? selectedDefinitions : candidate.definitions.filter((definition) => definition.defaultSelected),
      latestSearchedTerm,
      isActive ? toolbar.translation : '',
      isActive ? toolbar.audioItems : [],
      isActive ? toolbar.audioSelection : new Map(),
      isActive ? toolbar.imageItems : [],
      isActive ? toolbar.imageSelection : new Map(),
    );
  }, [activeCandidateIndex, toolbar.audioItems, toolbar.audioSelection, toolbar.imageItems, toolbar.imageSelection, toolbar.translation, candidates, currentResult, selectedDefinitions, latestSearchedTerm]);

  const sendToCard = useCallback((): void => {
    const prefill = buildActivePrefill();
    if (prefill && onSendToCard) onSendToCard(prefill);
  }, [buildActivePrefill, onSendToCard]);

  const quickAdd = useCallback((): void => {
    const prefill = buildActivePrefill();
    if (prefill && onQuickAdd) onQuickAdd(prefill);
  }, [buildActivePrefill, onQuickAdd]);

  const sendCandidateToCard = useCallback((index: number): void => {
    const prefill = buildCandidatePrefill(index);
    if (prefill && onSendToCard) onSendToCard(prefill);
  }, [buildCandidatePrefill, onSendToCard]);

  const quickAddCandidate = useCallback((index: number): void => {
    const prefill = buildCandidatePrefill(index);
    if (prefill && onQuickAdd) onQuickAdd(prefill);
  }, [buildCandidatePrefill, onQuickAdd]);

  // Expose a consistent active tab: when a new search starts, the toolbar
  // already resets its active tab to null, so no extra sync is required.

  return {
    searchTerm: lookup.searchTerm,
    setSearchTerm: lookup.setSearchTerm,
    search: lookup.search,
    currentResult,
    candidates,
    activeCandidateIndex,
    setActiveCandidate: lookup.setActiveCandidate,
    isLoading: lookup.isLoading,
    error: lookup.error,
    activeTab: toolbar.activeTab,
    setActiveTab: toolbar.setActiveTab,
    status: lookup.status,
    cycleStatus: lookup.cycleStatus,
    translation: toolbar.translation,
    translate: toolbar.translate,
    isTranslating: toolbar.isTranslating,
    translationError: toolbar.translationError,
    audioItems: toolbar.audioItems,
    audioLoading: toolbar.audioLoading,
    audioError: toolbar.audioError,
    audioSelection: toolbar.audioSelection,
    toggleAudio: toolbar.toggleAudio,
    imageItems: toolbar.imageItems,
    imageLoading: toolbar.imageLoading,
    imageError: toolbar.imageError,
    imageSelection: toolbar.imageSelection,
    toggleImage: toolbar.toggleImage,
    removeImageItem: toolbar.removeImageItem,
    fetchAudio: toolbar.fetchAudio,
    fetchImages: toolbar.fetchImages,
    sendToCard,
    quickAdd,
    sendCandidateToCard,
    quickAddCandidate,
    definitionSelection: lookup.definitionSelection,
    toggleDefinition: lookup.toggleDefinition,
    selectedDefinitions,
  };
}
