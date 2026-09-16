import { useCallback, useEffect, useRef } from 'react';
import type { CardCreatorSettings } from '@/entities/settings';
import { useCardCreatorStore, type LoadStatus } from '../state/cardCreatorStore';
import {
  addNote,
  updateNote,
  addNoteTags,
} from '../service/cardCreatorService';
import { buildAnkiFields } from '../service/buildAnkiFields';
import { prefetchAnkiConnectData, onAnkiSchemaRefreshed } from '../service/cardCreatorPrefetch';
import { getModelFields } from '../service/ankiSchemaCache';
import {
  fetchRecentNote,
  resolveSchemaChoice,
  runWithSchemaRetry,
} from '../service/ankiSchemaService';
import {
  FieldMappingWriter,
  resolveFieldMapping,
} from '../service/fieldMappingService';
import { computeFieldUpdates, splitTags } from '../service/noteUpdate';
import { pickMediaFilesFromDisk } from '../service/mediaFilePicker';
import { lookupDictionaryResources } from '../service/dictionaryGenerate';
import type { FieldMapping } from '../service/fieldMapping';
import { DraftAutosaver, type CardDraft } from '../state/cardDraft';
import { buildInitialDraft } from '../state/initialDraft';
import {
  fetchMediaList,
  mergePrefillMedia,
  mergePrefillTextFields,
  prefillHasMedia,
  type PrefillDraftAccess,
} from '../state/prefillMerge';
import {
  generateSourceKey,
  hasGenerateSourceData,
  isPrefillUsableForTerm,
} from '../state/generateSource';
import {
  mediaUrlKeyMap,
  type GenerateFieldKey,
  type MediaListKind,
  type TextFieldKey,
} from '../state/mediaListKinds';
import { t, type MessageKey } from '@/shared/i18n';
import type { MediaFile } from '../media/mediaFile';
import { captureScreenshot } from '../media/screenshot';
import { captureSentenceAudio } from '../media/sentenceAudio';
import { translateSentence } from '../media/translation';
import type {
  CardCreatorAction,
  CardCreatorOpenContext,
  CardCreatorPrefill,
  CardCreatorQueueItem,
  Toast,
} from '../types';

export type OpenContext = CardCreatorOpenContext;

const fieldLabelMap = {
  targetWord: 'cardCreator.field.targetWord',
  sentence: 'cardCreator.field.sentence',
  sentenceTranslation: 'cardCreator.field.sentenceTranslation',
  definitions: 'cardCreator.field.definitions',
  images: 'cardCreator.field.image',
  sentenceAudios: 'cardCreator.field.sentenceAudio',
  wordAudios: 'cardCreator.field.wordAudio',
  note: 'cardCreator.field.note',
  moreExample: 'cardCreator.field.moreExample',
} as const satisfies Record<GenerateFieldKey, MessageKey>;

const SETTINGS_RELOAD_DEBOUNCE_MS = 300;

const prefillDraftAccess: PrefillDraftAccess = {
  getDraft: () => useCardCreatorStore.getState().draft,
  setDraft: (updater) => useCardCreatorStore.getState().setDraft(updater),
  warn: (message) => useCardCreatorStore.getState().pushToast('warning', message),
};

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

function isSameOpenContextSession(a: OpenContext, b: OpenContext): boolean {
  return (
    a.video === b.video &&
    a.cue === b.cue &&
    a.sourceLang === b.sourceLang &&
    a.targetLang === b.targetLang &&
    a.initialMedia === b.initialMedia &&
    a.queue === b.queue
  );
}

