import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { mockTargetCues, mockNativeCues } from './mockCues';
import { MOCK_LOOKUP_RESULT } from './mockDictionary';
import { createEmptyDraft } from '@/features/cardCreator/state/cardDraft';
import type { CardCreatorState, LoadStatus } from '@/features/cardCreator/ui/useCardCreatorState';
import type { CardCreatorQueueItem, Toast } from '@/features/cardCreator/types';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrtCue } from '@/entities/media/types';
import type { LookupResult } from '@/features/dictionaryPopup/types';

/** Cues snapshot supplied by {@link MockCuesProvider}. */
export interface MockCuesValue {
  readonly targetCues: SrtCue[];
  readonly nativeCues: SrtCue[];
  readonly targetActiveIndex: number;
  readonly nativeActiveIndex: number;
}

export const MockCuesContext = createContext<MockCuesValue | null>(null);

export function MockCuesProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const value: MockCuesValue = useMemo(
    () => ({
      targetCues: mockTargetCues,
      nativeCues: mockNativeCues,
      targetActiveIndex: 1,
      nativeActiveIndex: 1,
    }),
    [],
  );
  return <MockCuesContext.Provider value={value}>{children}</MockCuesContext.Provider>;
}

export function useMockCues(): MockCuesValue {
  const ctx = useContext(MockCuesContext);
  if (!ctx) throw new Error('useMockCues must be used within MockCuesProvider');
  return ctx;
}

/** Dictionary snapshot supplied by {@link MockDictionaryProvider}. */
export interface MockDictionaryValue {
  readonly lookupResult: LookupResult;
}

export const MockDictionaryContext = createContext<MockDictionaryValue | null>(null);

export function MockDictionaryProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const value: MockDictionaryValue = useMemo(() => ({ lookupResult: MOCK_LOOKUP_RESULT }), []);
  return <MockDictionaryContext.Provider value={value}>{children}</MockDictionaryContext.Provider>;
}

export function useMockDictionary(): MockDictionaryValue {
  const ctx = useContext(MockDictionaryContext);
  if (!ctx) throw new Error('useMockDictionary must be used within MockDictionaryProvider');
  return ctx;
}

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

const INITIAL_QUEUE: readonly CardCreatorQueueItem[] = [
  { term: 'serendipity', definitions: 'the occurrence of events by chance in a happy or beneficial way', status: 'unknown' },
  { term: 'ephemeral', definitions: 'lasting for a very short time', status: 'tracking' },
];

function useMockCardCreatorState(): CardCreatorState {
  const [state, setState] = useState<CardCreatorState>(() => {
    const draft = createEmptyDraft('Basic', 'Default');
    return {
      draft: {
        ...draft,
        fields: {
          ...draft.fields,
          targetWord: INITIAL_QUEUE[0].term,
          sentence: 'We found the restaurant by pure serendipity.',
          sentenceTranslation: '',
          definitions: INITIAL_QUEUE[0].definitions,
          images: [makePlaceholderImageFile('card-preview-1.svg')],
          sentenceAudios: [makePlaceholderAudioFile('sentence-audio.wav')],
          wordAudios: [makePlaceholderAudioFile('word-audio.wav')],
          note: '',
          moreExample: '',
        },
        fieldMapping: {
          targetWord: 'Front',
          sentence: 'Back',
          definitions: 'Definitions',
          images: 'Image',
          sentenceAudios: 'Audio',
          wordAudios: 'Audio',
        },
        tags: 'demo, showcase',
        mediaUpdateMode: 'overwrite',
      },
      decks: ['Default', 'Learning'],
      noteTypes: ['Basic', 'Cloze'],
      availableFields: ['Front', 'Back', 'Definitions', 'Image', 'Audio', 'Note', 'Tags'],
      recentNoteId: null,
      recentNoteInfo: null,
      loadStatus: 'ready' as LoadStatus,
      loadError: '',
      submitting: false,
      capturingMedia: false,
      toasts: [],
      initialAction: undefined,
      queueItems: INITIAL_QUEUE,
      queueActiveIndex: 0,
      queueSidebarOpen: true,
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
      submit: async () => {},
      dismissToast: () => {},
    };
  });

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

  const toggleQueueSidebar = useCallback(() => {
    setState((s) => ({ ...s, queueSidebarOpen: !s.queueSidebarOpen }));
  }, []);

  const dismissToast = useCallback((id: number) => {
    setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }, []);

  const pushToast = useCallback((kind: Toast['kind'], message: string): void => {
    setState((s) => ({ ...s, toasts: [...s.toasts, { id: Date.now(), kind, message }] }));
  }, []);

  return useMemo(
    () => ({
      ...state,
      updateDraft,
      updateField,
      updateMapping,
      changeNoteType: (noteType: string) => { updateDraft({ noteType }); },
      changeDeck: (deck: string) => { updateDraft({ deck }); },
      addScreenshot: async () => { addFiles('images', [makePlaceholderImageFile(`screenshot-${Date.now()}.svg`)]); },
      addSentenceAudio: async () => { addFiles('sentenceAudios', [makePlaceholderAudioFile(`sentence-${Date.now()}.wav`)]); },
      addFileFromDisk: async () => {},
      addFiles,
      removeMedia,
      reorderMedia: () => {},
      translateSentenceField: async () => { updateField('sentenceTranslation', 'sự tình cờ may mắn'); },
      submit: async (mode: 'add' | 'update') => {
        setState((s) => ({ ...s, submitting: true }));
        await new Promise((resolve) => { setTimeout(resolve, 300); });
        setState((s) => ({
          ...s,
          submitting: false,
          toasts: [...s.toasts, { id: Date.now(), kind: 'success', message: `${mode === 'add' ? 'Added' : 'Updated'} card` }],
        }));
      },
      selectQueueItem,
      deleteQueueItem: (index: number) => {
        setState((s) => {
          const item = s.queueItems[index];
          if (!item) return s;
          const next = s.queueItems.filter((_, i) => i !== index);
          pushToast('warning', `Removed ${item.term} from queue`);
          return { ...s, queueItems: next, queueActiveIndex: Math.min(s.queueActiveIndex, Math.max(0, next.length - 1)) };
        });
      },
      undoDeleteQueueItem: () => {},
      toggleQueueSidebar,
      dismissToast,
    }),
    [state, updateDraft, updateField, updateMapping, addFiles, removeMedia, selectQueueItem, toggleQueueSidebar, pushToast, dismissToast],
  );
}

export const MockCardCreatorContext = createContext<CardCreatorState | null>(null);

export function MockCardCreatorProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const state = useMockCardCreatorState();
  return <MockCardCreatorContext.Provider value={state}>{children}</MockCardCreatorContext.Provider>;
}

export function useMockCardCreator(): CardCreatorState {
  const ctx = useContext(MockCardCreatorContext);
  if (!ctx) throw new Error('useMockCardCreator must be used within MockCardCreatorProvider');
  return ctx;
}

/** Combined mock provider for the design-system showcase. */
export function MockProviders({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <MockCuesProvider>
      <MockDictionaryProvider>
        <MockCardCreatorProvider>{children}</MockCardCreatorProvider>
      </MockDictionaryProvider>
    </MockCuesProvider>
  );
}
