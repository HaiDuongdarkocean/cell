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
  readonly sendToCard: () => void;
  readonly quickAdd: () => void;
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

  const fetchAudio = useCallback((): void => {
    setAudioLoading(true);
    setAudioError(null);
    void (async (): Promise<void> => {
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
      } catch (err: unknown) {
        setAudioError(err instanceof Error ? err.message : String(err));
      } finally {
        setAudioLoading(false);
      }
    })();
  }, [candidate.langCode, candidate.term]);

  const fetchImages = useCallback((): void => {
    setImageLoading(true);
    setImageError(null);
    void sendMessage<MessageResponse<FetchImagesResponse>>({
      type: MESSAGE_TYPES.FETCH_IMAGES,
      payload: { tabId: 0, term: candidate.term, langCode: candidate.langCode },
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
  }, [candidate.langCode, candidate.term]);

  const translate = useCallback((): void => {
    const text = contextSentence.trim() || candidate.term.trim();
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
  }, [candidate.term, contextSentence, sourceLang, targetLang]);

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
      fetchAudio();
    }
    if (activeTab === 'image' && imageItems.length === 0 && !imageLoading) {
      fetchImages();
    }
  }, [activeTab, audioItems.length, audioLoading, fetchAudio, imageItems.length, imageLoading, fetchImages]);

  const prefill = useMemo(
    () => buildPrefill(
      candidate,
      selectedDefinitions,
      contextSentence,
      translation,
      audioItems,
      audioSelection,
      imageItems,
      imageSelection,
    ),
    [candidate, selectedDefinitions, contextSentence, translation, audioItems, audioSelection, imageItems, imageSelection],
  );

  const sendToCard = useCallback((): void => {
    if (onSendToCard) onSendToCard(prefill);
  }, [onSendToCard, prefill]);

  const quickAdd = useCallback((): void => {
    if (onQuickAdd) onQuickAdd(prefill);
  }, [onQuickAdd, prefill]);

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
