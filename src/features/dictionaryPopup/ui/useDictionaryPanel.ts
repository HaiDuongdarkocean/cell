// useDictionaryPanel — React state hook for the universal panel's dictionary left pane.
//
// Sends LOOKUP_REQUEST to the background service worker because IndexedDB is
// origin-isolated: content scripts on web pages cannot access the extension's
// dictionary database. The background handler runs lookupOrchestratorMulti and
// returns the LookupResult[] list.
//
// Spec acceptance:
// - accepts langCode, sourceLang, targetLang, initialTerm, onSendToCard(prefill)
// - exposes search(term), currentResult, isLoading, error, activeTab, setActiveTab, sendToCard()
// - uses fallback:true for typed/selected-text searches
// - cancels in-flight lookups on new search / unmount via LOOKUP_CANCEL

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type {
  LookupResult,
  LookupRequest,
  PopupTab,
  WordStatus,
  DefinitionEntry,
  AudioItem,
  ImageItem,
  FetchCommunityAudioResponse,
  FetchImagesResponse,
} from '../types';
import type { MessageResponse } from '@/entities/message';
import { nextStatus } from '../services/wordStatusStore';
import { translateSentence } from '@/features/cardCreator/media/translation';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import { initDefinitionSelection, getSelectedDefinitions } from './popupContent';

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
  readonly activeTab: PopupTab | null;
  /** Open or close a dictionary tab. */
  readonly setActiveTab: (tab: PopupTab | null) => void;
  /** Current word status (mirrors currentResult.status). */
  readonly status: WordStatus;
  /** Cycle the word status to the next value and persist via background. */
  readonly cycleStatus: () => void;
  /** Translation result from the translate tab, or empty. */
  readonly translation: string;
  /** Translate the current search term/sentence. */
  readonly translate: () => void;
  /** True while translation is in progress. */
  readonly isTranslating: boolean;
  /** Error from the last translation attempt, or null. */
  readonly translationError: string | null;
  /** Audio items for the active candidate. */
  readonly audioItems: readonly AudioItem[];
  /** True while fetching audio items. */
  readonly audioLoading: boolean;
  /** Error from the last audio fetch, or null. */
  readonly audioError: string | null;
  /** Map of audio item id → selected state. */
  readonly audioSelection: Map<string, boolean>;
  /** Toggle an audio item's selected state. */
  readonly toggleAudio: (id: string, selected: boolean) => void;
  /** Fetch audio items for the active candidate. */
  readonly fetchAudio: () => void;
  /** Image items for the active candidate. */
  readonly imageItems: readonly ImageItem[];
  /** True while fetching image items. */
  readonly imageLoading: boolean;
  /** Error from the last image fetch, or null. */
  readonly imageError: string | null;
  /** Map of image id → selected state. */
  readonly imageSelection: Map<string, boolean>;
  /** Toggle an image's selected state. */
  readonly toggleImage: (id: string, selected: boolean) => void;
  /** Fetch image items for the active candidate. */
  readonly fetchImages: () => void;
  /** Build a prefill from the current result and call onSendToCard. */
  readonly sendToCard: () => void;
  /** Build a prefill from the current result and call onQuickAdd. */
  readonly quickAdd: () => void;
  /** Map of definition id → selected state for the active candidate. */
  readonly definitionSelection: Map<string, boolean>;
  /** Toggle a definition's selected state. */
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  /** Currently selected definitions for the active candidate (respects defaultSelected). */
  readonly selectedDefinitions: readonly DefinitionEntry[];
}

/** Stable ID generator for lookup request ids. */
function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Build a card-creator prefill from a lookup result.
 *  Uses selected definitions when available; falls back to all definitions. */
function buildPrefill(
  result: LookupResult,
  selectedDefinitions: readonly DefinitionEntry[],
  contextSentence: string,
  translation: string,
): PopupCardCreatorPrefill {
  const defs = selectedDefinitions.length > 0
    ? selectedDefinitions
    : result.definitions;
  return {
    term: result.term,
    langCode: result.langCode,
    reading: result.reading,
    definitions: defs.map((d) => ({ pos: d.pos, text: d.text })),
    rawDefinitions: result.rawDefinitions,
    contextSentence,
    translation: translation || undefined,
    // Phase 3 placeholder: audio/image selection is not yet implemented in the
    // universal panel. The full popup controller (popupDictionaryController)
    // handles media selection and will be wired in a later phase.
    wordAudioUrls: [],
    sentenceAudioUrls: [],
    imageUrls: [],
  };
}

