/**
 * Quick Add — bypass the Card Creator dialog and add a note directly.
 *
 * Used by the popup dictionary's Quick Add button. Builds Anki fields from
 * prefill text + media (fetched URLs + captured screenshot/audio), uploads
 * media via storeMediaFile, and calls addNote. Best-effort: failed media
 * fetches are skipped (toast warning), the note is still added with whatever
 * media succeeded.
 */

import type { FieldMapping } from './fieldMapping';
import { buildAnkiFields, type AnkiTextFields, type AnkiMediaFields } from './buildAnkiFields';
import { addNote } from './cardCreatorService';

/** Text fields for Quick Add (reuses shared AnkiTextFields). */
export type QuickAddTextFields = AnkiTextFields;

/** Media files for Quick Add (reuses shared AnkiMediaFields). */
export type QuickAddMedia = AnkiMediaFields;

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
  const fields = await buildAnkiFields(url, fieldMapping, text, media, onWarning);

  const tagList = tags.split(/\s+/).filter(Boolean);
  const r = await addNote(url, {
    deckName: deck,
    modelName: noteType,
    fields,
    tags: tagList,
    options: { allowDuplicate: true },
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, noteId: r.value };
}
