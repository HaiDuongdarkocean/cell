import { create } from 'zustand';
import { t } from '@/shared/i18n';
import {
  createEmptyDraft,
  type CardDraft,
} from '@/features/cardCreator/state/cardDraft';
import type {
  CardCreatorAction,
  CardCreatorQueueItem,
  Toast,
} from '@/features/cardCreator/types';

export type LoadStatus =
  | 'idle'
  | 'loading'
  | 'destination-ready'
  | 'ready'
  | 'error';

type DraftUpdater = CardDraft | ((prev: CardDraft) => CardDraft);
type ToastsUpdater =
  | readonly Toast[]
  | ((prev: readonly Toast[]) => readonly Toast[]);
type QueueItemsUpdater =
  | readonly CardCreatorQueueItem[]
  | ((prev: readonly CardCreatorQueueItem[]) => readonly CardCreatorQueueItem[]);
type QueueActiveIndexUpdater = number | ((prev: number) => number);

interface CardCreatorStore {
  /** Card draft (note type, deck, fields, mapping, tags, mode). */
  draft: CardDraft;
  /** Available decks from AnkiConnect. */
  decks: readonly string[];
  /** Available note types from AnkiConnect. */
  noteTypes: readonly string[];
  /** Available Anki field names for the current note type. */
  availableFields: readonly string[];
  /** Newest note id in the selected deck + note type, or null if none. */
  recentNoteId: number | null;
  /** Recent note info (fields + tags) or null. */
  recentNoteInfo: { fields: Record<string, string>; tags: string[] } | null;
  /** Load status for the AnkiConnect data. */
  loadStatus: LoadStatus;
  /** Error message if loadStatus === 'error'. */
  loadError: string;
  /** Whether an Add/Update action is in progress. */
  submitting: boolean;
  /** Whether a media capture is in progress (disables add buttons). */
  capturingMedia: boolean;
  /** Active toasts. */
  toasts: readonly Toast[];
  /** Initial action hint. */
  initialAction: CardCreatorAction | undefined;
  /** Queue items (I+N review flow). */
  queueItems: readonly CardCreatorQueueItem[];
  /** Active queue item index. -1 when no queue. */
  queueActiveIndex: number;
  /** Whether the queue sidebar is open. */
  queueSidebarOpen: boolean;

  /** Replace the draft. */
  setDraft: (next: DraftUpdater) => void;
  /** Replace the available decks. */
  setDecks: (decks: readonly string[]) => void;
  /** Replace the available note types. */
  setNoteTypes: (noteTypes: readonly string[]) => void;
  /** Replace the available fields for the current note type. */
  setAvailableFields: (availableFields: readonly string[]) => void;
  /** Set the most recent note id. */
  setRecentNoteId: (recentNoteId: number | null) => void;
  /** Set the most recent note info. */
  setRecentNoteInfo: (
    recentNoteInfo: { fields: Record<string, string>; tags: string[] } | null,
  ) => void;
  /** Set the load status. */
  setLoadStatus: (loadStatus: LoadStatus) => void;
  /** Set the load error message. */
  setLoadError: (loadError: string) => void;
  /** Set whether a submit is in progress. */
  setSubmitting: (submitting: boolean) => void;
  /** Set whether a media capture is in progress. */
  setCapturingMedia: (capturingMedia: boolean) => void;
  /** Replace all toasts. */
  setToasts: (next: ToastsUpdater) => void;
  /** Set the initial action hint. */
  setInitialAction: (initialAction: CardCreatorAction | undefined) => void;
  /** Replace the queue items. */
  setQueueItems: (next: QueueItemsUpdater) => void;
  /** Set the active queue item index. */
  setQueueActiveIndex: (next: QueueActiveIndexUpdater) => void;
  /** Set whether the queue sidebar is open. */
  setQueueSidebarOpen: (queueSidebarOpen: boolean) => void;

  /** Select a queue item by index (switches prefill). */
  selectQueueItem: (index: number) => void;
  /** Delete a queue item by index. Shows undo toast for 3s. */
  deleteQueueItem: (index: number) => void;
  /** Undo the last queue item deletion (within 3s window). */
  undoDeleteQueueItem: () => void;
  /** Toggle the queue sidebar open/closed. */
  toggleQueueSidebar: () => void;

  /** Push a new toast. Auto-dismiss after 4s. */
  pushToast: (kind: Toast['kind'], message: string, undoable?: boolean) => void;
  /** Dismiss a toast by id. */
  dismissToast: (id: number) => void;

  /** Reset the store to its initial state. */
  reset: () => void;
}

let toastIdCounter = 0;
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

