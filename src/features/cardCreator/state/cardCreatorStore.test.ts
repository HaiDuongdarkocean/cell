import { useCardCreatorStore } from './cardCreatorStore';
import { createEmptyDraft } from './cardDraft';
import type { CardCreatorQueueItem } from '../types';
import type { MediaFile } from '../media/mediaFile';

const makeQueueItem = (
  term: string,
  definitions: string,
  status: 'unknown' | 'tracking' = 'unknown',
): CardCreatorQueueItem => ({
  term,
  definitions,
  status,
});

describe('useCardCreatorStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useCardCreatorStore.getState().reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('has correct initial state', () => {
    const state = useCardCreatorStore.getState();
    expect(state.draft).toEqual(createEmptyDraft('', ''));
    expect(state.decks).toEqual([]);
    expect(state.noteTypes).toEqual([]);
    expect(state.availableFields).toEqual([]);
    expect(state.recentNoteId).toBeNull();
    expect(state.recentNoteInfo).toBeNull();
    expect(state.loadStatus).toBe('idle');
    expect(state.loadError).toBe('');
    expect(state.submitting).toBe(false);
    expect(state.capturingMedia).toBe(false);
    expect(state.toasts).toEqual([]);
    expect(state.queueItems).toEqual([]);
    expect(state.queueActiveIndex).toBe(-1);
    expect(state.queueSidebarOpen).toBe(false);
    expect(state.initialAction).toBeUndefined();
  });

  describe('pushToast and dismissToast', () => {
    it('pushes a toast and auto-dismisses after 4s', () => {
      useCardCreatorStore.getState().pushToast('success', 'Saved');
      let state = useCardCreatorStore.getState();
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]!.message).toBe('Saved');
      expect(state.toasts[0]!.kind).toBe('success');

      jest.advanceTimersByTime(4000);
      state = useCardCreatorStore.getState();
      expect(state.toasts).toEqual([]);
    });

    it('dismisses a toast before the auto-dismiss timer fires', () => {
      useCardCreatorStore.getState().pushToast('error', 'Oops');
      const id = useCardCreatorStore.getState().toasts[0]!.id;

      jest.advanceTimersByTime(1000);
      useCardCreatorStore.getState().dismissToast(id);
      expect(useCardCreatorStore.getState().toasts).toEqual([]);

      jest.advanceTimersByTime(4000);
      expect(useCardCreatorStore.getState().toasts).toEqual([]);
    });
  });

  describe('queue actions', () => {
    it('selects a queue item and updates the draft', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
      ];
      useCardCreatorStore.getState().setQueueItems(items);
      useCardCreatorStore.getState().selectQueueItem(1);

      const state = useCardCreatorStore.getState();
      expect(state.queueActiveIndex).toBe(1);
      expect(state.draft.fields.targetWord).toBe('car');
      expect(state.draft.fields.definitions).toBe('a vehicle');
    });

    it('deletes an inactive queue item and adjusts the active index', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
        makeQueueItem('book', 'reading material'),
      ];
      useCardCreatorStore.getState().setQueueItems(items);
      useCardCreatorStore.getState().setQueueActiveIndex(2);
      useCardCreatorStore.getState().deleteQueueItem(0);

      const state = useCardCreatorStore.getState();
      expect(state.queueItems).toHaveLength(2);
      expect(state.queueItems.map((i) => i.term)).toEqual(['car', 'book']);
      expect(state.queueActiveIndex).toBe(1);
    });

    it('deletes the active queue item and advances to the next item', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
        makeQueueItem('book', 'reading material'),
      ];
      useCardCreatorStore.getState().setQueueItems(items);
      useCardCreatorStore.getState().setQueueActiveIndex(1);
      useCardCreatorStore.getState().deleteQueueItem(1);

      const state = useCardCreatorStore.getState();
      expect(state.queueItems).toHaveLength(2);
      expect(state.queueItems.map((i) => i.term)).toEqual(['apple', 'book']);
      expect(state.queueActiveIndex).toBe(1);
      expect(state.draft.fields.targetWord).toBe('book');
      expect(state.toasts[0]!.kind).toBe('warning');
    });

    it('undoes the last deletion within the 3s window', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
      ];
      useCardCreatorStore.getState().setQueueItems(items);
      useCardCreatorStore.getState().setQueueActiveIndex(1);
      useCardCreatorStore.getState().deleteQueueItem(0);

      let state = useCardCreatorStore.getState();
      expect(state.queueItems).toHaveLength(1);

      useCardCreatorStore.getState().undoDeleteQueueItem();
      state = useCardCreatorStore.getState();
      expect(state.queueItems).toHaveLength(2);
      expect(state.queueItems.map((i) => i.term)).toEqual(['apple', 'car']);
      expect(state.queueActiveIndex).toBe(0);
      expect(state.draft.fields.targetWord).toBe('apple');
    });

    const makeAudio = (name = 'a.mp3'): MediaFile => ({
      kind: 'audio',
      filename: name,
      mimeType: 'audio/mpeg',
      data: new ArrayBuffer(1),
    });
    const makeImage = (): MediaFile => ({
      kind: 'image',
      filename: 'i.png',
      mimeType: 'image/png',
      data: new ArrayBuffer(1),
    });

    it('clears term-bound word audio when selecting a different term', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
      ];
      const store = () => useCardCreatorStore.getState();
      store().setQueueItems(items);
      store().selectQueueItem(0);
      const audio = makeAudio();
      const image = makeImage();
      store().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, wordAudios: [audio], sentenceAudios: [audio], images: [image] },
      }));

      store().selectQueueItem(1);

      const state = store();
      expect(state.draft.fields.targetWord).toBe('car');
      expect(state.draft.fields.wordAudios).toEqual([]);
      // Shared cue media is preserved across item switches.
      expect(state.draft.fields.sentenceAudios).toHaveLength(1);
      expect(state.draft.fields.images).toHaveLength(1);
    });

    it('keeps word audio when re-selecting the same term', () => {
      const items = [makeQueueItem('apple', 'a fruit'), makeQueueItem('car', 'a vehicle')];
      const store = () => useCardCreatorStore.getState();
      store().setQueueItems(items);
      store().selectQueueItem(0);
      const audio = makeAudio();
      store().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, wordAudios: [audio] },
      }));

      store().selectQueueItem(0);

      expect(store().draft.fields.wordAudios).toHaveLength(1);
    });

    it('keeps word audio when deleting a non-active item (active term unchanged)', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
        makeQueueItem('book', 'reading material'),
      ];
      const store = () => useCardCreatorStore.getState();
      store().setQueueItems(items);
      store().setQueueActiveIndex(0);
      store().selectQueueItem(0);
      const audio = makeAudio();
      store().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, wordAudios: [audio] },
      }));

      store().deleteQueueItem(2);

      expect(store().draft.fields.targetWord).toBe('apple');
      expect(store().draft.fields.wordAudios).toHaveLength(1);
    });

    it('clears word audio when deleting the active item moves to a different term', () => {
      const items = [
        makeQueueItem('apple', 'a fruit'),
        makeQueueItem('car', 'a vehicle'),
      ];
      const store = () => useCardCreatorStore.getState();
      store().setQueueItems(items);
      store().setQueueActiveIndex(0);
      store().selectQueueItem(0);
      const audio = makeAudio();
      store().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, wordAudios: [audio] },
      }));

      store().deleteQueueItem(0);

      expect(store().draft.fields.targetWord).toBe('car');
      expect(store().draft.fields.wordAudios).toEqual([]);
    });

    it('toggles the queue sidebar', () => {
      expect(useCardCreatorStore.getState().queueSidebarOpen).toBe(false);
      useCardCreatorStore.getState().toggleQueueSidebar();
      expect(useCardCreatorStore.getState().queueSidebarOpen).toBe(true);
      useCardCreatorStore.getState().toggleQueueSidebar();
      expect(useCardCreatorStore.getState().queueSidebarOpen).toBe(false);
    });
  });

  it('reset restores the initial state', () => {
    const store = useCardCreatorStore.getState();
    store.setDecks(['Default']);
    store.setNoteTypes(['Basic']);
    store.setLoadStatus('ready');
    store.setQueueItems([makeQueueItem('apple', 'a fruit')]);
    store.pushToast('success', 'Done');
    store.setInitialAction('quick-add' as const);

    useCardCreatorStore.getState().reset();

    const state = useCardCreatorStore.getState();
    expect(state.draft).toEqual(createEmptyDraft('', ''));
    expect(state.decks).toEqual([]);
    expect(state.noteTypes).toEqual([]);
    expect(state.loadStatus).toBe('idle');
    expect(state.queueItems).toEqual([]);
    expect(state.queueActiveIndex).toBe(-1);
    expect(state.queueSidebarOpen).toBe(false);
    expect(state.toasts).toEqual([]);
    expect(state.initialAction).toBeUndefined();
  });
});
