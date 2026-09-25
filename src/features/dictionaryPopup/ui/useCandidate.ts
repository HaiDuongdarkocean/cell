import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { nextStatus } from '@/features/dictionary/services/wordStatusStore';
import { setWordStatus } from '@/features/dictionary/services/wordStatusClient';
import {
  initDefinitionSelection,
  initExampleSelection,
  getSelectedDefinitions,
} from '../logic/definitionSelection';
import { buildPrefill } from './buildCandidatePrefill';
import { useDictionaryToolbar } from '../logic/useDictionaryToolbar';
import type {
  LookupResult,
  DefinitionEntry,
  PopupTab,
  WordStatus,
  AudioItem,
  ImageItem,
  ExternalDictLink,
  PopupCardCreatorPrefill,
  PopupSelectionSnapshot,
} from '@/entities/dictionary';
import type { DefinitionSelection, ExampleSelection } from '../logic/definitionSelection';

export interface UseCandidateOptions {
  readonly candidate: LookupResult;
  readonly contextSentence: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called when the user cycles the word status inside this candidate. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Default media tab to open when this candidate first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** Optional popup selection snapshot used to clone checked state. */
  readonly selectionSnapshot?: PopupSelectionSnapshot;
  /** Pre-loaded audio items for this candidate (popup clone). */
  readonly initialAudioItems?: readonly AudioItem[];
  /** Pre-loaded image items for this candidate (popup clone). */
  readonly initialImageItems?: readonly ImageItem[];
  /** Preload media/translation for the integrated panel. */
  readonly preloadMedia?: boolean;
}

export interface UseCandidateReturn {
  readonly status: WordStatus;
  readonly cycleStatus: () => void;
  readonly activeTab: PopupTab | null;
  readonly setActiveTab: (tab: PopupTab | null) => void;
  readonly definitionSelection: DefinitionSelection;
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  readonly exampleSelection: ExampleSelection;
  readonly toggleExample: (defId: string, index: number, selected: boolean) => void;
  readonly selectedDefinitions: readonly DefinitionEntry[];
  readonly selectedDefinitionCount: number;
  readonly audioItems: readonly AudioItem[];
  readonly audioLoading: boolean;
  readonly audioError: string | null;
  readonly localAudioNeedsRegrant: boolean;
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
  readonly links: readonly ExternalDictLink[];
  readonly selectedLinkCount: number;
  readonly translation: string;
  readonly isTranslating: boolean;
  readonly translationError: string | null;
  readonly translationSelected: boolean;
  readonly toggleTranslation: () => void;
  readonly translate: () => Promise<string>;
  readonly selectedTranslationCount: number;
  readonly playTerm: () => void;
  readonly playSentence: () => void;
  readonly sendToCard: () => Promise<void>;
  readonly quickAdd: () => Promise<void>;
}

