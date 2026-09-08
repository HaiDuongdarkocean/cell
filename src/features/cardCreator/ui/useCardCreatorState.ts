/**
 * useCardCreatorState — state management hook for the Card Creator dialog.
 *
 * Handles:
 *  - Loading decks + note types + fields from AnkiConnect on open.
 *  - Auto-mapping fields when note type changes.
 *  - Finding the newest note for Update mode.
 *  - Draft autosave (debounced 500ms) + restore on reopen.
 *  - Add/Update actions with media upload + field mapping.
 *  - Toast feedback (success/error).
 *
 * State is owned by the global useCardCreatorStore Zustand store; this hook
 * keeps the async + UI-coupled logic and exposes the same CardCreatorState
 * shape to consumers.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { CardCreatorSettings } from '@/entities/settings';
import { useCardCreatorStore, type LoadStatus } from '@/stores/cardCreatorStore';
import {
  listModelFields,
  findRecentNote,
  getNoteInfo,
  addNote,
  updateNote,
  addNoteTags,
} from '../service/cardCreatorService';
import { buildAnkiFields } from '../service/buildAnkiFields';
import { prefetchAnkiConnectData } from '../service/cardCreatorPrefetch';
import { autoMapFields } from '../service/fieldMapping';
import { DraftAutosaver, type CardDraft } from '../state/cardDraft';
import { t } from '@/shared/i18n';
import { fetchMediaFile, type MediaFile, type MediaKind } from '../media/mediaFile';
import { captureScreenshot } from '../media/screenshot';
import { captureSentenceAudio } from '../media/sentenceAudio';
import { translateSentence } from '../media/translation';
import type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorQueueItem,
  Toast,
} from '../types';

export type OpenContext = CardCreatorOpenContext;

/** Re-export LoadStatus from the store (single source of truth). */
export type { LoadStatus } from '@/stores/cardCreatorStore';

