import { useCallback } from 'react';
import { useCardCreatorStore } from '../state/cardCreatorStore';
import type { FieldMapping } from '../service/fieldMapping';
import type { CardDraft } from '../state/cardDraft';
import type { TextFieldKey } from '../state/mediaListKinds';

export interface UseDraftOpsArgs {
  readonly persistFieldMapping: (noteType: string, mapping: FieldMapping) => void;
}

export interface DraftOps {
  readonly updateDraft: (partial: Partial<CardDraft>) => void;
  readonly updateField: (key: TextFieldKey, value: string) => void;
  readonly updateMapping: (sourceKey: keyof CardDraft['fieldMapping'], ankiField: string) => void;
  readonly clear: () => void;
}

export function useDraftOps({ persistFieldMapping }: UseDraftOpsArgs): DraftOps {
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

  return { updateDraft, updateField, updateMapping, clear };
}
