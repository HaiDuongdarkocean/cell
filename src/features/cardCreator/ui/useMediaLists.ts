import { useCallback, type RefObject } from 'react';
import { useCardCreatorStore } from '../state/cardCreatorStore';
import { pickMediaFilesFromDisk } from '../service/mediaFilePicker';
import type { MediaListKind } from '../state/mediaListKinds';
import { t } from '@/shared/i18n';
import type { MediaFile } from '../media/mediaFile';
import { captureScreenshot } from '../media/screenshot';
import { captureSentenceAudio } from '../media/sentenceAudio';
import type { CardCreatorOpenContext } from '../types';
import { reorderItems } from '@/shared/lib/reorderItems';

export { reorderItems };

export interface UseMediaListsArgs {
  readonly openContextRef: RefObject<CardCreatorOpenContext | null>;
}

export interface MediaListActions {
  readonly addScreenshot: () => Promise<void>;
  readonly addSentenceAudio: () => Promise<void>;
  readonly addFileFromDisk: (kind: MediaListKind) => Promise<void>;
  readonly addFiles: (
    kind: MediaListKind,
    files: readonly MediaFile[],
    invalidCount?: number,
  ) => void;
  readonly removeMedia: (kind: MediaListKind, index: number) => void;
  readonly reorderMedia: (kind: MediaListKind, fromIndex: number, toIndex: number) => void;
}

export function useMediaLists({ openContextRef }: UseMediaListsArgs): MediaListActions {
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
  }, [openContextRef]);

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
        store.pushToast('error', t('cardCreator.toast.audioCapture.failed', [result.error ?? t('common.unknownError')]));
      }
    } finally {
      store.setCapturingMedia(false);
    }
  }, [openContextRef]);

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
      useCardCreatorStore.getState().setDraft((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [kind]: reorderItems(prev.fields[kind], fromIndex, toIndex),
        },
      }));
    },
    [],
  );

  return {
    addScreenshot,
    addSentenceAudio,
    addFileFromDisk,
    addFiles,
    removeMedia,
    reorderMedia,
  };
}
