import { useCallback, useRef, type RefObject } from 'react';
import { useCardCreatorStore } from '../state/cardCreatorStore';
import { fetchMediaList } from '../state/prefillMerge';
import {
  generateSourceKey,
  hasGenerateSourceData,
  isPrefillUsableForTerm,
} from '../state/generateSource';
import {
  mediaUrlKeyMap,
  type GenerateFieldKey,
  type TextFieldKey,
} from '../state/mediaListKinds';
import { lookupDictionaryResources } from '../service/dictionaryGenerate';
import { translateSentence } from '../media/translation';
import { t, type MessageKey } from '@/shared/i18n';
import type { CardCreatorOpenContext, CardCreatorPrefill } from '../types';

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

export interface UseGenerateActionsArgs {
  readonly openContextRef: RefObject<CardCreatorOpenContext | null>;
  readonly updateField: (key: TextFieldKey, value: string) => void;
}

export interface GenerateActions {
  readonly translateSentenceField: () => Promise<void>;
  readonly generateField: (key: GenerateFieldKey) => Promise<void>;
  readonly generateAll: () => Promise<void>;
}

export function useGenerateActions({
  openContextRef,
  updateField,
}: UseGenerateActionsArgs): GenerateActions {
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
  }, [updateField, openContextRef]);

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
  }, [openContextRef]);

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
  }, [resolveGenerateSource, translateSentenceField, updateField, openContextRef]);

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
  }, [resolveGenerateSource, updateField, openContextRef]);

  return { translateSentenceField, generateField, generateAll };
}