export function useCandidate(options: UseCandidateOptions): UseCandidateReturn {
  const {
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onStatusChange,
    defaultActiveTab,
    selectionSnapshot,
    initialAudioItems,
    initialImageItems,
    preloadMedia,
  } = options;

  // The snapshot prop is typed as PopupSelectionSnapshot for callers, but the
  // runtime value passed from the integrated panel is a full PopupCardCreatorPrefill
  // (or DictionaryPanelPrefill). Cast so we can access audio/image items + translation.
  const fullSnapshot = selectionSnapshot as (PopupSelectionSnapshot & Partial<PopupCardCreatorPrefill>) | undefined;

  const [status, setStatus] = useState<WordStatus>(candidate.status);
  const [prevCandidateStatus, setPrevCandidateStatus] = useState(candidate.status);
  // Render-time resync: an external status edit (e.g. the 1-4 keyboard path →
  // mount.setStatus → syncStatus) lands as a new candidate object — mirror it
  // without the post-mount stomp a useEffect would cause on fresh mounts.
  if (prevCandidateStatus !== candidate.status) {
    setPrevCandidateStatus(candidate.status);
    setStatus(candidate.status);
  }
  const selectedDefinitionIds = fullSnapshot?.selectedDefinitionIds;
  const selectedExampleIds = fullSnapshot?.selectedExampleIds;
  const [definitionSelection, setDefinitionSelection] = useState<DefinitionSelection>(
    () => initDefinitionSelection(candidate, selectedDefinitionIds),
  );
  const [exampleSelection, setExampleSelection] = useState<Map<string, Set<number>>>(
    () => initExampleSelection(candidate, selectedExampleIds),
  );

  // Re-initialize definition selection when the candidate identity (term + lang)
  // or the incoming selection snapshot changes. This keeps the integrated
  // Dictionary in sync without wiping user toggles on a simple status cycle.
  const selectionKeyRef = useRef(
    JSON.stringify([candidate.langCode, candidate.term, selectedDefinitionIds ?? null, selectedExampleIds ?? null]),
  );
  useEffect(() => {
    const key = JSON.stringify([candidate.langCode, candidate.term, selectedDefinitionIds ?? null, selectedExampleIds ?? null]);
    if (selectionKeyRef.current === key) return;
    selectionKeyRef.current = key;
    setDefinitionSelection(initDefinitionSelection(candidate, selectedDefinitionIds));
    setExampleSelection(initExampleSelection(candidate, selectedExampleIds));
  }, [candidate, selectedDefinitionIds, selectedExampleIds]);

  const effectiveAudioItems = initialAudioItems ?? fullSnapshot?.audioItems;
  const effectiveImageItems = initialImageItems ?? fullSnapshot?.imageItems;

  const initialAudioSelection = useMemo(() => {
    const items = effectiveAudioItems;
    const selectedIds = fullSnapshot?.selectedAudioIds;
    if (!items || items.length === 0) return null;
    const selectedSet = selectedIds ? new Set(selectedIds) : null;
    const map = new Map<string, boolean>();
    for (const item of items) {
      map.set(item.id, selectedSet ? selectedSet.has(item.id) : false);
    }
    return map;
  }, [effectiveAudioItems, fullSnapshot?.selectedAudioIds]);

  const initialImageSelection = useMemo(() => {
    const items = effectiveImageItems;
    const selectedIds = fullSnapshot?.selectedImageIds;
    if (!items || items.length === 0) return null;
    const selectedSet = selectedIds ? new Set(selectedIds) : null;
    const map = new Map<string, boolean>();
    for (const item of items) {
      map.set(item.id, selectedSet ? selectedSet.has(item.id) : false);
    }
    return map;
  }, [effectiveImageItems, fullSnapshot?.selectedImageIds]);

  const initialTranslation = fullSnapshot?.translation;
  const initialTranslationSelected = fullSnapshot?.translationSelected;

  const toolbar = useDictionaryToolbar({
    result: candidate,
    contextSentence,
    sourceLang,
    targetLang,
    defaultActiveTab,
    initialAudioItems: effectiveAudioItems,
    initialImageItems: effectiveImageItems,
    initialAudioSelection,
    initialImageSelection,
    initialTranslation,
    initialTranslationSelected,
    preloadMedia,
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
    onStatusChange?.(candidate.term, candidate.langCode, newStatus);
  }, [candidate.langCode, candidate.term, status, onStatusChange]);

  const [includeAllExamples, setIncludeAllExamples] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSettings()
      .then((s) => {
        if (!alive) return;
        setIncludeAllExamples(s.dictionaryPopup?.includeAllExamplesOnDefSelect ?? false);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    setDefinitionSelection((prev) => new Map(prev).set(id, selected));
    setExampleSelection((prev) => {
      const next = new Map(prev);
      if (selected && includeAllExamples) {
        const def = candidate.definitions.find((d) => d.id === id);
        next.set(id, new Set((def?.examples ?? []).map((_, i) => i)));
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [candidate, includeAllExamples]);

  const toggleExample = useCallback((defId: string, index: number, selected: boolean): void => {
    setExampleSelection((prev) => {
      const next = new Map(prev);
      const indices = new Set(prev.get(defId) ?? []);
      if (selected) indices.add(index); else indices.delete(index);
      next.set(defId, indices);
      return next;
    });
    if (selected) {
      setDefinitionSelection((prev) => (
        prev.get(defId) === true ? prev : new Map(prev).set(defId, true)
      ));
    }
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
    onSendToCard(buildPrefill(
      candidate,
      selectedDefinitions,
      exampleSelection,
      contextSentence,
      toolbar.translation,
      toolbar.audioItems,
      toolbar.audioSelection,
      toolbar.imageItems,
      toolbar.imageSelection,
      toolbar.translationSelected,
    ));
  }, [onSendToCard, toolbar, candidate, selectedDefinitions, exampleSelection, contextSentence]);

  const quickAdd = useCallback(async (): Promise<void> => {
    if (!onQuickAdd) return;
    onQuickAdd(buildPrefill(
      candidate,
      selectedDefinitions,
      exampleSelection,
      contextSentence,
      toolbar.translation,
      toolbar.audioItems,
      toolbar.audioSelection,
      toolbar.imageItems,
      toolbar.imageSelection,
      toolbar.translationSelected,
    ));
  }, [onQuickAdd, toolbar, candidate, selectedDefinitions, exampleSelection, contextSentence]);

  return {
    status,
    cycleStatus,
    activeTab: toolbar.activeTab,
    setActiveTab: toolbar.setActiveTab,
    definitionSelection,
    toggleDefinition,
    exampleSelection,
    toggleExample,
    selectedDefinitions,
    selectedDefinitionCount,
    audioItems: toolbar.audioItems,
    audioLoading: toolbar.audioLoading,
    audioError: toolbar.audioError,
    localAudioNeedsRegrant: toolbar.localAudioNeedsRegrant,
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
    links: toolbar.links,
    selectedLinkCount: toolbar.selectedLinkCount,
    translation: toolbar.translation,
    isTranslating: toolbar.isTranslating,
    translationError: toolbar.translationError,
    translationSelected: toolbar.translationSelected,
    toggleTranslation: toolbar.toggleTranslation,
    translate: toolbar.translate,
    selectedTranslationCount: toolbar.selectedTranslationCount,
    playTerm,
    playSentence,
    sendToCard,
    quickAdd,
  };
}
