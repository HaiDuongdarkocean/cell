import { SrsNoteSchema } from '@/entities/srs/schemas';
import type { SrsNote } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

export async function getNote(id: string): Promise<SrsNote> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const record = await getById<SrsNote>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Note ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putNote(note: SrsNote): Promise<SrsNote> {
  if (!note.id || !note.notetypeId || !note.deckId || !note.targetWord) {
    throw new SrsError('INVALID_INPUT', 'Note id, notetypeId, deckId and targetWord are required');
  }

  const parsed = SrsNoteSchema.safeParse(note);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  return withStore(SRS_STORES.NOTES, async (store) => {
    const existing = await getNoteByTargetAndNotetypeInStore(store, note.targetWord, note.notetypeId);
    if (existing && existing.id !== note.id) {
      throw new SrsError('DUPLICATE', `Note with targetWord ${note.targetWord} and notetypeId ${note.notetypeId} already exists`);
    }
    await putRecord(store, note);
    return Object.freeze(note);
  });
}

export async function deleteNote(id: string): Promise<void> {
  return withStore(SRS_STORES.NOTES, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getNotesByNotetype(notetypeId: string): Promise<readonly SrsNote[]> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const records = await getAllByIndex<SrsNote>(store, SRS_INDEXES.by_notetype, notetypeId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsNote[];
  });
}

export async function getNotesByDeck(deckId: string): Promise<readonly SrsNote[]> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const records = await getAllByIndex<SrsNote>(store, SRS_INDEXES.by_deck, deckId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsNote[];
  });
}

export async function getNoteByTargetAndNotetype(
  targetWord: string,
  notetypeId: string,
): Promise<SrsNote | undefined> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const record = await getNoteByTargetAndNotetypeInStore(store, targetWord, notetypeId);
    return record ? Object.freeze(record) : undefined;
  });
}

/** Batch fetch notes by id. */
export async function getNotesByIds(ids: readonly string[]): Promise<SrsNote[]> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const records = await Promise.all(ids.map((id) => getById<SrsNote>(store, id)));
    return records.filter((n): n is SrsNote => n !== undefined).map((n) => Object.freeze(n));
  });
}

async function getNoteByTargetAndNotetypeInStore(
  store: IDBObjectStore,
  targetWord: string,
  notetypeId: string,
): Promise<SrsNote | undefined> {
  const records = await getAllByIndex<SrsNote>(store, SRS_INDEXES.by_notetype, notetypeId);
  return records.find((n) => n.targetWord === targetWord);
}
