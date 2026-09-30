import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type {
  MessageResponse,
  SrsAddNoteResult,
  SrsGetDecksNotetypesResult,
} from '@/entities/message';
import type { SrsFieldValue } from '@/entities/srs/types';
import { arrayBufferToBase64, type MediaFile } from '../media/mediaFile';
import type { CardFields } from '../state/cardDraft';
import type { Result } from './cardCreatorService';

export type SrsNotetypeDescriptor = SrsGetDecksNotetypesResult['notetypes'][number];
export type SrsDeckDescriptor = SrsGetDecksNotetypesResult['decks'][number];
export type SrsSchema = SrsGetDecksNotetypesResult;

/** Fetch decks + notetypes of the active SRS collection (created on first run). */
export async function fetchSrsSchema(): Promise<Result<SrsSchema>> {
  try {
    const response = (await sendMessage({
      type: MESSAGE_TYPES.SRS_GET_DECKS_NOTETYPES,
      payload: {},
    })) as MessageResponse<SrsGetDecksNotetypesResult> | undefined;
    if (!response) return { ok: false, error: t('cardCreator.error.noResponse') };
    if (!response.success || !response.data) {
      return { ok: false, error: response.error ?? t('cardCreator.error.unknownSrs') };
    }
    return { ok: true, value: response.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Submit the note to Ocean SRS. Returns the created note/card ids. */
export async function addSrsNote(input: {
  readonly targetLanguage: string;
  readonly collectionId: string;
  readonly deckId: string;
  readonly notetypeId: string;
  readonly targetWord: string;
  readonly fields: Record<string, SrsFieldValue>;
}): Promise<Result<SrsAddNoteResult>> {
  try {
    const response = (await sendMessage({
      type: MESSAGE_TYPES.SRS_ADD_NOTE,
      payload: input,
    })) as MessageResponse<SrsAddNoteResult> | undefined;
    if (!response) return { ok: false, error: t('cardCreator.error.noResponse') };
    if (!response.success || !response.data) {
      return { ok: false, error: response.error ?? t('cardCreator.error.unknownSrs') };
    }
    return { ok: true, value: response.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type Field = SrsNotetypeDescriptor['fields'][number];

function byId(fields: readonly Field[], ids: readonly string[]): Field | undefined {
  return fields.find((f) => ids.includes(f.id));
}

function byType(
  fields: readonly Field[],
  type: Field['type'],
  exclude?: readonly string[],
): Field | undefined {
  return fields.find((f) => f.type === type && !(exclude ?? []).includes(f.id));
}

function mediaValue(file: MediaFile): string {
  if (file.sourceUrl && /^(https?:|data:)/.test(file.sourceUrl)) return file.sourceUrl;
  return `data:${file.mimeType};base64,${arrayBufferToBase64(file.data)}`;
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
}

/** Map Card Creator fields onto an SRS notetype's field ids. */
export function buildSrsFields(
  notetype: SrsNotetypeDescriptor,
  draftFields: CardFields,
): Record<string, SrsFieldValue> {
  const out: Record<string, SrsFieldValue> = {};
  const fields = notetype.fields;
  const setText = (field: Field | undefined, value: string): void => {
    if (field && value) out[field.id] = { kind: 'text', value };
  };

  const used: string[] = [];
  const pick = (field: Field | undefined): Field | undefined => {
    if (field) used.push(field.id);
    return field;
  };

  const target = pick(fields.find((f) => f.id === notetype.targetFieldId) ?? byType(fields, 'text'));
  setText(target, draftFields.targetWord);
  setText(pick(byId(fields, ['sentence']) ?? byType(fields, 'text', used)), draftFields.sentence);
  const translation = pick(byType(fields, 'translation'));
  if (translation && draftFields.sentenceTranslation) {
    out[translation.id] = { kind: 'translation', value: draftFields.sentenceTranslation };
  }
  const context = pick(byType(fields, 'context'));
  if (context && draftFields.sentence) {
    out[context.id] = { kind: 'context', value: draftFields.sentence };
  }
  setText(pick(byId(fields, ['def', 'definition', 'definitions']) ?? byType(fields, 'text', used)), draftFields.definitions);
  setText(pick(byId(fields, ['notes', 'note']) ?? byType(fields, 'text', used)), draftFields.note);

  const examples = byId(fields, ['examples', 'moreExample']) ?? byType(fields, 'list');
  if (examples && draftFields.moreExample) {
    const items = splitLines(draftFields.moreExample);
    if (items.length) out[examples.id] = { kind: 'list', value: items };
  }

  const wordAudioField = byId(fields, ['wordAudio']) ?? byType(fields, 'audio');
  const sentAudioField = byId(fields, ['sentAudio']) ?? byType(fields, 'audio', [wordAudioField?.id ?? '']);
  const wordAudio = draftFields.wordAudios[0];
  if (wordAudioField && wordAudio) {
    out[wordAudioField.id] = {
      kind: 'audio',
      value: mediaValue(wordAudio),
      source: wordAudio.sourceUrl ? 'pronunciation' : 'local',
    };
  }
  const sentAudio = draftFields.sentenceAudios[0];
  if (sentAudioField && sentAudio) {
    out[sentAudioField.id] = {
      kind: 'audio',
      value: mediaValue(sentAudio),
      source: sentAudio.sourceUrl ? 'tts' : 'local',
    };
  }

  const imageField = byId(fields, ['image']) ?? byType(fields, 'image');
  const image = draftFields.images[0];
  if (imageField && image) {
    out[imageField.id] = { kind: 'image', value: mediaValue(image) };
  }

  return out;
}