/** Hook return type. */
export interface CardCreatorState {
  /** Draft state (note type, deck, fields, mapping, tags, mode). */
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
  /** Active toasts. */
  toasts: readonly Toast[];
  /** Whether a media capture is in progress (disables add buttons). */
  capturingMedia: boolean;
  /** Initial action hint ('quick-add' = popup Quick Add, 'quick-update' = focus Update button, 'edit-card' = neutral). */
  initialAction?: CardCreatorAction;
  /** Queue items (I+N review flow). Empty when no queue (N=1 or popup path). */
  queueItems: readonly CardCreatorQueueItem[];
  /** Active queue item index. -1 when no queue. */
  queueActiveIndex: number;
  /** Whether the queue sidebar is open (toggle state). Defaults to true when
   *  N ≥ 2, false when N ≤ 1. Persists across auto-advance. */
  queueSidebarOpen: boolean;
  /** Select a queue item by index (switches prefill). */
  selectQueueItem: (index: number) => void;
  /** Delete a queue item by index. Shows undo toast for 3s. */
  deleteQueueItem: (index: number) => void;
  /** Undo the last queue item deletion (within 3s window). */
  undoDeleteQueueItem: () => void;
  /** Toggle the queue sidebar open/closed. */
  toggleQueueSidebar: () => void;
  /** Update the draft (triggers autosave). */
  updateDraft: (partial: Partial<CardDraft>) => void;
  /** Update a single text field in the draft. */
  updateField: (key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => void;
  /** Update the field mapping for a source key. */
  updateMapping: (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => void;
  /** Change the note type (re-maps fields + re-checks recent note). */
  changeNoteType: (noteType: string) => void;
  /** Change the deck (re-checks recent note — scoped to deck). */
  changeDeck: (deck: string) => void;
  /** Add a screenshot to the images list. */
  addScreenshot: () => Promise<void>;
  /** Add sentence audio for the current cue. */
  addSentenceAudio: () => Promise<void>;
  /** Add a media file from disk (file picker). Kind determines which list +
   *  how the file is validated (image vs audio accept filter). */
  addFileFromDisk: (kind: 'images' | 'sentenceAudios' | 'wordAudios') => Promise<void>;
  /** Add one or more MediaFiles to the given list. Used by drag-and-drop. */
  addFiles: (kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[], invalidCount?: number) => void;
  /** Remove a media file by kind + index. */
  removeMedia: (kind: 'images' | 'sentenceAudios' | 'wordAudios', index: number) => void;
  /** Reorder a media file within its list (move from index to index). */
  reorderMedia: (kind: 'images' | 'sentenceAudios' | 'wordAudios', fromIndex: number, toIndex: number) => void;
  /** Translate the current sentence. */
  translateSentenceField: () => Promise<void>;
  /** Generate all missing media from the current target word / prefill. */
  generateAll: () => Promise<void>;
  /** Submit: Add (create new) or Update (existing note). */
  submit: (mode: 'add' | 'update') => Promise<void>;
  /** Dismiss a toast by id. */
  dismissToast: (id: number) => void;
}

export function useCardCreatorState(
  settings: CardCreatorSettings,
  openContext: OpenContext | null,
  initialAction?: CardCreatorAction,
): CardCreatorState {
  const {
    ankiConnectUrl,
    defaultNoteType,
    defaultDeck,
    defaultTags,
    mediaUpdateMode: defaultMediaUpdateMode,
  } = settings;

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

  // Queue actions are owned by the store; pass them through unchanged.
  const selectQueueItem = useCardCreatorStore((s) => s.selectQueueItem);
  const deleteQueueItem = useCardCreatorStore((s) => s.deleteQueueItem);
  const undoDeleteQueueItem = useCardCreatorStore((s) => s.undoDeleteQueueItem);
  const toggleQueueSidebar = useCardCreatorStore((s) => s.toggleQueueSidebar);
  const dismissToast = useCardCreatorStore((s) => s.dismissToast);

  const autosaverRef = useRef(new DraftAutosaver());
  const openContextRef = useRef<OpenContext | null>(openContext);
  openContextRef.current = openContext;

  // Sync the prop-level initialAction into the store.
  useEffect(() => {
    useCardCreatorStore.getState().setInitialAction(initialAction);
  }, [initialAction]);

  /** Re-check whether a recent note exists for the given deck + note type.
   *  ADR-026: called on initial load AND on note type change — the recent note
   *  is scoped to the selected note type, so switching note types must
   *  re-query AnkiConnect. Updates recentNoteId + recentNoteInfo, which
   *  drives the "No recent card" alert + the Update button's enabled state.
   *  Returns the fresh { id, info } so callers (e.g. submit update) can use
   *  the latest value without waiting for state to flush (avoids stale
   *  closure — see persist-config-clear-content principle). */
  const refreshRecentNote = useCallback(
    async (deck: string, noteType: string): Promise<{ id: number | null; info: { fields: Record<string, string>; tags: string[] } | null }> => {
      const recentR = await findRecentNote(ankiConnectUrl, deck, noteType);
      let recentId: number | null = null;
      let recentInfo: { fields: Record<string, string>; tags: string[] } | null = null;
      if (recentR.ok && recentR.value !== null) {
        recentId = recentR.value;
        const infoR = await getNoteInfo(ankiConnectUrl, recentR.value);
        if (infoR.ok && infoR.value) {
          recentInfo = { fields: infoR.value.fields, tags: infoR.value.tags };
        }
      }
      const store = useCardCreatorStore.getState();
      store.setRecentNoteId(recentId);
      store.setRecentNoteInfo(recentInfo);
      return { id: recentId, info: recentInfo };
    },
    [ankiConnectUrl],
  );

  /** Load AnkiConnect data (decks, models, fields, recent note).
   *  @param restoredDraft - Draft restored from autosave (if any). When present,
   *    its noteType/deck/mapping/tags are preserved (ADR-026: remember user's
   *    selections across dialog open/close + browser restarts).
   *
   *  UX: the draft is populated with cue data + defaults IMMEDIATELY (before
   *  the AnkiConnect awaits) so the form renders right away — no loading
   *  screen blocking the dialog. Dropdowns (Note type, Deck) populate when
   *  AnkiConnect data arrives; they are disabled while `loadStatus === 'loading'`.
   *
   *  Two-phase load: `destination-ready` (decks + models + chosen note type/
   *  deck resolved → Note type/Deck dropdowns enable) → `ready` (fields +
   *  recent note resolved → field rows + alerts + autosave enable). This
   *  lets the user pick note type/deck while `listModelFields` +
   *  `refreshRecentNote` are still loading.
   */
  const loadData = useCallback(async (restoredDraft: CardDraft | null) => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    const store = useCardCreatorStore.getState();
    store.setLoadStatus('loading');
    store.setLoadError('');

    // Immediately set draft with cue/prefill data + restored config + defaults
    // so the form renders right away (sentence text, media, tags visible while
    // AnkiConnect data loads in the background). Prefill (popup dictionary)
    // takes precedence over cue (subtitle) for text fields.
    const initialImages = ctx.initialMedia?.filter((f) => f.kind === 'image') ?? [];
    const initialAudios = ctx.initialMedia?.filter((f) => f.kind === 'audio') ?? [];
    const prefill = ctx.prefill;
    // Initialize queue from context. N ≥ 1 uses the first item as prefill;
    // the sidebar is only shown when N ≥ 2.
    const ctxQueue = ctx.queue;
    if (ctxQueue && ctxQueue.length >= 1) {
      store.setQueueItems(ctxQueue);
      store.setQueueActiveIndex(0);
      store.setQueueSidebarOpen(ctxQueue.length >= 2);
      // Use first queue item as prefill (overrides cue/prefill).
      const firstItem = ctxQueue[0]!;
      store.setDraft({
        noteType: restoredDraft?.noteType ?? defaultNoteType,
        deck: restoredDraft?.deck ?? defaultDeck,
        fields: {
          targetWord: firstItem.term,
          sentence: ctx.cue?.targetText ?? prefill?.sentence ?? '',
          sentenceTranslation: ctx.cue?.nativeText ?? prefill?.sentenceTranslation ?? '',
          definitions: firstItem.definitions,
          images: initialImages,
          sentenceAudios: initialAudios,
          wordAudios: [],
          note: prefill?.note ?? '',
          moreExample: prefill?.moreExample ?? '',
        },
        fieldMapping: restoredDraft?.fieldMapping ?? {},
        tags: restoredDraft?.tags ?? defaultTags,
        mediaUpdateMode: restoredDraft?.mediaUpdateMode ?? defaultMediaUpdateMode,
      });
    } else {
      // No queue → normal flow.
      store.setQueueItems([]);
      store.setQueueActiveIndex(-1);
      store.setQueueSidebarOpen(false);
      store.setDraft({
        noteType: restoredDraft?.noteType ?? defaultNoteType,
        deck: restoredDraft?.deck ?? defaultDeck,
        fields: {
          targetWord: prefill?.targetWord ?? '',
          sentence: prefill?.sentence ?? ctx.cue?.targetText ?? '',
          sentenceTranslation: prefill?.sentenceTranslation ?? ctx.cue?.nativeText ?? '',
          definitions: prefill?.definitions ?? '',
          images: initialImages,
          sentenceAudios: initialAudios,
          wordAudios: [],
          note: prefill?.note ?? '',
          moreExample: prefill?.moreExample ?? '',
        },
        fieldMapping: restoredDraft?.fieldMapping ?? {},
        tags: restoredDraft?.tags ?? defaultTags,
        mediaUpdateMode: restoredDraft?.mediaUpdateMode ?? defaultMediaUpdateMode,
      });
    }

    // Fetch prefill media URLs (word audio, sentence audio + images from popup
    // dictionary) asynchronously and append to the correct draft fields. Best-effort
    // — failures are skipped (toast warning), the dialog still opens with text fields.
    // Runs after setDraft so the form renders immediately.
    const hasMedia = (prefill?.wordAudioUrls?.length ?? 0) > 0
      || (prefill?.sentenceAudioUrls?.length ?? 0) > 0
      || (prefill?.imageUrls?.length ?? 0) > 0;
    if (hasMedia) {
      void (async () => {
        const fetchedWordAudios: MediaFile[] = [];
        const fetchedSentenceAudios: MediaFile[] = [];
        const fetchedImages: MediaFile[] = [];
        for (const audioUrl of prefill?.wordAudioUrls ?? []) {
          try {
            fetchedWordAudios.push(await fetchMediaFile(audioUrl, 'audio'));
          } catch {
            useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.wordAudio', [audioUrl]));
          }
        }
        for (const audioUrl of prefill?.sentenceAudioUrls ?? []) {
          try {
            fetchedSentenceAudios.push(await fetchMediaFile(audioUrl, 'audio'));
          } catch {
            useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.sentenceAudio', [audioUrl]));
          }
        }
        for (const imageUrl of prefill?.imageUrls ?? []) {
          try {
            fetchedImages.push(await fetchMediaFile(imageUrl, 'image'));
          } catch {
            useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.image', [imageUrl]));
          }
        }
        if (fetchedWordAudios.length > 0 || fetchedSentenceAudios.length > 0 || fetchedImages.length > 0) {
          useCardCreatorStore.getState().setDraft((prev) => ({
            ...prev,
            fields: {
              ...prev.fields,
              wordAudios: [...prev.fields.wordAudios, ...fetchedWordAudios],
              sentenceAudios: [...prev.fields.sentenceAudios, ...fetchedSentenceAudios],
              images: [...prev.fields.images, ...fetchedImages],
            },
          }));
        }
      })();
    }

    try {
      // Reuse the prefetched decks + models (started on Card Creator button
      // click so the AnkiConnect round-trip overlaps with media capture).
      // Falls back to a fresh prefetch if none in-flight (e.g. dialog opened
      // programmatically without a click). ensureDefaultModel runs inside
      // the prefetch.
      const { decks: fetchedDecks, models: fetchedModels } = await prefetchAnkiConnectData(ankiConnectUrl);
      store.setDecks(fetchedDecks);
      store.setNoteTypes(fetchedModels);

      // Pick note type: restored draft's (if still valid in Anki), else default,
      // else first available. ADR-026: remember user's note type selection.
      const restoredNoteType = restoredDraft?.noteType ?? '';
      const chosenNoteType =
        fetchedModels.includes(restoredNoteType)
          ? restoredNoteType
          : fetchedModels.includes(defaultNoteType)
            ? defaultNoteType
            : fetchedModels[0] ?? '';
      // Pick deck: same precedence — restored → default → first.
      const restoredDeck = restoredDraft?.deck ?? '';
      const chosenDeck =
        fetchedDecks.includes(restoredDeck)
          ? restoredDeck
          : fetchedDecks.includes(defaultDeck)
            ? defaultDeck
            : fetchedDecks[0] ?? '';

      // Update draft with AnkiConnect-resolved note type/deck + mark
      // destination-ready so Note type/Deck dropdowns enable immediately.
      // Field content (sentence, media) already set above is preserved.
      store.setDraft((prev) => ({
        ...prev,
        noteType: chosenNoteType,
        deck: chosenDeck,
      }));
      store.setLoadStatus('destination-ready');

      // Phase 2: fetch fields + recent note (depend on chosen note type/deck).
      // These run AFTER dropdowns are enabled so the user can interact while
      // these load. Field rows + alerts wait for `ready`.
      let fields: readonly string[] = [];
      if (chosenNoteType) {
        const fieldsR = await listModelFields(ankiConnectUrl, chosenNoteType);
        if (fieldsR.ok) fields = fieldsR.value;
      }
      store.setAvailableFields(fields);

      // Field mapping: reuse restored mapping if note type unchanged (it was
      // mapped for this note type); otherwise auto-map fresh.
      const useRestoredMapping =
        restoredDraft !== null && restoredDraft.noteType === chosenNoteType;
      const mapping = useRestoredMapping
        ? restoredDraft.fieldMapping
        : autoMapFields(fields);

      // Find recent note (delegated to refreshRecentNote so the same logic
      // runs on initial load + on note type change).
      await refreshRecentNote(chosenDeck, chosenNoteType);

      // Update field mapping now that fields are known — but only if the user
      // hasn't changed note type while we were fetching fields (race guard:
      // changeNoteType sets its own mapping for the new note type; if we
      // override here with the old note type's mapping, fields mismatch).
      if (useCardCreatorStore.getState().draft.noteType === chosenNoteType) {
        store.setDraft((prev) => ({ ...prev, fieldMapping: mapping }));
      }
      // Mark ready (enables alerts + autosave). If the user already changed
      // note type/deck, changeNoteType/changeDeck will have set ready too —
      // this is a no-op in that case.
      store.setLoadStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.setLoadError(msg);
      store.setLoadStatus('error');
      useCardCreatorStore.getState().pushToast('error', t('cardCreator.toast.ankiLoadError', [msg]));
    }
  }, [ankiConnectUrl, defaultNoteType, defaultDeck, defaultTags, defaultMediaUpdateMode, refreshRecentNote]);

  // Load data when dialog opens. Pass the restored draft to loadData so it can
  // preserve the user's note type/deck/field selections (ADR-026).
  // Guard with a ref: loadData may get a new reference when settings changes,
  // but we only want to load once per openContext (re-loading resets the draft
  // + would clear auto-captured media).
  const loadedForRef = useRef<OpenContext | null>(null);
  useEffect(() => {
    if (!openContext) return;
    if (loadedForRef.current === openContext) return;
    loadedForRef.current = openContext;
    const autosaver = autosaverRef.current;
    autosaver.load().then((restored) => {
      useCardCreatorStore.getState().reset();
      useCardCreatorStore.getState().setInitialAction(initialAction);
      void loadData(restored ?? null);
    });
  }, [openContext, loadData, initialAction]);

  // Autosave on draft change (debounced). Save as soon as the user
  // makes any selection — not only when fully 'ready' — so config
  // (noteType, deck, fieldMapping, tags, mediaUpdateMode) survives
  // even if the dialog closes before AnkiConnect finishes loading.
  useEffect(() => {
    if (loadStatus === 'idle') return;
    autosaverRef.current.schedule(draft);
  }, [draft, loadStatus]);

  // Flush pending autosave on unmount so the user's noteType/deck/fieldMapping
  // selections survive the unmount. Then reset the store to its initial state
  // (mirrors the local-state lifetime the hook had before the Zustand move).
  useEffect(() => {
    const autosaver = autosaverRef.current;
    return () => {
      void autosaver.flush();
      useCardCreatorStore.getState().reset();
    };
  }, []);

  /** Update draft (triggers autosave via effect). */
  const updateDraft = useCallback((partial: Partial<CardDraft>) => {
    useCardCreatorStore.getState().setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  /** Update a single text field. */
  const updateField = useCallback(
    (key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => {
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, [key]: value },
      }));
    },
    [],
  );