export function useCardCreatorState(
  settings: CardCreatorSettings,
  openContext: OpenContext | null,
  initialAction?: CardCreatorAction,
  options?: UseCardCreatorStateOptions,
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

  const selectQueueItemStore = useCardCreatorStore((s) => s.selectQueueItem);
  const deleteQueueItem = useCardCreatorStore((s) => s.deleteQueueItem);
  const undoDeleteQueueItem = useCardCreatorStore((s) => s.undoDeleteQueueItem);
  const toggleQueueSidebar = useCardCreatorStore((s) => s.toggleQueueSidebar);
  const dismissToast = useCardCreatorStore((s) => s.dismissToast);

  const autosaverRef = useRef(new DraftAutosaver());
  const fieldMappingWriterRef = useRef(new FieldMappingWriter());
  const onSubmitSuccessRef = useRef(options?.onSubmitSuccess);
  const onQueueTermSelectRef = useRef(options?.onQueueTermSelect);
  useEffect(() => { onSubmitSuccessRef.current = options?.onSubmitSuccess; }, [options?.onSubmitSuccess]);
  useEffect(() => { onQueueTermSelectRef.current = options?.onQueueTermSelect; }, [options?.onQueueTermSelect]);
  const openContextRef = useRef<OpenContext | null>(openContext);
  openContextRef.current = openContext;

  const fieldMappingsRef = useRef(settings.fieldMappings);
  fieldMappingsRef.current = settings.fieldMappings;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const loadedSettingsKeyRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const persistFieldMapping = useCallback((noteType: string, mapping: FieldMapping) => {
    fieldMappingWriterRef.current.persist(noteType, mapping);
  }, []);

  useEffect(() => {
    useCardCreatorStore.getState().setInitialAction(initialAction);
  }, [initialAction]);

  const refreshRecentNote = useCallback(
    async (deck: string, noteType: string) => {
      const fresh = await fetchRecentNote(ankiConnectUrl, deck, noteType);
      const store = useCardCreatorStore.getState();
      store.setRecentNoteId(fresh.id);
      store.setRecentNoteInfo(fresh.info);
      return fresh;
    },
    [ankiConnectUrl],
  );

  const loadAnkiData = useCallback(
    async (
      restored: Pick<CardDraft, 'noteType' | 'deck' | 'fieldMapping'> | null,
    ): Promise<void> => {
      const store = useCardCreatorStore.getState();
      loadedSettingsKeyRef.current = JSON.stringify(settings);
      const generation = ++loadGenerationRef.current;
      store.setLoadStatus('loading');
      store.setLoadError('');

      try {
        const { decks: fetchedDecks, models: fetchedModels } = await prefetchAnkiConnectData(ankiConnectUrl);
        if (generation !== loadGenerationRef.current) return;
        store.setDecks(fetchedDecks);
        store.setNoteTypes(fetchedModels);

        const chosenNoteType = resolveSchemaChoice(
          fetchedModels,
          restored?.noteType ?? '',
          defaultNoteType,
        );
        const chosenDeck = resolveSchemaChoice(
          fetchedDecks,
          restored?.deck ?? '',
          defaultDeck,
        );

        store.setDraft((prev) => ({
          ...prev,
          noteType: chosenNoteType,
          deck: chosenDeck,
        }));
        store.setLoadStatus('destination-ready');

        const fields = chosenNoteType
          ? (await getModelFields(ankiConnectUrl, chosenNoteType)) ?? []
          : [];
        if (generation !== loadGenerationRef.current) return;
        store.setAvailableFields(fields);

        const savedMapping = fieldMappingsRef.current?.[chosenNoteType];
        const restoredMapping =
          !savedMapping && restored !== null && restored.noteType === chosenNoteType
            ? restored.fieldMapping
            : undefined;
        const { mapping, shouldPersist } = resolveFieldMapping(
          fields,
          savedMapping,
          restoredMapping,
        );

        if (shouldPersist) {
          persistFieldMapping(chosenNoteType, mapping);
        }

        await refreshRecentNote(chosenDeck, chosenNoteType);
        if (generation !== loadGenerationRef.current) return;

        if (useCardCreatorStore.getState().draft.noteType === chosenNoteType) {
          store.setDraft((prev) => ({ ...prev, fieldMapping: mapping }));
        }
        store.setLoadStatus('ready');
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        store.setLoadError(msg);
        store.setLoadStatus('error');
        useCardCreatorStore.getState().pushToast('error', t('cardCreator.toast.ankiLoadError', [msg]));
      }
    },
    [ankiConnectUrl, defaultNoteType, defaultDeck, settings, refreshRecentNote, persistFieldMapping],
  );
  const loadAnkiDataRef = useRef(loadAnkiData);
  loadAnkiDataRef.current = loadAnkiData;

  const loadData = useCallback(async (restoredDraft: CardDraft | null) => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    const store = useCardCreatorStore.getState();
    store.setCapturingMedia(ctx.mediaPending === true);

    const plan = buildInitialDraft(ctx, restoredDraft, {
      noteType: defaultNoteType,
      deck: defaultDeck,
      tags: defaultTags,
      mediaUpdateMode: defaultMediaUpdateMode,
    });
    store.setQueueItems(plan.queueItems);
    store.setQueueSidebarOpen(plan.queueSidebarOpen);
    store.setQueueActiveIndex(plan.queueActiveIndex);
    if (plan.activeQueueTerm) onQueueTermSelectRef.current?.(plan.activeQueueTerm);
    store.setDraft(plan.draft);

    const prefill = ctx.prefill;
    if (prefillHasMedia(prefill)) {
      void mergePrefillMedia(prefillDraftAccess, prefill ?? {});
    }

    await loadAnkiData(restoredDraft);
  }, [defaultNoteType, defaultDeck, defaultTags, defaultMediaUpdateMode, loadAnkiData]);

  const mergePrefill = useCallback(async (ctx: OpenContext) => {
    const prefill = ctx.prefill;
    if (!prefill) return;

    const store = useCardCreatorStore.getState();
    mergePrefillTextFields(prefillDraftAccess, prefill);

    store.setCapturingMedia(true);
    try {
      await mergePrefillMedia(prefillDraftAccess, prefill);
    } finally {
      store.setCapturingMedia(false);
    }
  }, []);

  const loadedForRef = useRef<OpenContext | null>(null);
  useEffect(() => {
    if (!openContext) return;
    const previous = loadedForRef.current;
    const isSameSession = previous && isSameOpenContextSession(previous, openContext);
    const hasPrefillTerm = !!openContext.prefill?.targetWord?.trim();

    if (isSameSession) {
      const store = useCardCreatorStore.getState();
      if (
        loadedForRef.current !== openContext &&
        store.loadStatus === 'ready' &&
        hasPrefillTerm
      ) {
        void mergePrefill(openContext);
      }
      loadedForRef.current = openContext;
      return;
    }

    loadedForRef.current = openContext;
    const autosaver = autosaverRef.current;
    void autosaver.load().then((restored) => {
      useCardCreatorStore.getState().reset();
      useCardCreatorStore.getState().setInitialAction(initialAction);
      loadedSettingsKeyRef.current = null;
      void loadData(restored ?? null);
    });
  }, [openContext, loadData, initialAction, mergePrefill]);

  useEffect(() => {
    if (!openContext || loadedForRef.current !== openContext) return;
    if (loadedSettingsKeyRef.current === null) return;
    if (loadedSettingsKeyRef.current === JSON.stringify(settings)) return;
    const timer = setTimeout(() => {
      const { noteType, deck, fieldMapping } = useCardCreatorStore.getState().draft;
      void loadAnkiDataRef.current({ noteType, deck, fieldMapping });
    }, SETTINGS_RELOAD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [settings, openContext]);

  const reload = useCallback(() => {
    const ctx = openContextRef.current;
    if (!ctx || loadedForRef.current !== ctx) return;
    const store = useCardCreatorStore.getState();
    if (
      store.loadStatus !== 'error' &&
      JSON.stringify(settingsRef.current) === loadedSettingsKeyRef.current
    ) {
      return;
    }
    const { noteType, deck, fieldMapping } = store.draft;
    void loadAnkiDataRef.current({ noteType, deck, fieldMapping });
  }, []);

  useEffect(() => {
    if (loadStatus === 'idle') return;
    autosaverRef.current.schedule(draft);
  }, [draft, loadStatus]);

  useEffect(() => {
    const autosaver = autosaverRef.current;
    return () => {
      void autosaver.flush();
      useCardCreatorStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (!openContext) return;
    return onAnkiSchemaRefreshed(({ decks, models }) => {
      const store = useCardCreatorStore.getState();
      store.setDecks(decks);
      store.setNoteTypes(models);
    });
  }, [openContext]);

  const updateDraft = useCallback((partial: Partial<CardDraft>) => {
    useCardCreatorStore.getState().setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateField = useCallback(
    (key: TextFieldKey, value: string) => {
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fields: { ...prev.fields, [key]: value },
      }));
    },
    [],
  );

  const updateMapping = useCallback(
    (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => {
      const store = useCardCreatorStore.getState();
      const noteType = store.draft.noteType;
      store.setDraft((prev) => ({
        ...prev,
        fieldMapping: { ...prev.fieldMapping, [sourceKey]: ankiField },
      }));
      const updated = { ...store.draft.fieldMapping, [sourceKey]: ankiField };
      persistFieldMapping(noteType, updated);
    },
    [persistFieldMapping],
  );

  const changeNoteType = useCallback(
    async (noteType: string) => {
      const store = useCardCreatorStore.getState();
      store.setDraft((prev) => ({ ...prev, noteType }));

      const fields = await getModelFields(ankiConnectUrl, noteType);
      if (fields) {
        store.setAvailableFields(fields);
        const savedMapping = fieldMappingsRef.current?.[noteType];
        const { mapping, shouldPersist } = resolveFieldMapping(fields, savedMapping);
        store.setDraft((prev) => ({ ...prev, fieldMapping: mapping }));
        if (shouldPersist) {
          persistFieldMapping(noteType, mapping);
        }
      }

      const deck = useCardCreatorStore.getState().draft.deck;
      await refreshRecentNote(deck, noteType);
      store.setLoadStatus('ready');
    },
    [ankiConnectUrl, refreshRecentNote, persistFieldMapping],
  );

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

  const addFiles = useCallback(
    (kind: MediaListKind, files: readonly MediaFile[], invalidCount = 0) => {
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

  const addFileFromDisk = useCallback(
    async (kind: MediaListKind): Promise<void> => {
      const mediaFiles = await pickMediaFilesFromDisk(kind);
      addFiles(kind, mediaFiles);
    },
    [addFiles],
  );

  const removeMedia = useCallback(
    (kind: MediaListKind, index: number) => {
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

  const reorderMedia = useCallback(
    (kind: MediaListKind, fromIndex: number, toIndex: number) => {
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

  const clear = useCallback(() => {
    useCardCreatorStore.getState().setDraft((prev) => ({
      ...prev,
      tags: '',
      fields: {
        targetWord: '',
        sentence: '',
        sentenceTranslation: '',
        definitions: '',
        images: [],
        sentenceAudios: [],
        wordAudios: [],
        note: '',
        moreExample: '',
      },
    }));
  }, []);

  const translateSentenceField = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    if (ctx.cue?.nativeText.trim()) {
      updateField('sentenceTranslation', ctx.cue.nativeText);
      return;
    }
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

  const dictionarySourceRef = useRef<{ key: string; source: CardCreatorPrefill } | null>(null);

  const resolveGenerateSource = useCallback(async (): Promise<CardCreatorPrefill | undefined> => {
    const ctx = openContextRef.current;
    if (!ctx) return undefined;
    const state = useCardCreatorStore.getState();
    const targetWord = state.draft.fields.targetWord.trim();
    const prefill = ctx.prefill;
    if (isPrefillUsableForTerm(prefill, targetWord)) return prefill;
    if (!targetWord) return undefined;
    const key = generateSourceKey(ctx.sourceLang, targetWord);
    if (dictionarySourceRef.current?.key === key) return dictionarySourceRef.current.source;
    const sentence = state.draft.fields.sentence.trim() || ctx.cue?.targetText?.trim() || '';
    const source = await lookupDictionaryResources(targetWord, ctx.sourceLang, sentence);
    if (source) dictionarySourceRef.current = { key, source };
    return source ?? undefined;
  }, []);

  const generateField = useCallback(async (key: GenerateFieldKey) => {
    const ctx = openContextRef.current;
    if (!ctx) return;

    const store = () => useCardCreatorStore.getState();
    const fieldLabel = t(fieldLabelMap[key]);
    const warn = (message: string) => store().pushToast('warning', message);

    const trySetTextField = (k: TextFieldKey, value: string): void => {
      const currentValue = (store().draft.fields[k] as string).trim();
      if (currentValue) {
        store().pushToast('warning', t('cardCreator.toast.generateField.alreadyFilled', [t(fieldLabelMap[k])]));
        return;
      }
      if (value) {
        updateField(k, value);
        store().pushToast('success', t('cardCreator.toast.generateField.success', [t(fieldLabelMap[k])]));
      } else {
        store().pushToast('warning', t('cardCreator.toast.generateField.noSource', [t(fieldLabelMap[k])]));
      }
    };

    const ensureTargetWord = (): boolean => {
      const currentTarget = store().draft.fields.targetWord.trim();
      if (currentTarget) return true;
      const prefillTarget = ctx.prefill?.targetWord?.trim();
      if (prefillTarget) {
        updateField('targetWord', prefillTarget);
        return true;
      }
      store().pushToast('warning', t('cardCreator.toast.generate.noTarget'));
      return false;
    };

    if (key === 'targetWord') {
      trySetTextField('targetWord', ctx.prefill?.targetWord?.trim() ?? '');
      return;
    }

    if (!ensureTargetWord()) return;

    const current = store().draft.fields;
    const prefill = ctx.prefill;

    switch (key) {
      case 'sentence': {
        trySetTextField('sentence', prefill?.sentence?.trim() ?? ctx.cue?.targetText?.trim() ?? '');
        break;
      }
      case 'sentenceTranslation': {
        const prefillValue = prefill?.sentenceTranslation?.trim() ?? ctx.cue?.nativeText?.trim() ?? '';
        if (prefillValue) {
          trySetTextField('sentenceTranslation', prefillValue);
          break;
        }
        const sentence = current.sentence.trim() || ctx.cue?.targetText?.trim() || prefill?.sentence?.trim() || '';
        if (!sentence) {
          store().pushToast('warning', t('cardCreator.toast.generateField.noSource', [fieldLabel]));
          break;
        }
        const before = store().draft.fields.sentenceTranslation;
        await translateSentenceField();
        const after = store().draft.fields.sentenceTranslation;
        if (after.trim() && after !== before) {
          store().pushToast('success', t('cardCreator.toast.generateField.success', [fieldLabel]));
        }
        break;
      }
      case 'definitions':
      case 'note':
      case 'moreExample': {
        const source = await resolveGenerateSource();
        trySetTextField(key, source?.[key]?.trim() ?? '');
        break;
      }
      case 'images':
      case 'sentenceAudios':
      case 'wordAudios': {
        if (current[key].length > 0) {
          store().pushToast('warning', t('cardCreator.toast.generateField.alreadyFilled', [fieldLabel]));
          break;
        }
        const source = await resolveGenerateSource();
        const urlKey = mediaUrlKeyMap[key];
        const urls = source?.[urlKey] ?? [];
        if (urls.length === 0) {
          store().pushToast('warning', t('cardCreator.toast.generateField.noSource', [fieldLabel]));
          break;
        }
        store().setCapturingMedia(true);
        const fetched = await fetchMediaList(urls, key, warn);
        if (fetched.length > 0) {
          store().setDraft((prev) => ({
            ...prev,
            fields: {
              ...prev.fields,
              [key]: [...prev.fields[key], ...fetched],
            },
          }));
          store().pushToast('success', t('cardCreator.toast.generateField.success', [fieldLabel]));
        } else {
          store().pushToast('warning', t('cardCreator.toast.generateField.failed', [fieldLabel]));
        }
        store().setCapturingMedia(false);
        break;
      }
      default:
        break;
    }
  }, [resolveGenerateSource, translateSentenceField, updateField]);

  const generateSeqRef = useRef(0);

  const generateAll = useCallback(async () => {
    const ctx = openContextRef.current;
    if (!ctx) return;
    const store = () => useCardCreatorStore.getState();
    const warn = (message: string) => store().pushToast('warning', message);
    const requestedTerm = store().draft.fields.targetWord.trim();
    if (!requestedTerm) {
      store().pushToast('warning', t('cardCreator.toast.generate.noTarget'));
      return;
    }
    const seq = ++generateSeqRef.current;
    const stillCurrent = () =>
      seq === generateSeqRef.current &&
      store().draft.fields.targetWord.trim().toLowerCase() === requestedTerm.toLowerCase();
    store().setCapturingMedia(true);
    try {
      const source = await resolveGenerateSource();
      if (!stillCurrent()) return;
      if (!source || !hasGenerateSourceData(source)) {
        store().pushToast('warning', t('cardCreator.toast.generate.notFound', [requestedTerm]));
        return;
      }
      let filled = false;
      const current = store().draft.fields;
      if (!current.definitions.trim() && source.definitions?.trim()) {
        updateField('definitions', source.definitions);
        filled = true;
      }
      const fetchedWordAudios = current.wordAudios.length === 0
        ? await fetchMediaList(source.wordAudioUrls ?? [], 'wordAudios', warn)
        : [];
      const fetchedSentenceAudios = current.sentenceAudios.length === 0
        ? await fetchMediaList(source.sentenceAudioUrls ?? [], 'sentenceAudios', warn)
        : [];
      const fetchedImages = current.images.length === 0
        ? await fetchMediaList(source.imageUrls ?? [], 'images', warn)
        : [];
      if (!stillCurrent()) return;
      if (fetchedWordAudios.length > 0 || fetchedSentenceAudios.length > 0 || fetchedImages.length > 0) {
        store().setDraft((prev) => ({
          ...prev,
          fields: {
            ...prev.fields,
            wordAudios: [...prev.fields.wordAudios, ...fetchedWordAudios],
            sentenceAudios: [...prev.fields.sentenceAudios, ...fetchedSentenceAudios],
            images: [...prev.fields.images, ...fetchedImages],
          },
        }));
        filled = true;
      }
      store().pushToast(
        filled ? 'success' : 'warning',
        t(filled ? 'cardCreator.toast.generate.success' : 'cardCreator.toast.generate.empty'),
      );
    } finally {
      if (seq === generateSeqRef.current) store().setCapturingMedia(false);
    }
  }, [resolveGenerateSource, updateField]);

  const selectQueueItem = useCallback((index: number) => {
    selectQueueItemStore(index);
    const term = useCardCreatorStore.getState().queueItems[index]?.term;
    if (term) onQueueTermSelectRef.current?.(term);
    void generateAll();
  }, [selectQueueItemStore, generateAll]);

  const lookupTerm = useCallback((term: string) => {
    if (term.trim()) onQueueTermSelectRef.current?.(term.trim());
  }, []);

  const withSchemaRetry = useCallback(
    <T,>(fn: () => Promise<T>): Promise<T> =>
      runWithSchemaRetry(ankiConnectUrl, (schema) => {
        const s = useCardCreatorStore.getState();
        s.setDecks(schema.decks);
        s.setNoteTypes(schema.models);
      }, fn),
    [ankiConnectUrl],
  );

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

  const submit = useCallback(
    async (mode: 'add' | 'update') => {
      const store = useCardCreatorStore.getState();
      if (store.submitting) return;
      store.setSubmitting(true);
      try {
        const fields = await buildAnkiFieldsCb();
        const draft = store.draft;
        const tags = splitTags(draft.tags);
        let success = false;

        if (mode === 'add') {
          const r = await withSchemaRetry(async () => {
            const result = await addNote(ankiConnectUrl, {
              deckName: draft.deck,
              modelName: draft.noteType,
              fields,
              tags,
            });
            if (!result.ok) throw new Error(result.error);
            return result;
          });
          if (r.value === null) {
            store.pushToast('warning', t('cardCreator.toast.add.duplicate'));
          } else {
            store.pushToast('success', t('cardCreator.toast.add.success', [draft.deck, r.value]));
            await autosaverRef.current.clear();
            success = true;
          }
        } else {
          const fresh = await refreshRecentNote(draft.deck, draft.noteType);
          const updateNoteId = fresh.id;
          if (updateNoteId === null) {
            store.pushToast('error', t('cardCreator.toast.update.noCard', [draft.deck]));
            return;
          }
          const existing = fresh.info?.fields ?? {};
          const updateFields = computeFieldUpdates(fields, existing, draft.mediaUpdateMode);
          if (Object.keys(updateFields).length === 0) {
            store.pushToast('warning', t('cardCreator.toast.update.skip'));
            return;
          }
          await withSchemaRetry(async () => {
            const result = await updateNote(ankiConnectUrl, updateNoteId, updateFields, 'overwrite', existing);
            if (!result.ok) throw new Error(result.error);
            return result;
          });
          if (tags.length > 0) {
            const tagsR = await addNoteTags(ankiConnectUrl, updateNoteId, tags);
            if (!tagsR.ok) {
              store.pushToast('warning', t('cardCreator.toast.update.tagsFailed', [tagsR.error]));
            }
          }
          store.pushToast('success', t('cardCreator.toast.update.success', [updateNoteId]));
          await autosaverRef.current.clear();
          success = true;
        }
        if (success) {
          onSubmitSuccessRef.current?.();
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
    [ankiConnectUrl, buildAnkiFieldsCb, refreshRecentNote, withSchemaRetry],
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
