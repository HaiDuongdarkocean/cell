import { useCallback, useEffect, useRef } from 'react';
import type { CardCreatorSettings } from '@/entities/settings';
import { useCardCreatorStore, type LoadStatus } from '../state/cardCreatorStore';
import type { CardDraft } from '../state/cardDraft';
import type { MediaListKind, TextFieldKey } from '../state/mediaListKinds';
import type { MediaFile } from '../media/mediaFile';
import { useAnkiSchema } from './useAnkiSchema';
import { useDraftOps } from './useDraftOps';
import { useMediaLists } from './useMediaLists';
import { useGenerateActions } from './useGenerateActions';
import { useSubmitNote } from './useSubmitNote';
import type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorQueueItem,
  Toast,
} from '../types';

export type OpenContext = CardCreatorOpenContext;

export type { LoadStatus } from '../state/cardCreatorStore';

export interface CardCreatorState {
  draft: CardDraft;
  decks: readonly string[];
  noteTypes: readonly string[];
  availableFields: readonly string[];
  recentNoteId: number | null;
  recentNoteInfo: { fields: Record<string, string>; tags: string[] } | null;
  loadStatus: LoadStatus;
  loadError: string;
  submitting: boolean;
  toasts: readonly Toast[];
  capturingMedia: boolean;
  initialAction?: CardCreatorAction;
  queueItems: readonly CardCreatorQueueItem[];
  queueActiveIndex: number;
  queueSidebarOpen: boolean;
  sourceLang: string;
  selectQueueItem: (index: number) => void;
  lookupTerm: (term: string) => void;
  deleteQueueItem: (index: number) => void;
  undoDeleteQueueItem: () => void;
  toggleQueueSidebar: () => void;
  updateDraft: (partial: Partial<CardDraft>) => void;
  updateField: (key: TextFieldKey, value: string) => void;
  updateMapping: (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => void;
  changeNoteType: (noteType: string) => void;
  changeDeck: (deck: string) => void;
  addScreenshot: () => Promise<void>;
  addSentenceAudio: () => Promise<void>;
  addFileFromDisk: (kind: MediaListKind) => Promise<void>;
  addFiles: (kind: MediaListKind, files: readonly MediaFile[], invalidCount?: number) => void;
  removeMedia: (kind: MediaListKind, index: number) => void;
  reorderMedia: (kind: MediaListKind, fromIndex: number, toIndex: number) => void;
  translateSentenceField: () => Promise<void>;
  generateField: (key: keyof CardDraft['fields']) => Promise<void>;
  generateAll: () => Promise<void>;
  submit: (mode: 'add' | 'update') => Promise<void>;
  reload: () => void;
  dismissToast: (id: number) => void;
  clear: () => void;
}

export interface UseCardCreatorStateOptions {
  onSubmitSuccess?: () => void;
  onQueueTermSelect?: (term: string) => void;
}

export function useCardCreatorState(
  settings: CardCreatorSettings,
  openContext: OpenContext | null,
  initialAction?: CardCreatorAction,
  options?: UseCardCreatorStateOptions,
): CardCreatorState {
  const draft = useCardCreatorStore((s) => s.draft);
  const decks = useCardCreatorStore((s) => s.decks);
  const noteTypes = useCardCreatorStore((s) => s.noteTypes);
  const availableFields = useCardCreatorStore((s) => s.availableFields);
  const recentNoteId = useCardCreatorStore((s) => s.recentNoteId);
  const recentNoteInfo = useCardCreatorStore((s) => s.recentNoteInfo);
  const loadStatus = useCardCreatorStore((s) => s.loadStatus);
  const loadError = useCardCreatorStore((s) => s.loadError);
  const submitting = useCardCreatorStore((s) => s.submitting);
  const capturingMedia = useCardCreatorStore((s) => s.capturingMedia);
  const toasts = useCardCreatorStore((s) => s.toasts);
  const queueItems = useCardCreatorStore((s) => s.queueItems);
  const queueActiveIndex = useCardCreatorStore((s) => s.queueActiveIndex);
  const queueSidebarOpen = useCardCreatorStore((s) => s.queueSidebarOpen);
  const storeInitialAction = useCardCreatorStore((s) => s.initialAction);

  const selectQueueItemStore = useCardCreatorStore((s) => s.selectQueueItem);
  const deleteQueueItem = useCardCreatorStore((s) => s.deleteQueueItem);
  const undoDeleteQueueItem = useCardCreatorStore((s) => s.undoDeleteQueueItem);
  const toggleQueueSidebar = useCardCreatorStore((s) => s.toggleQueueSidebar);
  const dismissToast = useCardCreatorStore((s) => s.dismissToast);

  const onQueueTermSelectRef = useRef(options?.onQueueTermSelect);
  useEffect(() => { onQueueTermSelectRef.current = options?.onQueueTermSelect; }, [options?.onQueueTermSelect]);
  const openContextRef = useRef<OpenContext | null>(openContext);
  openContextRef.current = openContext;

  const {
    refreshRecentNote,
    persistFieldMapping,
    clearSavedDraft,
    changeNoteType,
    changeDeck,
    reload,
  } = useAnkiSchema({
    settings,
    openContext,
    initialAction,
    openContextRef,
    onQueueTermSelectRef,
  });

  const { updateDraft, updateField, updateMapping, clear } = useDraftOps({
    persistFieldMapping,
  });

  const {
    addScreenshot,
    addSentenceAudio,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
  } = useMediaLists({ openContextRef });

  const { translateSentenceField, generateField, generateAll } = useGenerateActions({
    openContextRef,
    updateField,
  });

  const { submit } = useSubmitNote({
    ankiConnectUrl: settings.ankiConnectUrl,
    onSubmitSuccess: options?.onSubmitSuccess,
    refreshRecentNote,
    clearSavedDraft,
  });

  const selectQueueItem = useCallback((index: number) => {
    selectQueueItemStore(index);
    const term = useCardCreatorStore.getState().queueItems[index]?.term;
    if (term) onQueueTermSelectRef.current?.(term);
    void generateAll();
  }, [selectQueueItemStore, generateAll]);

  const lookupTerm = useCallback((term: string) => {
    if (term.trim()) onQueueTermSelectRef.current?.(term.trim());
  }, []);

  return {
    draft,
    decks,
    noteTypes,
    availableFields,
    recentNoteId,
    recentNoteInfo,
    loadStatus,
    loadError,
    submitting,
    capturingMedia,
    toasts,
    initialAction: storeInitialAction,
    queueItems,
    queueActiveIndex,
    queueSidebarOpen,
    sourceLang: openContext?.sourceLang ?? 'en',
    selectQueueItem,
    lookupTerm,
    deleteQueueItem,
    undoDeleteQueueItem,
    toggleQueueSidebar,
    updateDraft,
    updateField,
    updateMapping,
    changeNoteType: (noteType: string) => { void changeNoteType(noteType); },
    changeDeck: (deck: string) => { void changeDeck(deck); },
    addScreenshot,
    addSentenceAudio,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
    clear,
    translateSentenceField,
    generateField,
    generateAll,
    submit,
    reload,
    dismissToast,
  };
}
