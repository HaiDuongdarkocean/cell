// useDictionaryPanel — React state hook for the universal panel's dictionary left pane.
//
// Composes useDictionaryLookup (search + results + definitions) with
// dictionary toolbar concerns: translate, audio, image, card-creator actions.

import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type {
  LookupResult,
  PopupTab,
  AudioItem,
  ImageItem,
  FetchCommunityAudioResponse,
  FetchImagesResponse,
  TtsFetchAudioResponse,
} from '../types';
import type { MessageResponse } from '@/entities/message/types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import { buildPrefill } from './buildCandidatePrefill';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { useDictionaryLookup } from '../logic/useDictionaryLookup';

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
  readonly status: import('../types').WordStatus;
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
  /** Remove a broken image from the active candidate's image list. */
  readonly removeImageItem: (id: string) => void;
  /** Fetch audio items for the active candidate. */
  readonly fetchAudio: () => void;
  /** Fetch image items for the active candidate. */
  readonly fetchImages: () => void;
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

  const { currentResult, activeCandidateIndex, candidates, selectedDefinitions, latestSearchedTerm } = lookup;

  const translate = useCallback((): void => {
    const text = currentResult?.term.trim() || lookup.searchTerm.trim();
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
  }, [currentResult, lookup.searchTerm, sourceLang, targetLang]);

  const fetchAudio = useCallback((): void => {
    const result = currentResult;
    if (!result) return;
    setAudioLoading(true);
    setAudioError(null);
    void (async (): Promise<void> => {
      try {
        const [communityRes, ttsRes] = await Promise.all([
          sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
            type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
            payload: { tabId: 0, term: result.term, langCode: result.langCode, kind: 'word' },
          }),
          sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: result.term, langCode: result.langCode },
          }),
        ]);

        const items: AudioItem[] = [];
        if (communityRes?.success && communityRes.data?.items) {
          items.push(...communityRes.data.items);
        }

        if (ttsRes?.success && ttsRes.data?.url) {
          items.push({
            id: `tts-sentence-${result.term}`,
            kind: 'sentence',
            source: 'system-tts',
            label: 'System TTS · Sentence',
            state: 'idle',
            url: ttsRes.data.url,
            defaultSelected: false,
          });
        }

        if (items.length === 0) {
          setAudioError(communityRes?.error ?? 'Audio fetch failed');
        }
        setAudioItems(items);
        setAudioSelection(new Map(items.map((item) => [item.id, item.defaultSelected])));
      } catch (err: unknown) {
        setAudioError(err instanceof Error ? err.message : String(err));
      } finally {
        setAudioLoading(false);
      }
    })();
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

  const removeImageItem = useCallback((id: string): void => {
    setImageItems((prev) => prev.filter((item) => item.id !== id));
    setImageSelection((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const buildActivePrefill = useCallback((): PopupCardCreatorPrefill | null => {
    if (!currentResult) return null;
    return buildPrefill(
      currentResult,
      selectedDefinitions,
      latestSearchedTerm,
      translation,
      audioItems,
      audioSelection,
      imageItems,
      imageSelection,
    );
  }, [currentResult, selectedDefinitions, latestSearchedTerm, translation, audioItems, audioSelection, imageItems, imageSelection]);

  const buildCandidatePrefill = useCallback((index: number): PopupCardCreatorPrefill | null => {
    const allCandidates = [currentResult, ...candidates].filter((candidate): candidate is LookupResult => candidate !== null);
    const candidate = allCandidates[index];
    if (!candidate) return null;
    const isActive = index === activeCandidateIndex;
    return buildPrefill(
      candidate,
      isActive ? selectedDefinitions : candidate.definitions.filter((definition) => definition.defaultSelected),
      latestSearchedTerm,
      isActive ? translation : '',
      isActive ? audioItems : [],
      isActive ? audioSelection : new Map(),
      isActive ? imageItems : [],
      isActive ? imageSelection : new Map(),
    );
  }, [activeCandidateIndex, audioItems, audioSelection, candidates, currentResult, imageItems, imageSelection, selectedDefinitions, translation, latestSearchedTerm]);

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

  // Clear subordinate tab data when the active candidate changes or a new
  // search starts, so stale audio/image/translation don't persist across results.
  useEffect(() => {
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
  }, [currentResult]);

  // Reset active tab when search starts so the UI doesn't show a stale tab.
  useEffect(() => {
    if (lookup.isLoading) {
      setActiveTab(null);
    }
  }, [lookup.isLoading]);

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
    activeTab,
    setActiveTab,
    status: lookup.status,
    cycleStatus: lookup.cycleStatus,
    translation,
    translate,
    isTranslating,
    translationError,
    audioItems,
    audioLoading,
    audioError,
    audioSelection,
    toggleAudio,
    imageItems,
    imageLoading,
    imageError,
    imageSelection,
    toggleImage,
    removeImageItem,
    fetchAudio,
    fetchImages,
    sendToCard,
    quickAdd,
    sendCandidateToCard,
    quickAddCandidate,
    definitionSelection: lookup.definitionSelection,
    toggleDefinition: lookup.toggleDefinition,
    selectedDefinitions,
  };
}
