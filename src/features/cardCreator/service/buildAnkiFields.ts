/**
 * buildAnkiFields — shared helper to build Anki note fields from text + media.
 *
 * Used by both the Card Creator dialog (useCardCreatorState.buildAnkiFields)
 * and the Quick Add direct path (quickAddNote). Centralizes the text→field
 * mapping and media upload→field ref logic so the two paths never drift.
 */

import type { MediaFile } from '../media/mediaFile';
import type { FieldMapping } from './fieldMapping';
import { arrayBufferToBase64, joinAnkiFieldRefs } from '../media/mediaFile';
import { storeMedia } from './cardCreatorService';

/** Text fields (same shape as CardFields text portion). */
export interface AnkiTextFields {
  readonly targetWord: string;
  readonly sentence: string;
  readonly sentenceTranslation: string;
  readonly definitions: string;
  readonly note: string;
  readonly moreExample: string;
}

/** Media files grouped by source key. */
export interface AnkiMediaFields {
  readonly images: readonly MediaFile[];
  readonly sentenceAudios: readonly MediaFile[];
  readonly wordAudios: readonly MediaFile[];
}

/**
 * Build Anki fields from text + media using the field mapping, uploading
 * media via storeMediaFile. Returns a Record<ankiFieldName, value>.
 *
 * @param url           AnkiConnect base URL
 * @param fieldMapping  source→Anki field mapping
 * @param text          text fields
 * @param media         media files (already fetched/captured)
 * @param onWarning     called for non-fatal warnings (media upload fail)
 */
export async function buildAnkiFields(
  url: string,
  fieldMapping: FieldMapping,
  text: AnkiTextFields,
  media: AnkiMediaFields,
  onWarning?: (msg: string) => void,
): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};

  // Text fields.
  const textMap: Record<string, string> = {
    targetWord: text.targetWord,
    sentence: text.sentence,
    sentenceTranslation: text.sentenceTranslation,
    definitions: text.definitions,
    note: text.note,
    moreExample: text.moreExample,
  };
  for (const [sourceKey, value] of Object.entries(textMap)) {
    const ankiField = fieldMapping[sourceKey as keyof FieldMapping];
    if (ankiField && value) {
      fields[ankiField] = value;
    }
  }

  // Media fields: upload each file + build field refs.
  const mediaGroups: Array<{
    sourceKey: 'images' | 'sentenceAudios' | 'wordAudios';
    files: readonly MediaFile[];
  }> = [
    { sourceKey: 'images', files: media.images },
    { sourceKey: 'sentenceAudios', files: media.sentenceAudios },
    { sourceKey: 'wordAudios', files: media.wordAudios },
  ];
  for (const group of mediaGroups) {
    const ankiField = fieldMapping[group.sourceKey];
    if (!ankiField || group.files.length === 0) continue;
    const uploadedFiles: MediaFile[] = [];
    for (const file of group.files) {
      const base64 = arrayBufferToBase64(file.data);
      const storeR = await storeMedia(url, file.filename, base64);
      if (storeR.ok) {
        uploadedFiles.push({ ...file, filename: storeR.value });
      } else if (onWarning) {
        onWarning(`Media upload failed: ${storeR.error}`);
      }
    }
    if (uploadedFiles.length > 0) {
      fields[ankiField] = joinAnkiFieldRefs(uploadedFiles);
    }
  }

  return fields;
}
