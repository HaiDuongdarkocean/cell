import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { nextStatus } from '../services/wordStatusStore';
import { setWordStatus } from '../services/wordStatusClient';
import { initDefinitionSelection, getSelectedDefinitions } from './popupContent';
import { buildPrefill } from './buildCandidatePrefill';
import type { MessageResponse } from '@/entities/message';
import type {
  LookupResult,
  DefinitionEntry,
  PopupTab,
  WordStatus,
  AudioItem,
  ImageItem,
  FetchCommunityAudioResponse,
  FetchImagesResponse,
  TtsFetchAudioResponse,
} from '../types';
import type { DefinitionSelection } from './popupContent';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

export interface UseCandidateOptions {
  readonly candidate: LookupResult;
  readonly contextSentence: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
}

export interface UseCandidateReturn {
  readonly status: WordStatus;
  readonly cycleStatus: () => void;
  readonly activeTab: PopupTab | null;
  readonly setActiveTab: (tab: PopupTab | null) => void;
  readonly definitionSelection: DefinitionSelection;
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  readonly selectedDefinitions: readonly DefinitionEntry[];
  readonly selectedDefinitionCount: number;
  readonly audioItems: readonly AudioItem[];
  readonly audioLoading: boolean;
  readonly audioError: string | null;
  readonly audioSelection: Map<string, boolean>;
  readonly toggleAudio: (id: string, selected: boolean) => void;
  readonly selectedAudioCount: number;
  readonly imageItems: readonly ImageItem[];
  readonly imageLoading: boolean;
  readonly imageError: string | null;
  readonly imageSelection: Map<string, boolean>;
  readonly toggleImage: (id: string, selected: boolean) => void;
  readonly removeImageItem: (id: string) => void;
  readonly selectedImageCount: number;
  readonly translation: string;
  readonly isTranslating: boolean;
  readonly translationError: string | null;
  readonly translationSelected: boolean;
  readonly toggleTranslation: () => void;
  readonly translate: () => void;
  readonly playTerm: () => void;
  readonly playSentence: () => void;
  readonly sendToCard: () => Promise<void>;
  readonly quickAdd: () => Promise<void>;
}

