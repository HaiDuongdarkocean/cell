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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardCreatorSettings } from '@/entities/settings';
import type { BilingualCue } from '@/entities/media';
import {
  listDecks,
  listModels,
  listModelFields,
  findRecentNote,
  getNoteInfo,
  storeMedia,
  addNote,
  updateNote,
  addNoteTags,
  ensureDefaultModel,
} from '../service/cardCreatorService';
import { autoMapFields } from '../service/fieldMapping';
import {
  createEmptyDraft,
  DraftAutosaver,
  type CardDraft,
} from '../state/cardDraft';
import { arrayBufferToBase64, joinAnkiFieldRefs, type MediaFile, type MediaKind } from '../media/mediaFile';
import { captureScreenshot } from '../media/screenshot';
import { captureSentenceAudio } from '../media/sentenceAudio';
import { translateSentence } from '../media/translation';

/** Toast notification. */
export interface Toast {
  readonly id: number;
  readonly kind: 'success' | 'error' | 'warning';
  readonly message: string;
}

/** Connection + data loading state. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Result of opening the dialog. */
export interface OpenContext {
  /** The video element to capture media from. */
  video: HTMLVideoElement;
  /** The current subtitle cue (for sentence text + audio timing). */
  cue: BilingualCue;
  /** Source language code (e.g. 'en'). */
  sourceLang: string;
  /** Target/native language code (e.g. 'vi'). */
  targetLang: string;
  /** ADR-026: media captured BEFORE the dialog opens (screenshot + sentence
   * audio). When present, the draft is initialized with these files instead
   * of empty media arrays. */
  initialMedia?: readonly MediaFile[];
}

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
  /** Initial action hint ('quick-update' = focus Update button, 'edit-card' = neutral). */
  initialAction?: 'quick-update' | 'edit-card';
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
  /** Submit: Add (create new) or Update (existing note). */
  submit: (mode: 'add' | 'update') => Promise<void>;
  /** Dismiss a toast by id. */
  dismissToast: (id: number) => void;
}

let toastIdCounter = 0;

