import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { CardCreatorSettings } from '@/entities/settings';
import { useCardCreatorStore } from '../state/cardCreatorStore';
import { prefetchAnkiConnectData, onAnkiSchemaRefreshed } from '../service/cardCreatorPrefetch';
import { getModelFields } from '../service/ankiSchemaCache';
import {
  fetchRecentNote,
  resolveSchemaChoice,
  type RecentNoteLookup,
} from '../service/ankiSchemaService';
import {
  FieldMappingWriter,
  resolveFieldMapping,
} from '../service/fieldMappingService';
import type { FieldMapping } from '../service/fieldMapping';
import { DraftAutosaver, type CardDraft } from '../state/cardDraft';
import { buildInitialDraft } from '../state/initialDraft';
import {
  mergePrefillMedia,
  mergePrefillTextFields,
  prefillHasMedia,
  type PrefillDraftAccess,
} from '../state/prefillMerge';
import { t } from '@/shared/i18n';
import type { CardCreatorAction, CardCreatorOpenContext } from '../types';

const SETTINGS_RELOAD_DEBOUNCE_MS = 300;

const prefillDraftAccess: PrefillDraftAccess = {
  getDraft: () => useCardCreatorStore.getState().draft,
  setDraft: (updater) => useCardCreatorStore.getState().setDraft(updater),
  warn: (message) => useCardCreatorStore.getState().pushToast('warning', message),
};

export function isSameOpenContextSession(
  a: CardCreatorOpenContext,
  b: CardCreatorOpenContext,
): boolean {
  return (
    a.video === b.video &&
    a.cue === b.cue &&
    a.sourceLang === b.sourceLang &&
    a.targetLang === b.targetLang &&
    a.initialMedia === b.initialMedia &&
    a.queue === b.queue
  );
}

export interface UseAnkiSchemaArgs {
  readonly settings: CardCreatorSettings;
  readonly openContext: CardCreatorOpenContext | null;
  readonly initialAction?: CardCreatorAction;
  readonly openContextRef: RefObject<CardCreatorOpenContext | null>;
  readonly onQueueTermSelectRef: RefObject<((term: string) => void) | undefined>;
}

export interface AnkiSchemaActions {
  readonly refreshRecentNote: (deck: string, noteType: string) => Promise<RecentNoteLookup>;
  readonly persistFieldMapping: (noteType: string, mapping: FieldMapping) => void;
  readonly clearSavedDraft: () => Promise<void>;
  readonly changeNoteType: (noteType: string) => Promise<void>;
  readonly changeDeck: (deck: string) => Promise<void>;
  readonly reload: () => void;
}

export function useAnkiSchema({
  settings,
  openContext,
  initialAction,
  openContextRef,
  onQueueTermSelectRef,
}: UseAnkiSchemaArgs): AnkiSchemaActions {
  const {
    ankiConnectUrl,
    defaultNoteType,
    defaultDeck,
    defaultTags,
    mediaUpdateMode: defaultMediaUpdateMode,
  } = settings;

  const draft = useCardCreatorStore((s) => s.draft);
  const loadStatus = useCardCreatorStore((s) => s.loadStatus);

  const autosaverRef = useRef(new DraftAutosaver());
  const fieldMappingWriterRef = useRef(new FieldMappingWriter());
  const fieldMappingsRef = useRef(settings.fieldMappings);
  fieldMappingsRef.current = settings.fieldMappings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const loadedSettingsKeyRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const persistFieldMapping = useCallback((noteType: string, mapping: FieldMapping) => {
    fieldMappingWriterRef.current.persist(noteType, mapping);
  }, []);

  const clearSavedDraft = useCallback(() => autosaverRef.current.clear(), []);

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
  }, [defaultNoteType, defaultDeck, defaultTags, defaultMediaUpdateMode, loadAnkiData, openContextRef, onQueueTermSelectRef]);

  const mergePrefill = useCallback(async (ctx: CardCreatorOpenContext) => {
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

  const loadedForRef = useRef<CardCreatorOpenContext | null>(null);
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
  }, [openContextRef]);

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

  return {
    refreshRecentNote,
    persistFieldMapping,
    clearSavedDraft,
    changeNoteType,
    changeDeck,
    reload,
  };
}
