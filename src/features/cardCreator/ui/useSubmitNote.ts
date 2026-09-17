import { useCallback, useEffect, useRef } from 'react';
import { useCardCreatorStore } from '../state/cardCreatorStore';
import {
  addNote,
  updateNote,
  addNoteTags,
} from '../service/cardCreatorService';
import { buildAnkiFields } from '../service/buildAnkiFields';
import {
  runWithSchemaRetry,
  type RecentNoteLookup,
} from '../service/ankiSchemaService';
import { computeFieldUpdates, splitTags } from '../service/noteUpdate';
import { t } from '@/shared/i18n';

export interface UseSubmitNoteArgs {
  readonly ankiConnectUrl: string;
  readonly onSubmitSuccess?: () => void;
  readonly refreshRecentNote: (deck: string, noteType: string) => Promise<RecentNoteLookup>;
  readonly clearSavedDraft: () => Promise<void>;
}

export interface SubmitNoteActions {
  readonly submit: (mode: 'add' | 'update') => Promise<void>;
}

export function useSubmitNote({
  ankiConnectUrl,
  onSubmitSuccess,
  refreshRecentNote,
  clearSavedDraft,
}: UseSubmitNoteArgs): SubmitNoteActions {
  const onSubmitSuccessRef = useRef(onSubmitSuccess);
  useEffect(() => { onSubmitSuccessRef.current = onSubmitSuccess; }, [onSubmitSuccess]);

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
            await clearSavedDraft();
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
          await clearSavedDraft();
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
    [ankiConnectUrl, buildAnkiFieldsCb, refreshRecentNote, withSchemaRetry, clearSavedDraft],
  );

  return { submit };
}
