import { useCallback, useMemo, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { nextStatus } from '../services/wordStatusStore';
import { setWordStatus } from '../services/wordStatusClient';
import { initDefinitionSelection, getSelectedDefinitions } from './popupContent';
import { buildPrefill } from './buildCandidatePrefill';
import { useDictionaryToolbar } from '../logic/useDictionaryToolbar';
import type {
  LookupResult,
  DefinitionEntry,
  PopupTab,
  WordStatus,
  AudioItem,
  ImageItem,
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
  readonly translate: () => Promise<string>;
  readonly playTerm: () => void;
  readonly playSentence: () => void;
  readonly sendToCard: () => Promise<void>;
  readonly quickAdd: () => Promise<void>;
}

export function useCandidate(options: UseCandidateOptions): UseCandidateReturn {
  const { candidate, contextSentence, sourceLang, targetLang, onSendToCard, onQuickAdd } = options;

  const [status, setStatus] = useState<WordStatus>(candidate.status);
  const [definitionSelection, setDefinitionSelection] = useState<DefinitionSelection>(() => initDefinitionSelection(candidate));

  const toolbar = useDictionaryToolbar({
    result: candidate,
    contextSentence,
    sourceLang,
    targetLang,
  });

  const selectedDefinitions = useMemo(
    () => getSelectedDefinitions(candidate, definitionSelection),
    [candidate, definitionSelection],
  );

  const selectedDefinitionCount = selectedDefinitions.length;

  const cycleStatus = useCallback((): void => {
    const newStatus = nextStatus(status);
    setStatus(newStatus);
    void setWordStatus(candidate.langCode, candidate.term, newStatus);
  }, [candidate.langCode, candidate.term, status]);

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    setDefinitionSelection((prev) => new Map(prev).set(id, selected));
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

  const sendToCard = useCallback(async (): Promise<void> => {
    if (!onSendToCard) return;
    const [loadedAudioItems, loadedImageItems, loadedTranslation] = await Promise.all([
      toolbar.fetchAudio(),
      toolbar.fetchImages(),
      toolbar.translate(),
    ]);
    const audioSelection = loadedAudioItems.length === toolbar.audioItems.length
      ? toolbar.audioSelection
      : new Map(loadedAudioItems.map((item) => [item.id, item.defaultSelected]));
    const imageSelection = loadedImageItems.length === toolbar.imageItems.length
      ? toolbar.imageSelection
      : new Map(loadedImageItems.map((item) => [item.id, item.defaultSelected]));
    onSendToCard(buildPrefill(
      candidate,
      selectedDefinitions,
      contextSentence,
      loadedTranslation,
      loadedAudioItems,
      audioSelection,
      loadedImageItems,
      imageSelection,
    ));
  }, [onSendToCard, toolbar, candidate, selectedDefinitions, contextSentence]);

  const quickAdd = useCallback(async (): Promise<void> => {
    if (!onQuickAdd) return;
    const [loadedAudioItems, loadedImageItems, loadedTranslation] = await Promise.all([
      toolbar.fetchAudio(),
      toolbar.fetchImages(),
      toolbar.translate(),
    ]);
    const audioSelection = loadedAudioItems.length === toolbar.audioItems.length
      ? toolbar.audioSelection
      : new Map(loadedAudioItems.map((item) => [item.id, item.defaultSelected]));
    const imageSelection = loadedImageItems.length === toolbar.imageItems.length
      ? toolbar.imageSelection
      : new Map(loadedImageItems.map((item) => [item.id, item.defaultSelected]));
    onQuickAdd(buildPrefill(
      candidate,
      selectedDefinitions,
      contextSentence,
      loadedTranslation,
      loadedAudioItems,
      audioSelection,
      loadedImageItems,
      imageSelection,
    ));
  }, [onQuickAdd, toolbar, candidate, selectedDefinitions, contextSentence]);

  return {
    status,
    cycleStatus,
    activeTab: toolbar.activeTab,
    setActiveTab: toolbar.setActiveTab,
    definitionSelection,
    toggleDefinition,
    selectedDefinitions,
    selectedDefinitionCount,
    audioItems: toolbar.audioItems,
    audioLoading: toolbar.audioLoading,
    audioError: toolbar.audioError,
    audioSelection: toolbar.audioSelection,
    toggleAudio: toolbar.toggleAudio,
    selectedAudioCount: toolbar.selectedAudioCount,
    imageItems: toolbar.imageItems,
    imageLoading: toolbar.imageLoading,
    imageError: toolbar.imageError,
    imageSelection: toolbar.imageSelection,
    toggleImage: toolbar.toggleImage,
    removeImageItem: toolbar.removeImageItem,
    selectedImageCount: toolbar.selectedImageCount,
    translation: toolbar.translation,
    isTranslating: toolbar.isTranslating,
    translationError: toolbar.translationError,
    translationSelected: toolbar.translationSelected,
    toggleTranslation: toolbar.toggleTranslation,
    translate: toolbar.translate,
    playTerm,
    playSentence,
    sendToCard,
    quickAdd,
  };
}
