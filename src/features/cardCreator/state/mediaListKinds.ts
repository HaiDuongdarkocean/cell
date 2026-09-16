import type { MessageKey } from '@/shared/i18n';
import type { MediaKind } from '../media/mediaFile';
import type { CardDraft } from './cardDraft';

export type MediaListKind = 'images' | 'sentenceAudios' | 'wordAudios';

export type TextFieldKey =
  | 'targetWord'
  | 'sentence'
  | 'sentenceTranslation'
  | 'definitions'
  | 'note'
  | 'moreExample';

export type GenerateFieldKey = keyof CardDraft['fields'];

export const mediaUrlKeyMap: Record<
  MediaListKind,
  'imageUrls' | 'sentenceAudioUrls' | 'wordAudioUrls'
> = {
  images: 'imageUrls',
  sentenceAudios: 'sentenceAudioUrls',
  wordAudios: 'wordAudioUrls',
};

export const mediaKindMap: Record<MediaListKind, MediaKind> = {
  images: 'image',
  sentenceAudios: 'audio',
  wordAudios: 'audio',
};

export const mediaFetchToastKey: Record<MediaListKind, MessageKey> = {
  images: 'cardCreator.toast.fetch.image',
  sentenceAudios: 'cardCreator.toast.fetch.sentenceAudio',
  wordAudios: 'cardCreator.toast.fetch.wordAudio',
};