export function useCardCreatorState(
  settings: CardCreatorSettings,
  openContext: OpenContext | null,
  initialAction?: 'quick-update' | 'edit-card',
): CardCreatorState {
  const [draft, setDraft] = useState<CardDraft>(() =>
    createEmptyDraft(settings.defaultNoteType, settings.defaultDeck),
  );
  const [decks, setDecks] = useState<readonly string[]>([]);
  const [noteTypes, setNoteTypes] = useState<readonly string[]>([]);
  const [availableFields, setAvailableFields] = useState<readonly string[]>([]);
  const [recentNoteId, setRecentNoteId] = useState<number | null>(null);
  const [recentNoteInfo, setRecentNoteInfo] = useState<{ fields: Record<string, string>; tags: string[] } | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capturingMedia, setCapturingMedia] = useState(false);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);

  const autosaverRef = useRef(new DraftAutosaver());
  const openContextRef = useRef<OpenContext | null>(openContext);
  openContextRef.current = openContext;
  // Keep a ref to the current draft so async callbacks (e.g. changeNoteType)
  // can read the latest deck without re-creating the callback on every draft
  // change.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /** Push a toast. */
  const pushToast = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, kind, message }]);
    // Auto-dismiss after 4s.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Re-check whether a recent note exists for the given deck + note type.
   *  ADR-026: called on initial load AND on note type change — the recent note
   *  is scoped to the selected note type, so switching note types must
   *  re-query AnkiConnect. Updates recentNoteId + recentNoteInfo, which
   *  drives the "No recent card" alert + the Update button's enabled state. */
  const refreshRecentNote = useCallback(
    async (deck: string, noteType: string): Promise<void> => {
      const url = settings.ankiConnectUrl;
      const recentR = await findRecentNote(url, deck, noteType);
      let recentId: number | null = null;
      let recentInfo: { fields: Record<string, string>; tags: string[] } | null = null;
      if (recentR.ok && recentR.value !== null) {
        recentId = recentR.value;
        const infoR = await getNoteInfo(url, recentR.value);
        if (infoR.ok && infoR.value) {
          recentInfo = { fields: infoR.value.fields, tags: infoR.value.tags };
        }
      }
      setRecentNoteId(recentId);
      setRecentNoteInfo(recentInfo);
    },
    [settings.ankiConnectUrl],
  );

  /** Load AnkiConnect data (decks, models, fields, recent note).
   *  @param restoredDraft - Draft restored from autosave (if any). When present,
   *    its noteType/deck/text fields/mapping/tags are preserved (ADR-026:
   *    remember user's selections across dialog open/close + browser restarts).
   */
  const loadData = useCallback(async (restoredDraft: CardDraft | null) => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    setLoadStatus('loading');
    setLoadError('');

    const url = settings.ankiConnectUrl;
    try {
      // Ensure default model exists (desktop only; Android shows error).
      const modelR = await ensureDefaultModel(url);
      if (!modelR.ok) {
        // Non-fatal: user may have a different model. Continue.
        pushToast('warning', modelR.error);
      }

      const [decksR, modelsR] = await Promise.all([
        listDecks(url),
        listModels(url),
      ]);
      if (!decksR.ok) throw new Error(decksR.error);
      if (!modelsR.ok) throw new Error(modelsR.error);

      setDecks(decksR.value);
      setNoteTypes(modelsR.value);

      // Pick note type: restored draft's (if still valid in Anki), else default,
      // else first available. ADR-026: remember user's note type selection.
      const restoredNoteType = restoredDraft?.noteType ?? '';
      const chosenNoteType =
        modelsR.value.includes(restoredNoteType)
          ? restoredNoteType
          : modelsR.value.includes(settings.defaultNoteType)
            ? settings.defaultNoteType
            : modelsR.value[0] ?? '';
      // Pick deck: same precedence — restored → default → first.
      const restoredDeck = restoredDraft?.deck ?? '';
      const chosenDeck =
        decksR.value.includes(restoredDeck)
          ? restoredDeck
          : decksR.value.includes(settings.defaultDeck)
            ? settings.defaultDeck
            : decksR.value[0] ?? '';

      // Fetch fields for chosen note type.
      let fields: readonly string[] = [];
      if (chosenNoteType) {
        const fieldsR = await listModelFields(url, chosenNoteType);
        if (fieldsR.ok) fields = fieldsR.value;
      }
      setAvailableFields(fields);

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

      // Build initial draft: preserve restored text fields (targetWord,
      // definitions, note, moreExample) + tags + mediaUpdateMode. Always
      // refresh sentence + sentenceTranslation from the current cue (the user
      // opened the dialog on a different subtitle line). Media: use
      // initialMedia captured before the dialog opened (ADR-026); fall back to
      // empty arrays if capture failed/skipped.
      const rf = restoredDraft?.fields;
      const initialImages = ctx.initialMedia?.filter((f) => f.kind === 'image') ?? [];
      const initialAudios = ctx.initialMedia?.filter((f) => f.kind === 'audio') ?? [];
      const initialDraft: CardDraft = {
        noteType: chosenNoteType,
        deck: chosenDeck,
        fields: {
          targetWord: rf?.targetWord ?? '',
          sentence: ctx.cue.targetText,
          sentenceTranslation: ctx.cue.nativeText,
          definitions: rf?.definitions ?? '',
          images: initialImages,
          sentenceAudios: initialAudios,
          wordAudios: [],
          note: rf?.note ?? '',
          moreExample: rf?.moreExample ?? '',
        },
        fieldMapping: mapping,
        tags: restoredDraft?.tags ?? settings.defaultTags,
        mediaUpdateMode: restoredDraft?.mediaUpdateMode ?? settings.mediaUpdateMode,
      };
      setDraft(initialDraft);
      setLoadStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      setLoadStatus('error');
      pushToast('error', `AnkiConnect: ${msg}`);
    }
  }, [settings, pushToast]);

  // Load data when dialog opens. Pass the restored draft to loadData so it can
  // preserve the user's note type/deck/field selections (ADR-026).
  // Guard with a ref: loadData may get a new reference when `settings` changes,
  // but we only want to load once per openContext (re-loading resets the draft
  // + would clear auto-captured media).
  const loadedForRef = useRef<OpenContext | null>(null);
  useEffect(() => {
    if (!openContext) return;
    if (loadedForRef.current === openContext) return;
    loadedForRef.current = openContext;
    const autosaver = autosaverRef.current;
    autosaver.load().then((restored) => {
      void loadData(restored ?? null);
    });
  }, [openContext, loadData]);

  // Autosave on draft change (debounced).
  useEffect(() => {
    if (loadStatus !== 'ready') return;
    autosaverRef.current.schedule(draft);
  }, [draft, loadStatus]);

  /** Update draft (triggers autosave via effect). */
  const updateDraft = useCallback((partial: Partial<CardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  /** Update a single text field. */
  const updateField = useCallback(
    (key: 'targetWord' | 'sentence' | 'sentenceTranslation' | 'definitions' | 'note' | 'moreExample', value: string) => {
      setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, [key]: value },
      }));
    },
    [],
  );

  /** Update field mapping. */
  const updateMapping = useCallback(
    (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => {
      setDraft((prev) => ({
        ...prev,
        fieldMapping: { ...prev.fieldMapping, [sourceKey]: ankiField },
      }));
    },
    [],
  );

  /** Change note type → re-fetch fields + re-map + re-check recent note. */
  const changeNoteType = useCallback(
    async (noteType: string) => {
      setDraft((prev) => ({ ...prev, noteType }));
      const fieldsR = await listModelFields(settings.ankiConnectUrl, noteType);
      if (fieldsR.ok) {
        setAvailableFields(fieldsR.value);
        const mapping = autoMapFields(fieldsR.value);
        setDraft((prev) => ({ ...prev, fieldMapping: mapping }));
      }
      // ADR-026: re-check recent note for the new note type — the recent note
      // is scoped to the note type, so switching types must re-query.
      const deck = draftRef.current.deck;
      await refreshRecentNote(deck, noteType);
    },
    [settings.ankiConnectUrl, draftRef, refreshRecentNote],
  );

  /** Change deck → re-check recent note (recent note is scoped to deck). */
  const changeDeck = useCallback(
    async (deck: string) => {
      setDraft((prev) => ({ ...prev, deck }));
      const noteType = draftRef.current.noteType;
      await refreshRecentNote(deck, noteType);
    },
    [draftRef, refreshRecentNote],
  );

  /** Add a screenshot. */
  const addScreenshot = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    setCapturingMedia(true);
    try {
      const file = await captureScreenshot(ctx.video);
      setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, images: [...prev.fields.images, file] },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `Screenshot failed: ${msg}`);
    } finally {
      setCapturingMedia(false);
    }
  }, [pushToast]);

  /** Add sentence audio for the current cue. */
  const addSentenceAudio = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    setCapturingMedia(true);
    try {
      const result = await captureSentenceAudio(ctx.video, {
        start: ctx.cue.start,
        end: ctx.cue.end,
      });
      if (result.ok) {
        setDraft((prev) => ({
          ...prev,
          fields: { ...prev.fields, sentenceAudios: [...prev.fields.sentenceAudios, result.file] },
        }));
      } else if (result.reason === 'unsupported') {
        pushToast('warning', 'Audio capture not supported on this browser. Screenshot still works.');
      } else if (result.reason === 'hidden') {
        pushToast('warning', 'Tab is hidden — audio capture skipped. Switch to the tab and try again.');
      } else {
        pushToast('error', `Audio capture failed: ${result.error ?? 'unknown'}`);
      }
    } finally {
      setCapturingMedia(false);
    }
  }, [pushToast]);

  /** Add one or more MediaFiles to the given draft list. */
  const addFiles = useCallback(
    (kind: 'images' | 'sentenceAudios' | 'wordAudios', files: readonly MediaFile[], invalidCount = 0) => {
      if (files.length === 0 && invalidCount === 0) return;
      if (files.length > 0) {
        setDraft((prev) => ({
          ...prev,
          fields: { ...prev.fields, [kind]: [...prev.fields[kind], ...files] },
        }));
      }
      if (invalidCount > 0) {
        const kindLabel = kind === 'images' ? 'images' : 'audio files';
        pushToast('warning', `Ignored ${invalidCount} unsupported file(s). Drop only ${kindLabel} here.`);
      }
    },
    [pushToast],
  );

  /** Add a media file from disk via the browser file picker.
   *  ADR-026: the "+ Add ..." buttons in each MediaList open a file picker so
   *  the user can attach their own image/audio files (e.g. a word audio from
   *  Yomitan, a custom screenshot). This is distinct from the auto-capture
   *  that runs before the dialog opens (screenshot of current frame + sentence
   *  audio for the current cue). */
  const addFileFromDisk = useCallback(
    async (kind: 'images' | 'sentenceAudios' | 'wordAudios'): Promise<void> => {
      console.log('[addFileFromDisk] called', kind);
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
        // Clean up the input element from the DOM.
        input.remove();
      }
    },
    [addFiles],
  );

  /** Remove a media file. */
  const removeMedia = useCallback(
    (kind: 'images' | 'sentenceAudios' | 'wordAudios', index: number) => {
      setDraft((prev) => ({
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
      setDraft((prev) => {
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
    if (ctx.cue.nativeText.trim()) {
      updateField('sentenceTranslation', ctx.cue.nativeText);
      return;
    }
    // Else Google Translate.
    const translated = await translateSentence(
      ctx.cue.targetText,
      ctx.sourceLang,
      ctx.targetLang,
    );
    if (translated) {
      updateField('sentenceTranslation', translated);
    } else {
      pushToast('warning', 'Translation failed. Fill in the translation manually.');
    }
  }, [updateField, pushToast]);

  /** Build the Anki note fields from the draft (apply mapping + media refs). */
  const buildAnkiFields = useCallback(
    async (): Promise<Record<string, string>> => {
      const url = settings.ankiConnectUrl;
      const fields: Record<string, string> = {};

      // Text fields.
      const textMap: Record<string, string> = {
        targetWord: draft.fields.targetWord,
        sentence: draft.fields.sentence,
        sentenceTranslation: draft.fields.sentenceTranslation,
        definitions: draft.fields.definitions,
        note: draft.fields.note,
        moreExample: draft.fields.moreExample,
      };
      for (const [sourceKey, value] of Object.entries(textMap)) {
        const ankiField = draft.fieldMapping[sourceKey as keyof typeof draft.fieldMapping];
        if (ankiField && value) {
          fields[ankiField] = value;
        }
      }

      // Media fields: upload each file + build field refs.
      const mediaGroups: Array<{
        sourceKey: 'images' | 'sentenceAudios' | 'wordAudios';
        files: readonly MediaFile[];
      }> = [
        { sourceKey: 'images', files: draft.fields.images },
        { sourceKey: 'sentenceAudios', files: draft.fields.sentenceAudios },
        { sourceKey: 'wordAudios', files: draft.fields.wordAudios },
      ];
      for (const group of mediaGroups) {
        const ankiField = draft.fieldMapping[group.sourceKey];
        if (!ankiField || group.files.length === 0) continue;
        const uploadedFiles: MediaFile[] = [];
        for (const file of group.files) {
          const base64 = arrayBufferToBase64(file.data);
          const storeR = await storeMedia(url, file.filename, base64);
          if (storeR.ok) {
            uploadedFiles.push({ ...file, filename: storeR.value });
          } else {
            pushToast('error', `Media upload failed: ${storeR.error}`);
          }
        }
        if (uploadedFiles.length > 0) {
          fields[ankiField] = joinAnkiFieldRefs(uploadedFiles);
        }
      }

      return fields;
    },
    [draft, settings.ankiConnectUrl, pushToast],
  );

  /** Submit: Add or Update. */
  const submit = useCallback(
    async (mode: 'add' | 'update') => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const url = settings.ankiConnectUrl;
        const fields = await buildAnkiFields();
        const tags = draft.tags.split(/\s+/).filter(Boolean);

        if (mode === 'add') {
          const r = await addNote(url, {
            deckName: draft.deck,
            modelName: draft.noteType,
            fields,
            tags,
          });
          if (!r.ok) throw new Error(r.error);
          if (r.value === null) {
            pushToast('warning', 'Note not added (may be a duplicate).');
          } else {
            pushToast('success', 'Card created');
            await autosaverRef.current.clear();
          }
        } else {
          // Update existing note.
          if (recentNoteId === null) {
            pushToast('error', 'No recent card to update');
            return;
          }
          // For update, we need existing fields to apply append/skip modes.
          const existing = recentNoteInfo?.fields ?? {};
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
            pushToast('warning', 'Nothing to update (all fields already filled in skip mode).');
            return;
          }
          const r = await updateNote(url, recentNoteId, updateFields, 'overwrite', existing);
          if (!r.ok) throw new Error(r.error);
          // Sync tags (desktop only; Android shows warning).
          if (tags.length > 0) {
            const tagsR = await addNoteTags(url, recentNoteId, tags);
            if (!tagsR.ok) {
              pushToast('warning', tagsR.error);
            }
          }
          pushToast('success', `Card updated (#${recentNoteId})`);
          await autosaverRef.current.clear();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast('error', `AnkiConnect: ${msg}`);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, settings.ankiConnectUrl, draft, buildAnkiFields, recentNoteId, recentNoteInfo, pushToast],
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
    initialAction,
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
    submit,
    dismissToast,
  };
}
