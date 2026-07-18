/**
 * Quick Add — bypass the Card Creator dialog and add a note directly.
 *
 * Used by the popup dictionary's Quick Add button. Builds Anki fields from
 * prefill text + media (fetched URLs + captured screenshot/audio), uploads
 * media via storeMediaFile, and calls addNote. Best-effort: failed media
 * fetches are skipped (toast warning), the note is still added with whatever
 * media succeeded.
 */

import type { MediaFile } from '../media/mediaFile';
import type { FieldMapping } from './fieldMapping';
import { arrayBufferToBase64, joinAnkiFieldRefs } from '../media/mediaFile';
import { addNote, storeMedia } from './cardCreatorService';

/** Text fields for Quick Add (same shape as CardFields text portion). */
export interface QuickAddTextFields {
  readonly targetWord: string;
  readonly sentence: string;
  readonly sentenceTranslation: string;
  readonly definitions: string;
  readonly note: string;
  readonly moreExample: string;
}

/** Media files for Quick Add (already fetched/captured). */
export interface QuickAddMedia {
  readonly images: readonly MediaFile[];
  readonly sentenceAudios: readonly MediaFile[];
  readonly wordAudios: readonly MediaFile[];
}

/** Result of a Quick Add operation. */
export type QuickAddResult =
  | { readonly ok: true; readonly noteId: number | null }
  | { readonly ok: false; readonly error: string };

/**
 * Build Anki fields from text + media using the field mapping, upload media,
 * and add the note. Returns the new note id (or null if duplicate skipped).
 *
 * @param url           AnkiConnect base URL
 * @param deck          deck name
 * @param noteType      note type (model) name
 * @param fieldMapping  source→Anki field mapping
 * @param tags          space-separated tags string
 * @param text          text fields
 * @param media         media files (already fetched)
 * @param onWarning     called for non-fatal warnings (media upload fail)
 */
export async function quickAddNote(
  url: string,
  deck: string,
  noteType: string,
  fieldMapping: FieldMapping,
  tags: string,
  text: QuickAddTextFields,
  media: QuickAddMedia,
  onWarning?: (msg: string) => void,
): Promise<QuickAddResult> {
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

  const tagList = tags.split(/\s+/).filter(Boolean);
  const r = await addNote(url, {
    deckName: deck,
    modelName: noteType,
    fields,
    tags: tagList,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, noteId: r.value };
}
