import { t } from '@/shared/i18n';
import {
  buildMergedMediaArray,
  mediaUrlsToFetch,
  mergePrefillIntoDraft,
  type CardDraft,
  type MediaMergePlan,
} from './cardDraft';
import {
  mediaFetchToastKey,
  mediaKindMap,
  type MediaListKind,
} from './mediaListKinds';
import {
  fetchMediaFile,
  mediaFromAudioItem,
  mediaFromImageItem,
  type MediaFile,
} from '../media/mediaFile';
import type { CardCreatorPrefill } from '../types';

export interface PrefillDraftAccess {
  getDraft(): CardDraft;
  setDraft(updater: (prev: CardDraft) => CardDraft): void;
  warn(message: string): void;
}

export function prefillHasMedia(prefill: CardCreatorPrefill | undefined): boolean {
  return (
    (prefill?.wordAudioItems?.length ?? 0) > 0 ||
    (prefill?.imageItems?.length ?? 0) > 0 ||
    (prefill?.wordAudioUrls?.length ?? 0) > 0 ||
    (prefill?.sentenceAudioUrls?.length ?? 0) > 0 ||
    (prefill?.imageUrls?.length ?? 0) > 0
  );
}

export function mergePrefillTextFields(
  access: PrefillDraftAccess,
  prefill: CardCreatorPrefill,
): void {
  const { draft: merged } = mergePrefillIntoDraft(access.getDraft(), prefill);
  access.setDraft((prev) => ({
    ...prev,
    fields: {
      ...prev.fields,
      targetWord: merged.fields.targetWord,
      sentence: merged.fields.sentence,
      sentenceTranslation: merged.fields.sentenceTranslation,
      definitions: merged.fields.definitions,
      note: merged.fields.note,
      moreExample: merged.fields.moreExample,
    },
  }));
}

export async function fetchMissingMedia(
  plan: MediaMergePlan,
  kind: MediaListKind,
  warn: (message: string) => void,
): Promise<Record<string, MediaFile>> {
  const urls = mediaUrlsToFetch(plan);
  if (urls.length === 0) return {};
  const result: Record<string, MediaFile> = {};
  for (const url of urls) {
    try {
      result[url] = await fetchMediaFile(url, mediaKindMap[kind]);
    } catch {
      warn(t(mediaFetchToastKey[kind], [url]));
    }
  }
  return result;
}

export async function fetchMediaList(
  urls: readonly string[],
  kind: MediaListKind,
  warn: (message: string) => void,
): Promise<MediaFile[]> {
  const fetched: MediaFile[] = [];
  for (const url of urls) {
    try {
      fetched.push(await fetchMediaFile(url, mediaKindMap[kind]));
    } catch {
      warn(t(mediaFetchToastKey[kind], [url]));
    }
  }
  return fetched;
}

async function preloadSelectedItems(
  prefill: CardCreatorPrefill,
): Promise<{ images: MediaFile[]; wordAudios: MediaFile[] }> {
  const [wordAudios, images] = await Promise.all([
    Promise.all((prefill.wordAudioItems ?? []).map(mediaFromAudioItem)).then(
      (files) => files.filter((f): f is MediaFile => f !== null),
    ),
    Promise.all((prefill.imageItems ?? []).map(mediaFromImageItem)).then(
      (files) => files.filter((f): f is MediaFile => f !== null),
    ),
  ]);
  return { images, wordAudios };
}

export async function mergePrefillMedia(
  access: PrefillDraftAccess,
  prefill: CardCreatorPrefill,
): Promise<void> {
  const { images: preloadedImages, wordAudios: preloadedWordAudios } =
    await preloadSelectedItems(prefill);
  if (preloadedWordAudios.length > 0 || preloadedImages.length > 0) {
    access.setDraft((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        images: [...prev.fields.images, ...preloadedImages],
        wordAudios: [...prev.fields.wordAudios, ...preloadedWordAudios],
      },
    }));
  }

  const { media } = mergePrefillIntoDraft(access.getDraft(), prefill);
  const [fetchedImages, fetchedWordAudios, fetchedSentenceAudios] = await Promise.all([
    fetchMissingMedia(media.images, 'images', access.warn),
    fetchMissingMedia(media.wordAudios, 'wordAudios', access.warn),
    fetchMissingMedia(media.sentenceAudios, 'sentenceAudios', access.warn),
  ]);
  access.setDraft((prev) => ({
    ...prev,
    fields: {
      ...prev.fields,
      images: buildMergedMediaArray(media.images, fetchedImages),
      wordAudios: buildMergedMediaArray(media.wordAudios, fetchedWordAudios),
      sentenceAudios: buildMergedMediaArray(media.sentenceAudios, fetchedSentenceAudios),
    },
  }));
}
