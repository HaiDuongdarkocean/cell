/**
 * CardCreatorPreview — design-system showcase preview for the Card Creator form.
 *
 * Renders `CardCreatorDialogContent` in panel layout with a fully local,
 * self-contained mock state (no chrome.runtime / AnkiConnect calls).
 * Shows a mock queue, sample media, and editable fields so the UI can be
 * exercised in the showcase without a background service worker.
 */
import { useState, useCallback, useRef, type ReactElement } from 'react';
import { CardCreatorDialogContent } from '@/features/cardCreator/ui/CardCreatorDialogContent';
import type { CardCreatorState, LoadStatus } from '@/features/cardCreator/ui/useCardCreatorState';
import { createEmptyDraft } from '@/features/cardCreator/state/cardDraft';
import type { CardCreatorQueueItem, Toast } from '@/features/cardCreator/types';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import { getMockCardCreatorQueue } from './showcaseFixtures';
import { SHOWCASE_DATA } from './showcaseParams';
import styles from './App.module.css';

const SILENT_WAV_BASE64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function makePlaceholderImageFile(filename: string): MediaFile {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="#f59e0b"/><circle cx="150" cy="100" r="60" fill="#fff"/></svg>`;
  const data = new TextEncoder().encode(svg).buffer;
  return { kind: 'image', filename, mimeType: 'image/svg+xml', data };
}

function makePlaceholderAudioFile(filename: string): MediaFile {
  const data = base64ToArrayBuffer(SILENT_WAV_BASE64);
  return { kind: 'audio', filename, mimeType: 'audio/wav', data };
}

const INITIAL_QUEUE = getMockCardCreatorQueue(SHOWCASE_DATA);

function initialState(): CardCreatorState {
  const queue = INITIAL_QUEUE;
  const firstItem = queue[0];
  const variant = SHOWCASE_DATA;
  const draft = createEmptyDraft('Basic', 'Default');
  return {
    draft: {
      ...draft,
      fields: {
        ...draft.fields,
        targetWord: firstItem?.term ?? '',
        sentence: variant === 'empty' ? '' : 'We found the restaurant by pure serendipity.',
        sentenceTranslation: '',
        definitions: firstItem?.definitions ?? '',
        images: variant === 'empty' ? [] : [makePlaceholderImageFile('card-preview-1.svg')],
        sentenceAudios: variant === 'empty' ? [] : [makePlaceholderAudioFile('sentence-audio.wav')],
        wordAudios: variant === 'empty' ? [] : [makePlaceholderAudioFile('word-audio.wav')],
        note: '',
        moreExample: '',
      },
      fieldMapping: {
        targetWord: 'Front',
        sentence: 'Back',
        definitions: 'Definitions',
      },
      tags: variant === 'overflow' ? Array.from({ length: 40 }, (_, i) => `tag${i + 1}`).join(', ') : 'demo, showcase',
      mediaUpdateMode: 'overwrite',
    },
    decks: ['Default', 'Learning', 'French'],
    noteTypes: ['Basic', 'Cloze', 'Audio card'],
    availableFields: ['Front', 'Back', 'Definitions', 'Tags', 'Note', 'MoreExample'],
    recentNoteId: null,
    recentNoteInfo: null,
    loadStatus: 'ready' as LoadStatus,
    loadError: '',
    submitting: false,
    capturingMedia: false,
    toasts: [],
    queueItems: queue,
    queueActiveIndex: queue.length > 0 ? 0 : -1,
    queueSidebarOpen: queue.length >= 2,
    initialAction: undefined,
    selectQueueItem: () => {},
    deleteQueueItem: () => {},
    undoDeleteQueueItem: () => {},
    toggleQueueSidebar: () => {},
    updateDraft: () => {},
    updateField: () => {},
    updateMapping: () => {},
    changeNoteType: () => {},
    changeDeck: () => {},
    addScreenshot: async () => {},
    addSentenceAudio: async () => {},
    addFileFromDisk: async () => {},
    addFiles: () => {},
    removeMedia: () => {},
    reorderMedia: () => {},
    translateSentenceField: async () => {},
    generateAll: async () => {},
    submit: async () => {},
    dismissToast: () => {},
  };
}

function useMockCardCreatorState(): CardCreatorState {
  const [state, setState] = useState<CardCreatorState>(initialState);
  const deletedRef = useRef<{ item: CardCreatorQueueItem; index: number } | null>(null);

  const pushToast = useCallback((kind: Toast['kind'], message: string): void => {
    setState((s) => ({ ...s, toasts: [...s.toasts, { id: Date.now(), kind, message }] }));
  }, []);

  const updateDraft = useCallback((partial: Parameters<CardCreatorState['updateDraft']>[0]) => {
    setState((s) => ({ ...s, draft: { ...s.draft, ...partial } }));
  }, []);

  const updateField = useCallback((key: Parameters<CardCreatorState['updateField']>[0], value: string) => {
    setState((s) => ({ ...s, draft: { ...s.draft, fields: { ...s.draft.fields, [key]: value } } }));
  }, []);

  const updateMapping = useCallback((sourceKey: keyof CardCreatorState['draft']['fieldMapping'], ankiField: string) => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, fieldMapping: { ...s.draft.fieldMapping, [sourceKey]: ankiField } },
    }));
  }, []);

  const addFiles = useCallback((kind: Parameters<CardCreatorState['addFiles']>[0], files: readonly MediaFile[]) => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, fields: { ...s.draft.fields, [kind]: [...s.draft.fields[kind], ...files] } },
    }));
  }, []);

  const removeMedia = useCallback((kind: Parameters<CardCreatorState['removeMedia']>[0], index: number) => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, fields: { ...s.draft.fields, [kind]: s.draft.fields[kind].filter((_, i) => i !== index) } },
    }));
  }, []);

  const reorderMedia = useCallback((kind: Parameters<CardCreatorState['reorderMedia']>[0], fromIndex: number, toIndex: number) => {
    setState((s) => {
      const list = [...s.draft.fields[kind]];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved as MediaFile);
      return { ...s, draft: { ...s.draft, fields: { ...s.draft.fields, [kind]: list } } };
    });
  }, []);

  const selectQueueItem = useCallback((index: number) => {
    setState((s) => {
      const item = s.queueItems[index];
      return {
        ...s,
        queueActiveIndex: index,
        draft: {
          ...s.draft,
          fields: {
            ...s.draft.fields,
            targetWord: item?.term ?? s.draft.fields.targetWord,
            definitions: item?.definitions ?? s.draft.fields.definitions,
          },
        },
      };
    });
  }, []);

  const deleteQueueItem = useCallback((index: number) => {
    setState((s) => {
      const item = s.queueItems[index];
      const next = s.queueItems.filter((_, i) => i !== index);
      deletedRef.current = { item, index };
      pushToast('warning', `Removed ${item.term} from queue`);
      return { ...s, queueItems: next, queueActiveIndex: Math.min(s.queueActiveIndex, Math.max(0, next.length - 1)) };
    });
  }, [pushToast]);

  const undoDeleteQueueItem = useCallback(() => {
    if (!deletedRef.current) return;
    const { item, index } = deletedRef.current;
    deletedRef.current = null;
    setState((s) => {
      const next = [...s.queueItems];
      next.splice(index, 0, item);
      return { ...s, queueItems: next };
    });
  }, []);

  const toggleQueueSidebar = useCallback(() => {
    setState((s) => ({ ...s, queueSidebarOpen: !s.queueSidebarOpen }));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }, []);

  const addScreenshot = useCallback(async () => {
    addFiles('images', [makePlaceholderImageFile(`screenshot-${Date.now()}.svg`)]);
  }, [addFiles]);

  const addSentenceAudio = useCallback(async () => {
    addFiles('sentenceAudios', [makePlaceholderAudioFile(`sentence-${Date.now()}.wav`)]);
  }, [addFiles]);

  const translateSentenceField = useCallback(async () => {
    updateField('sentenceTranslation', 'sự tình cờ may mắn');
  }, [updateField]);

  const submit = useCallback(async (mode: 'add' | 'update') => {
    setState((s) => ({ ...s, submitting: true }));
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    setState((s) => ({
      ...s,
      submitting: false,
      toasts: [...s.toasts, { id: Date.now(), kind: 'success', message: `${mode === 'add' ? 'Added' : 'Updated'} card` }],
    }));
  }, []);

  return {
    ...state,
    updateDraft,
    updateField,
    updateMapping,
    changeNoteType: (noteType: string) => { updateDraft({ noteType }); },
    changeDeck: (deck: string) => { updateDraft({ deck }); },
    addScreenshot,
    addSentenceAudio,
    addFileFromDisk: async () => {},
    addFiles,
    removeMedia,
    reorderMedia,
    translateSentenceField,
    submit,
    selectQueueItem,
    deleteQueueItem,
    undoDeleteQueueItem,
    toggleQueueSidebar,
    dismissToast,
  };
}

export function CardCreatorPreview(): ReactElement {
  const state = useMockCardCreatorState();

  return (
    <div className={styles.cardCreatorPreview}>
      <CardCreatorDialogContent state={state} variant="desktop" onCancel={() => {}} layout="panel" />
    </div>
  );
}