export function useCandidate(options: UseCandidateOptions): UseCandidateReturn {
  const { candidate, contextSentence, sourceLang, targetLang, onSendToCard, onQuickAdd } = options;

  const [activeTab, setActiveTab] = useState<PopupTab | null>(null);
  const [status, setStatus] = useState<WordStatus>(candidate.status);
  const [definitionSelection, setDefinitionSelection] = useState<DefinitionSelection>(() => initDefinitionSelection(candidate));
  const [audioItems, setAudioItems] = useState<readonly AudioItem[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSelection, setAudioSelection] = useState<Map<string, boolean>>(new Map());
  const [imageItems, setImageItems] = useState<readonly ImageItem[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<Map<string, boolean>>(new Map());
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationSelected, setTranslationSelected] = useState(false);

  useEffect(() => {
    setActiveTab(null);
    setStatus(candidate.status);
    setDefinitionSelection(initDefinitionSelection(candidate));
    setAudioItems([]);
    setAudioLoading(false);
    setAudioError(null);
    setAudioSelection(new Map());
    setImageItems([]);
    setImageLoading(false);
    setImageError(null);
    setImageSelection(new Map());
    setTranslation('');
    setIsTranslating(false);
    setTranslationError(null);
    setTranslationSelected(false);
  }, [candidate.term, candidate.langCode]);

  const selectedDefinitions = useMemo(
    () => getSelectedDefinitions(candidate, definitionSelection),
    [candidate, definitionSelection],
  );

  const selectedDefinitionCount = selectedDefinitions.length;

  const selectedAudioCount = useMemo(
    () => audioItems.filter((item) => audioSelection.get(item.id) ?? item.defaultSelected).length,
    [audioItems, audioSelection],
  );

  const selectedImageCount = useMemo(
    () => imageItems.filter((item) => imageSelection.get(item.id) ?? item.defaultSelected).length,
    [imageItems, imageSelection],
  );

  const cycleStatus = useCallback((): void => {
    const newStatus = nextStatus(status);
    setStatus(newStatus);
    void setWordStatus(candidate.langCode, candidate.term, newStatus);
  }, [candidate.langCode, candidate.term, status]);

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    setDefinitionSelection((prev) => new Map(prev).set(id, selected));
  }, []);

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

  const fetchAudio = useCallback(async (): Promise<readonly AudioItem[]> => {
    if (audioItems.length > 0) return audioItems;
    setAudioLoading(true);
    setAudioError(null);
    try {
      const [communityRes, ttsRes] = await Promise.all([
        sendMessage<MessageResponse<FetchCommunityAudioResponse>>({
          type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
          payload: { tabId: 0, term: candidate.term, langCode: candidate.langCode, kind: 'word' },
        }),
        sendMessage<MessageResponse<TtsFetchAudioResponse>>({
          type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
          payload: { tabId: 0, text: candidate.term, langCode: candidate.langCode },
        }),
      ]);

      const items: AudioItem[] = [];
      if (communityRes?.success && communityRes.data?.items) {
        items.push(...communityRes.data.items);
      }

      if (ttsRes?.success && ttsRes.data?.url) {
        items.push({
          id: `tts-sentence-${candidate.term}`,
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
      return items;
    } catch (err: unknown) {
      setAudioError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setAudioLoading(false);
    }
  }, [audioItems, candidate.langCode, candidate.term]);

  const fetchImages = useCallback(async (): Promise<readonly ImageItem[]> => {
    if (imageItems.length > 0) return imageItems;
    setImageLoading(true);
    setImageError(null);
    try {
      const response = await sendMessage<MessageResponse<FetchImagesResponse>>({
        type: MESSAGE_TYPES.FETCH_IMAGES,
        payload: { tabId: 0, term: candidate.term, langCode: candidate.langCode },
      });
      if (response?.success && response.data?.items) {
        setImageItems(response.data.items);
        setImageSelection(new Map(response.data.items.map((item) => [item.id, item.defaultSelected])));
        return response.data.items;
      }
      setImageError(response?.error ?? 'Image fetch failed');
      return [];
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setImageLoading(false);
    }
  }, [imageItems, candidate.langCode, candidate.term]);

  const translate = useCallback(async (): Promise<string> => {
    const text = contextSentence.trim() || candidate.term.trim();
    if (!text) return translation;
    if (translation) return translation;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await translateSentence(text, sourceLang, targetLang);
      setTranslation(res);
      if (!res) setTranslationError('Translation failed. Please try again.');
      return res;
    } catch (err: unknown) {
      setTranslation('');
      setTranslationError(err instanceof Error ? err.message : String(err));
      return '';
    } finally {
      setIsTranslating(false);
    }
  }, [candidate.term, contextSentence, sourceLang, targetLang, translation]);

  const toggleTranslation = useCallback((): void => {
    setTranslationSelected((prev) => !prev);
  }, []);

  const playTerm = useCallback((): void => {
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: candidate.term, langCode: candidate.langCode },
    });
  }, [candidate.langCode, candidate.term]);

  const playSentence = useCallback((): void => {
    const sentence = contextSentence.trim() || candidate.term;
    if (!sentence) return;
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: sentence, langCode: candidate.langCode },
    });
  }, [candidate.langCode, candidate.term, contextSentence]);

  useEffect(() => {
    if (activeTab === 'audio' && audioItems.length === 0 && !audioLoading) {
      void fetchAudio();
    }
    if (activeTab === 'image' && imageItems.length === 0 && !imageLoading) {
      void fetchImages();
    }
  }, [activeTab, audioItems.length, audioLoading, fetchAudio, imageItems.length, imageLoading, fetchImages]);

  const buildPrefillFromState = useCallback((
    currentAudioItems: readonly AudioItem[] = audioItems,
    currentAudioSelection: Map<string, boolean> = audioSelection,
    currentImageItems: readonly ImageItem[] = imageItems,
    currentImageSelection: Map<string, boolean> = imageSelection,
    currentTranslation: string = translation,
  ): PopupCardCreatorPrefill => buildPrefill(
    candidate,
    selectedDefinitions,
    contextSentence,
    currentTranslation,
    currentAudioItems,
    currentAudioSelection,
    currentImageItems,
    currentImageSelection,
  ), [candidate, selectedDefinitions, contextSentence, audioItems, audioSelection, imageItems, imageSelection, translation]);

  const sendToCard = useCallback(async (): Promise<void> => {
    if (!onSendToCard) return;
    const [loadedAudioItems, loadedImageItems, loadedTranslation] = await Promise.all([
      fetchAudio(),
      fetchImages(),
      translate(),
    ]);
    const currentAudioSelection = loadedAudioItems === audioItems
      ? audioSelection
      : new Map(loadedAudioItems.map((item) => [item.id, item.defaultSelected]));
    const currentImageSelection = loadedImageItems === imageItems
      ? imageSelection
      : new Map(loadedImageItems.map((item) => [item.id, item.defaultSelected]));
    onSendToCard(buildPrefillFromState(
      loadedAudioItems,
      currentAudioSelection,
      loadedImageItems,
      currentImageSelection,
      loadedTranslation,
    ));
  }, [onSendToCard, fetchAudio, fetchImages, translate, buildPrefillFromState, audioItems, audioSelection, imageItems, imageSelection]);

  const quickAdd = useCallback(async (): Promise<void> => {
    if (!onQuickAdd) return;
    const [loadedAudioItems, loadedImageItems, loadedTranslation] = await Promise.all([
      fetchAudio(),
      fetchImages(),
      translate(),
    ]);
    const currentAudioSelection = loadedAudioItems === audioItems
      ? audioSelection
      : new Map(loadedAudioItems.map((item) => [item.id, item.defaultSelected]));
    const currentImageSelection = loadedImageItems === imageItems
      ? imageSelection
      : new Map(loadedImageItems.map((item) => [item.id, item.defaultSelected]));
    onQuickAdd(buildPrefillFromState(
      loadedAudioItems,
      currentAudioSelection,
      loadedImageItems,
      currentImageSelection,
      loadedTranslation,
    ));
  }, [onQuickAdd, fetchAudio, fetchImages, translate, buildPrefillFromState, audioItems, audioSelection, imageItems, imageSelection]);

  return {
    status,
    cycleStatus,
    activeTab,
    setActiveTab,
    definitionSelection,
    toggleDefinition,
    selectedDefinitions,
    selectedDefinitionCount,
    audioItems,
    audioLoading,
    audioError,
    audioSelection,
    toggleAudio,
    selectedAudioCount,
    imageItems,
    imageLoading,
    imageError,
    imageSelection,
    toggleImage,
    removeImageItem,
    selectedImageCount,
    translation,
    isTranslating,
    translationError,
    translationSelected,
    toggleTranslation,
    translate,
    playTerm,
    playSentence,
    sendToCard,
    quickAdd,
  };
}