export function useDictionaryPanel(options: UseDictionaryPanelOptions): UseDictionaryPanelReturn {
  const { langCode, sourceLang, targetLang, initialTerm, onSendToCard, onQuickAdd } = options;

  const [searchTerm, setSearchTerm] = useState(initialTerm ?? '');
  const [currentResult, setCurrentResult] = useState<LookupResult | null>(null);
  const [candidates, setCandidates] = useState<readonly LookupResult[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PopupTab | null>(null);
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [audioItems, setAudioItems] = useState<readonly AudioItem[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSelection, setAudioSelection] = useState<Map<string, boolean>>(new Map());
  const [imageItems, setImageItems] = useState<readonly ImageItem[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<Map<string, boolean>>(new Map());
  const [status, setStatus] = useState<WordStatus>('unknown');
  const [definitionSelection, setDefinitionSelection] = useState<Map<string, boolean>>(new Map());

  const requestIdRef = useRef<string | null>(null);
  const latestSearchRef = useRef<string>(initialTerm ?? '');

  const cancelInFlight = useCallback((): void => {
    const id = requestIdRef.current;
    if (!id) return;
    requestIdRef.current = null;
    void sendMessage({ type: MESSAGE_TYPES.LOOKUP_CANCEL, payload: { requestId: id } });
  }, []);

  const applyResult = useCallback((results: LookupResult[], searchedTerm: string): void => {
    if (results.length === 0) {
      setCurrentResult(null);
      setCandidates([]);
      setActiveCandidateIndex(0);
      setStatus('unknown');
      setDefinitionSelection(new Map());
      setTranslation('');
      setTranslationError(null);
      setAudioItems([]);
      setAudioLoading(false);
      setAudioError(null);
      setAudioSelection(new Map());
      setImageItems([]);
      setImageLoading(false);
      setImageError(null);
      setImageSelection(new Map());
      return;
    }
    const [winner, ...rest] = results;
    setCurrentResult(winner);
    setCandidates(rest);
    setActiveCandidateIndex(0);
    setStatus(winner.status);
    setDefinitionSelection(initDefinitionSelection(winner));
    setTranslation('');
    setTranslationError(null);
    setAudioItems([]);
    setAudioLoading(false);
    setAudioError(null);
    setAudioSelection(new Map());
    setImageItems([]);
    setImageLoading(false);
    setImageError(null);
    setImageSelection(new Map());
    latestSearchRef.current = searchedTerm;
  }, []);

  const search = useCallback((term: string): void => {
    const trimmed = term.trim();
    if (!trimmed) return;

    cancelInFlight();
    setSearchTerm(trimmed);
    setIsLoading(true);
    setError(null);
    setActiveTab(null);

    const requestId = makeRequestId();
    requestIdRef.current = requestId;

    const request: LookupRequest = {
      term: trimmed,
      langCode,
      contextSentence: trimmed,
      cursorOffset: 0,
      fallback: true,
    };

    void sendMessage<MessageResponse<LookupResult[]>>({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId, request },
    })
      .then((response) => {
        if (requestIdRef.current !== requestId) return; // stale
        requestIdRef.current = null;
        setIsLoading(false);
        if (response?.success && response.data) {
          applyResult(response.data, trimmed);
        } else {
          setError(response?.error ?? 'Lookup failed');
          setCurrentResult(null);
          setCandidates([]);
          setStatus('unknown');
          setDefinitionSelection(new Map());
          setTranslation('');
          setTranslationError(null);
          setAudioItems([]);
          setAudioLoading(false);
          setAudioError(null);
          setAudioSelection(new Map());
          setImageItems([]);
          setImageLoading(false);
          setImageError(null);
          setImageSelection(new Map());
        }
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        requestIdRef.current = null;
        setIsLoading(false);
        setError(err instanceof Error ? err.message : String(err));
        setCurrentResult(null);
        setCandidates([]);
        setStatus('unknown');
        setDefinitionSelection(new Map());
        setTranslation('');
        setTranslationError(null);
        setAudioItems([]);
        setAudioLoading(false);
        setAudioError(null);
        setAudioSelection(new Map());
        setImageItems([]);
        setImageLoading(false);
        setImageError(null);
        setImageSelection(new Map());
      });
  }, [langCode, cancelInFlight, applyResult]);

  const setActiveCandidate = useCallback((index: number): void => {
    const all = [currentResult, ...candidates].filter(Boolean);
    if (index < 0 || index >= all.length) return;
    const chosen = all[index]!;
    setActiveCandidateIndex(index);
    setCurrentResult(chosen);
    setStatus(chosen.status);
    setDefinitionSelection(initDefinitionSelection(chosen));
    setTranslation('');
    setTranslationError(null);
    setAudioItems([]);
    setAudioLoading(false);
    setAudioError(null);
    setAudioSelection(new Map());
    setImageItems([]);
    setImageLoading(false);
    setImageError(null);
    setImageSelection(new Map());
  }, [currentResult, candidates]);

  const cycleStatus = useCallback((): void => {
    const result = currentResult;
    if (!result) return;
    const newStatus = nextStatus(status);
    setStatus(newStatus);
    setCurrentResult({ ...result, status: newStatus });
    void sendMessage({ type: MESSAGE_TYPES.WORD_STATUS_SET, payload: { term: result.term, langCode: result.langCode, status: newStatus } });
  }, [currentResult, status]);

  const translate = useCallback((): void => {
    const text = currentResult?.term.trim() || searchTerm.trim();
    if (!text) return;
    setIsTranslating(true);
    setTranslationError(null);
    translateSentence(text, sourceLang, targetLang)
      .then((res) => {
        setTranslation(res);
        if (!res) setTranslationError('Translation failed. Please try again.');
      })
      .catch((err: unknown) => {
        setTranslation('');
        setTranslationError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { setIsTranslating(false); });
  }, [currentResult, searchTerm, sourceLang, targetLang]);

  const fetchAudio = useCallback((): void => {
    const result = currentResult;
    if (!result) return;
    setAudioLoading(true);
    setAudioError(null);
    void sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
      payload: { tabId: 0, term: result.term, langCode: result.langCode, kind: 'word' },
    })
      .then((response) => {
        if (response?.success && response.data?.items) {
          setAudioItems(response.data.items);
          setAudioSelection(new Map(response.data.items.map((item) => [item.id, item.defaultSelected])));
        } else {
          setAudioError(response?.error ?? 'Audio fetch failed');
        }
      })
      .catch((err: unknown) => { setAudioError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { setAudioLoading(false); });
  }, [currentResult]);

  const fetchImages = useCallback((): void => {
    const result = currentResult;
    if (!result) return;
    setImageLoading(true);
    setImageError(null);
    void sendMessage<MessageResponse<FetchImagesResponse>>({
      type: MESSAGE_TYPES.FETCH_IMAGES,
      payload: { tabId: 0, term: result.term, langCode: result.langCode },
    })
      .then((response) => {
        if (response?.success && response.data?.items) {
          setImageItems(response.data.items);
          setImageSelection(new Map(response.data.items.map((item) => [item.id, item.defaultSelected])));
        } else {
          setImageError(response?.error ?? 'Image fetch failed');
        }
      })
      .catch((err: unknown) => { setImageError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { setImageLoading(false); });
  }, [currentResult]);

  const toggleAudio = useCallback((id: string, selected: boolean): void => {
    setAudioSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const toggleImage = useCallback((id: string, selected: boolean): void => {
    setImageSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const selectedDefinitions = useMemo(
    () => (currentResult ? getSelectedDefinitions(currentResult, definitionSelection) : []),
    [currentResult, definitionSelection],
  );

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    setDefinitionSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const sendToCard = useCallback((): void => {
    if (!currentResult || !onSendToCard) return;
    const contextSentence = latestSearchRef.current;
    onSendToCard(buildPrefill(currentResult, selectedDefinitions, contextSentence, translation));
  }, [currentResult, selectedDefinitions, onSendToCard, translation]);

  const quickAdd = useCallback((): void => {
    if (!currentResult || !onQuickAdd) return;
    const contextSentence = latestSearchRef.current;
    onQuickAdd(buildPrefill(currentResult, selectedDefinitions, contextSentence, translation));
  }, [currentResult, selectedDefinitions, onQuickAdd, translation]);

  // Initial search when initialTerm is provided. Re-run if the prop changes
  // while the component is mounted (e.g. the panel is opened with a new term).
  useEffect(() => {
    if (initialTerm?.trim()) {
      search(initialTerm.trim());
    }
    return () => { cancelInFlight(); };
    // search/cancelInFlight are stable callbacks; only react to initialTerm changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTerm]);

  // The initial-search effect cleanup already cancels in-flight lookups on
  // unmount and on initialTerm changes, so no separate unmount effect is needed.

  return {
    searchTerm,
    setSearchTerm,
    search,
    currentResult,
    candidates,
    activeCandidateIndex,
    setActiveCandidate,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    status,
    cycleStatus,
    translation,
    translate,
    isTranslating,
    translationError,
    audioItems,
    audioLoading,
    audioError,
    audioSelection,
    toggleAudio,
    fetchAudio,
    imageItems,
    imageLoading,
    imageError,
    imageSelection,
    toggleImage,
    fetchImages,
    sendToCard,
    quickAdd,
    definitionSelection,
    toggleDefinition,
    selectedDefinitions,
  };
}