  /** Update field mapping. */
  const updateMapping = useCallback(
    (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => {
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fieldMapping: { ...prev.fieldMapping, [sourceKey]: ankiField },
      }));
    },
    [],
  );

  /** Change note type → re-fetch fields + re-map + re-check recent note. */
  const changeNoteType = useCallback(
    async (noteType: string) => {
      const store = useCardCreatorStore.getState();
      store.setDraft((prev) => ({ ...prev, noteType }));
      const fieldsR = await listModelFields(ankiConnectUrl, noteType);
      if (fieldsR.ok) {
        store.setAvailableFields(fieldsR.value);
        const mapping = autoMapFields(fieldsR.value);
        store.setDraft((prev) => ({ ...prev, fieldMapping: mapping }));
      }
      // ADR-026: re-check recent note for the new note type — the recent note
      // is scoped to the note type, so switching types must re-query.
      const deck = useCardCreatorStore.getState().draft.deck;
      await refreshRecentNote(deck, noteType);
      // Mark ready so alerts + autosave are active (loadData phase 2 may have
      // been interrupted by this change — ensure we end in a ready state).
      store.setLoadStatus('ready');
    },
    [ankiConnectUrl, refreshRecentNote],
  );

  /** Change deck → re-check recent note (recent note is scoped to deck). */
  const changeDeck = useCallback(
    async (deck: string) => {
      const store = useCardCreatorStore.getState();
      store.setDraft((prev) => ({ ...prev, deck }));
      const noteType = useCardCreatorStore.getState().draft.noteType;
      await refreshRecentNote(deck, noteType);
      store.setLoadStatus('ready');
    },
    [refreshRecentNote],
  );

  /** Add a screenshot. */
  const addScreenshot = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx?.video) return;
    const store = useCardCreatorStore.getState();
    store.setCapturingMedia(true);
    try {
      const file = await captureScreenshot(ctx.video);
      store.setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, images: [...prev.fields.images, file] },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useCardCreatorStore.getState().pushToast('error', t('cardCreator.toast.screenshotFailed', [msg]));
    } finally {
      store.setCapturingMedia(false);
    }
  }, []);

  /** Add sentence audio for the current cue. */
  const addSentenceAudio = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx?.video || !ctx.cue) return;
    const store = useCardCreatorStore.getState();
    store.setCapturingMedia(true);
    try {
      const result = await captureSentenceAudio(ctx.video, {
        start: ctx.cue.start,
        end: ctx.cue.end,
      });
      if (result.ok) {
        store.setDraft((prev) => ({
          ...prev,
          fields: { ...prev.fields, sentenceAudios: [...prev.fields.sentenceAudios, result.file] },
        }));
      } else if (result.reason === 'unsupported') {
        store.pushToast('warning', t('cardCreator.toast.audioCapture.unsupported'));
      } else if (result.reason === 'hidden') {
        store.pushToast('warning', t('cardCreator.toast.audioCapture.hidden'));
      } else {
        store.pushToast('error', t('cardCreator.toast.audioCapture.failed', [result.error ?? 'unknown']));
      }
    } finally {
      store.setCapturingMedia(false);
    }
  }, []);

  /** Add one or more MediaFiles to the given draft list. */
  const addFiles = useCallback(
    (kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[], invalidCount = 0) => {
      if (files.length === 0 && invalidCount === 0) return;
      const store = useCardCreatorStore.getState();
      if (files.length > 0) {
        store.setDraft((prev) => ({
          ...prev,
          fields: { ...prev.fields, [kind]: [...prev.fields[kind], ...files] },
        }));
      }
      if (invalidCount > 0) {
        store.pushToast(
          'warning',
          kind === 'images'
            ? t('cardCreator.toast.addFiles.invalid.image', [invalidCount])
            : t('cardCreator.toast.addFiles.invalid.audio', [invalidCount]),
        );
      }
    },
    [],
  );

  /** Add a media file from disk via the browser file picker.
   *  ADR-026: the "+ Add ..." buttons in each MediaList open a file picker so
   *  the user can attach their own image/audio files (e.g. a word audio from
   *  Yomitan, a custom screenshot). This is distinct from the auto-capture
   *  that runs before the dialog opens (screenshot of current frame + sentence
   *  audio for the current cue). */
  const addFileFromDisk = useCallback(
    async (kind: 'images' | 'sentenceAudios' | 'wordAudios'): Promise<void> => {
      const accept = kind === 'images' ? 'image/*' : 'audio/*';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = true;
      // Some browsers require the input to be in the DOM for click() to open
      // the file picker. Append it hidden, then remove after the picker closes.
      input.style.display = 'none';
      document.body.appendChild(input);
      const picked = new Promise<MediaFile[]>((resolve) => {
        input.onchange = () => {
          const files = Array.from(input.files ?? []);
          void Promise.all(
            files.map(async (f) => {
              const data = await f.arrayBuffer();
              const mediaKind: MediaKind = kind === 'images' ? 'image' : 'audio';
              // Use the user's filename (Anki will store it as-is, with the
              // Android random-suffix caveat handled in storeMediaFile).
              return {
                kind: mediaKind,
                filename: f.name,
                mimeType: f.type || (mediaKind === 'image' ? 'image/png' : 'audio/webm'),
                data,
              } satisfies MediaFile;
            }),
          ).then(resolve);
        };
        // If the user cancels the picker, the 'cancel' event fires — resolve
        // with [] so the await doesn't hang.
        input.addEventListener('cancel', () => resolve([]));
      });
      input.click();
      try {
        const mediaFiles = await picked;
        addFiles(kind, mediaFiles);
      } finally {
        input.remove();
      }
    },
    [addFiles],
  );

  /** Remove a media file. */
  const removeMedia = useCallback(
    (kind: 'images' | 'sentenceAudios' | 'wordAudios', index: number) => {
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [kind]: prev.fields[kind].filter((_, i) => i !== index),
        },
      }));
    },
    [],
  );

  /** Reorder a media file within its list (move from index to target index). */
  const reorderMedia = useCallback(
    (kind: 'images' | 'sentenceAudios' | 'wordAudios', fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      useCardCreatorStore.getState().setDraft((prev) => {
        const next = [...prev.fields[kind]];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...prev, fields: { ...prev.fields, [kind]: next } };
      });
    },
    [],
  );

  /** Translate the current sentence via Google Translate. */
  const translateSentenceField = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    // If native track already has text, use it.
    if (ctx.cue?.nativeText.trim()) {
      updateField('sentenceTranslation', ctx.cue.nativeText);
      return;
    }
    // Else Google Translate the current sentence (from cue or prefill).
    const sentence = ctx.cue?.targetText ?? ctx.prefill?.sentence ?? '';
    if (!sentence) {
      useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.translate.noSentence'));
      return;
    }
    const translated = await translateSentence(
      sentence,
      ctx.sourceLang,
      ctx.targetLang,
    );
    if (translated) {
      updateField('sentenceTranslation', translated);
    } else {
      useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.translate.failed'));
    }
  }, [updateField]);

  /** Re-fetch prefill media for any media list that is still empty.
   *  Best-effort: failed URLs are skipped with a toast. */
  const generateAll = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    const targetWord = useCardCreatorStore.getState().draft.fields.targetWord.trim();
    if (!targetWord) {
      useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.generate.noTarget'));
      return;
    }
    const prefill = ctx.prefill;
    const hasUrls = (prefill?.wordAudioUrls?.length ?? 0) > 0
      || (prefill?.sentenceAudioUrls?.length ?? 0) > 0
      || (prefill?.imageUrls?.length ?? 0) > 0;
    if (!hasUrls) {
      useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.generate.noMedia'));
      return;
    }
    useCardCreatorStore.getState().setCapturingMedia(true);
    const fetchedWordAudios: MediaFile[] = [];
    const fetchedSentenceAudios: MediaFile[] = [];
    const fetchedImages: MediaFile[] = [];
    const current = useCardCreatorStore.getState().draft.fields;
    if (current.wordAudios.length === 0) {
      for (const audioUrl of prefill?.wordAudioUrls ?? []) {
        try {
          fetchedWordAudios.push(await fetchMediaFile(audioUrl, 'audio'));
        } catch {
          useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.wordAudio', [audioUrl]));
        }
      }
    }
    if (current.sentenceAudios.length === 0) {
      for (const audioUrl of prefill?.sentenceAudioUrls ?? []) {
        try {
          fetchedSentenceAudios.push(await fetchMediaFile(audioUrl, 'audio'));
        } catch {
          useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.sentenceAudio', [audioUrl]));
        }
      }
    }
    if (current.images.length === 0) {
      for (const imageUrl of prefill?.imageUrls ?? []) {
        try {
          fetchedImages.push(await fetchMediaFile(imageUrl, 'image'));
        } catch {
          useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.fetch.image', [imageUrl]));
        }
      }
    }
    if (fetchedWordAudios.length > 0 || fetchedSentenceAudios.length > 0 || fetchedImages.length > 0) {
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          wordAudios: [...prev.fields.wordAudios, ...fetchedWordAudios],
          sentenceAudios: [...prev.fields.sentenceAudios, ...fetchedSentenceAudios],
          images: [...prev.fields.images, ...fetchedImages],
        },
      }));
      useCardCreatorStore.getState().pushToast('success', t('cardCreator.toast.generate.success'));
    } else {
      useCardCreatorStore.getState().pushToast('warning', t('cardCreator.toast.generate.empty'));
    }
    useCardCreatorStore.getState().setCapturingMedia(false);
  }, []);

  /** Build the Anki note fields from the draft (apply mapping + media refs). */
  const buildAnkiFieldsCb = useCallback(
    async (): Promise<Record<string, string>> => {
      const store = useCardCreatorStore.getState();
      return buildAnkiFields(
        ankiConnectUrl,
        store.draft.fieldMapping,
        {
          targetWord: store.draft.fields.targetWord,
          sentence: store.draft.fields.sentence,
          sentenceTranslation: store.draft.fields.sentenceTranslation,
          definitions: store.draft.fields.definitions,
          note: store.draft.fields.note,
          moreExample: store.draft.fields.moreExample,
        },
        {
          images: store.draft.fields.images,
          sentenceAudios: store.draft.fields.sentenceAudios,
          wordAudios: store.draft.fields.wordAudios,
        },
        (msg) => useCardCreatorStore.getState().pushToast('error', msg),
      );
    },
    [ankiConnectUrl],
  );

  /** Submit: Add or Update. */
  const submit = useCallback(
    async (mode: 'add' | 'update') => {
      const store = useCardCreatorStore.getState();
      if (store.submitting) return;
      store.setSubmitting(true);
      try {
        const fields = await buildAnkiFieldsCb();
        const draft = store.draft;
        const tags = draft.tags.split(/\s+/).filter(Boolean);

        if (mode === 'add') {
          const r = await addNote(ankiConnectUrl, {
            deckName: draft.deck,
            modelName: draft.noteType,
            fields,
            tags,
          });
          if (!r.ok) throw new Error(r.error);
          if (r.value === null) {
            store.pushToast('warning', t('cardCreator.toast.add.duplicate'));
          } else {
            store.pushToast('success', t('cardCreator.toast.add.success', [draft.deck, r.value]));
            await autosaverRef.current.clear();
          }
          // Queue auto-next: advance to next item or signal queue exhausted.
          const { queueItems, queueActiveIndex } = useCardCreatorStore.getState();
          if (queueItems.length > 0 && queueActiveIndex >= 0) {
            const nextIndex = queueActiveIndex + 1;
            if (nextIndex < queueItems.length) {
              const nextItem = queueItems[nextIndex]!;
              store.setQueueActiveIndex(nextIndex);
              store.setDraft((prev) => ({
                ...prev,
                fields: { ...prev.fields, targetWord: nextItem.term, definitions: nextItem.definitions },
              }));
            } else {
              store.setQueueItems([]);
              store.setQueueActiveIndex(-1);
            }
          }
        } else {
          // Update existing note. Re-query the freshest recent note id +
          // info right before updating — the cached recentNoteId may be
          // stale if the user added a card earlier in this same dialog
          // session (the new card is now the most recent). See
          // persist-config-clear-content principle (refresh-then-use,
          // don't trust cached identity).
          const fresh = await refreshRecentNote(draft.deck, draft.noteType);
          const updateNoteId = fresh.id;
          if (updateNoteId === null) {
            store.pushToast('error', t('cardCreator.toast.update.noCard', [draft.deck]));
            return;
          }
          // For update, we need existing fields to apply append/skip modes.
          const existing = fresh.info?.fields ?? {};
          const updateFields: Record<string, string> = {};
          for (const [ankiField, newValue] of Object.entries(fields)) {
            const existingValue = existing[ankiField] ?? '';
            if (draft.mediaUpdateMode === 'overwrite') {
              if (newValue) updateFields[ankiField] = newValue;
            } else if (draft.mediaUpdateMode === 'append') {
              if (newValue) {
                updateFields[ankiField] = existingValue ? `${existingValue}\n${newValue}` : newValue;
              }
            } else {
              // skip: only update if existing is empty.
              if (!existingValue && newValue) updateFields[ankiField] = newValue;
            }
          }
          if (Object.keys(updateFields).length === 0) {
            store.pushToast('warning', t('cardCreator.toast.update.skip'));
            return;
          }
          const r = await updateNote(ankiConnectUrl, updateNoteId, updateFields, 'overwrite', existing);
          if (!r.ok) throw new Error(r.error);
          // Sync tags (desktop only; Android shows warning).
          if (tags.length > 0) {
            const tagsR = await addNoteTags(ankiConnectUrl, updateNoteId, tags);
            if (!tagsR.ok) {
              store.pushToast('warning', t('cardCreator.toast.update.tagsFailed', [tagsR.error]));
            }
          }
          store.pushToast('success', t('cardCreator.toast.update.success', [updateNoteId]));
          await autosaverRef.current.clear();
          // Queue auto-next (same as Add path).
          const { queueItems, queueActiveIndex } = useCardCreatorStore.getState();
          if (queueItems.length > 0 && queueActiveIndex >= 0) {
            const nextIndex = queueActiveIndex + 1;
            if (nextIndex < queueItems.length) {
              const nextItem = queueItems[nextIndex]!;
              store.setQueueActiveIndex(nextIndex);
              store.setDraft((prev) => ({
                ...prev,
                fields: { ...prev.fields, targetWord: nextItem.term, definitions: nextItem.definitions },
              }));
            } else {
              store.setQueueItems([]);
              store.setQueueActiveIndex(-1);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (mode === 'add') {
          useCardCreatorStore.getState().pushToast('error', t('cardCreator.toast.add.error', [msg]));
        } else {
          useCardCreatorStore.getState().pushToast('error', t('cardCreator.toast.update.error', [msg]));
        }
      } finally {
        useCardCreatorStore.getState().setSubmitting(false);
      }
    },
    [ankiConnectUrl, buildAnkiFieldsCb, refreshRecentNote],
  );

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
    selectQueueItem,
    deleteQueueItem,
    undoDeleteQueueItem,
    toggleQueueSidebar,
    updateDraft,
    updateField,
    updateMapping,
    changeNoteType,
    changeDeck,
    addScreenshot,
    addSentenceAudio,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
    translateSentenceField,
    generateAll,
    submit,
    dismissToast,
  };
}