interface UndoBuffer {
  item: CardCreatorQueueItem;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

let undoBuffer: UndoBuffer | null = null;

const createInitialData = () => ({
  draft: createEmptyDraft('', ''),
  decks: [] as readonly string[],
  noteTypes: [] as readonly string[],
  availableFields: [] as readonly string[],
  recentNoteId: null as number | null,
  recentNoteInfo: null as { fields: Record<string, string>; tags: string[] } | null,
  loadStatus: 'idle' as LoadStatus,
  loadError: '',
  submitting: false,
  capturingMedia: false,
  toasts: [] as readonly Toast[],
  initialAction: undefined as CardCreatorAction | undefined,
  queueItems: [] as readonly CardCreatorQueueItem[],
  queueActiveIndex: -1,
  queueSidebarOpen: false,
});

export const useCardCreatorStore = create<CardCreatorStore>((set, get) => ({
  ...createInitialData(),

  setDraft: (next) =>
    set((state) => ({
      draft: typeof next === 'function' ? next(state.draft) : next,
    })),

  setDecks: (decks) => set({ decks }),
  setNoteTypes: (noteTypes) => set({ noteTypes }),
  setAvailableFields: (availableFields) => set({ availableFields }),
  setRecentNoteId: (recentNoteId) => set({ recentNoteId }),
  setRecentNoteInfo: (recentNoteInfo) => set({ recentNoteInfo }),
  setLoadStatus: (loadStatus) => set({ loadStatus }),
  setLoadError: (loadError) => set({ loadError }),
  setSubmitting: (submitting) => set({ submitting }),
  setCapturingMedia: (capturingMedia) => set({ capturingMedia }),
  setToasts: (next) =>
    set((state) => ({
      toasts: typeof next === 'function' ? next(state.toasts) : next,
    })),
  setInitialAction: (initialAction) => set({ initialAction }),
  setQueueItems: (next) =>
    set((state) => ({
      queueItems: typeof next === 'function' ? next(state.queueItems) : next,
    })),
  setQueueActiveIndex: (next) =>
    set((state) => ({
      queueActiveIndex:
        typeof next === 'function' ? next(state.queueActiveIndex) : next,
    })),
  setQueueSidebarOpen: (queueSidebarOpen) => set({ queueSidebarOpen }),

  selectQueueItem: (index) => {
    const { queueItems, draft } = get();
    if (index < 0 || index >= queueItems.length) return;
    const item = queueItems[index]!;
    set({
      queueActiveIndex: index,
      draft: {
        ...draft,
        fields: {
          ...draft.fields,
          targetWord: item.term,
          definitions: item.definitions,
        },
      },
    });
  },

  deleteQueueItem: (index) => {
    const state = get();
    const items = state.queueItems;
    if (index < 0 || index >= items.length) return;
    const deleted = items[index]!;
    const next = items.filter((_, i) => i !== index);

    if (undoBuffer) clearTimeout(undoBuffer.timer);
    const timer = setTimeout(() => {
      undoBuffer = null;
    }, 3000);
    undoBuffer = { item: deleted, index, timer };

    let newActive = state.queueActiveIndex;
    if (newActive === index) {
      newActive = next.length > 0 ? Math.min(index, next.length - 1) : -1;
    } else if (newActive > index) {
      newActive -= 1;
    }

    let nextDraft = state.draft;
    if (next.length > 0) {
      const activeItem = next[newActive]!;
      nextDraft = {
        ...state.draft,
        fields: {
          ...state.draft.fields,
          targetWord: activeItem.term,
          definitions: activeItem.definitions,
        },
      };
    }

    set({
      queueItems: next,
      queueActiveIndex: newActive,
      draft: nextDraft,
    });
    get().pushToast('warning', t('cardCreator.queue.removed', [deleted.term]), true);
  },

  undoDeleteQueueItem: () => {
    if (!undoBuffer) return;
    clearTimeout(undoBuffer.timer);
    const { item, index } = undoBuffer;
    undoBuffer = null;
    set((state) => ({
      queueItems: [
        ...state.queueItems.slice(0, index),
        item,
        ...state.queueItems.slice(index),
      ],
      queueActiveIndex: index,
      draft: {
        ...state.draft,
        fields: {
          ...state.draft.fields,
          targetWord: item.term,
          definitions: item.definitions,
        },
      },
    }));
  },

  toggleQueueSidebar: () =>
    set((state) => ({ queueSidebarOpen: !state.queueSidebarOpen })),

  pushToast: (kind, message, undoable = false) => {
    const id = ++toastIdCounter;
    const timer = setTimeout(() => {
      get().dismissToast(id);
    }, 4000);
    toastTimers.set(id, timer);
    set((state) => ({
      toasts: [...state.toasts, { id, kind, message, undoable }],
    }));
  },

  dismissToast: (id) => {
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  reset: () => {
    for (const [id, timer] of toastTimers) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    if (undoBuffer) {
      clearTimeout(undoBuffer.timer);
      undoBuffer = null;
    }
    set(createInitialData());
  },
}));
