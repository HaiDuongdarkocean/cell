import { SrsNoteSchema } from '@/entities/srs/schemas';
import type { SrsNote } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfDeck } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.NOTES, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

export async function getNote(id: string): Promise<SrsNote> {
  return withReadonlyStore(SRS_STORES.NOTES, async (store) => {
    const record = await getById<SrsNote>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Note ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putNote(note: SrsNote): Promise<SrsNote> {
  if (!note.id || !note.notetypeId || !note.deckId) {
    throw new SrsError('INVALID_INPUT', 'Note id, notetypeId and deckId are required');
  }

  const parsed = SrsNoteSchema.safeParse(note);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const existing = note.targetWord
      ? await getNoteByTargetAndNotetypeInStore(store, note.targetWord, note.notetypeId)
      : undefined;
    if (existing && existing.id !== note.id) {
      throw new SrsError('DUPLICATE', `Note with targetWord ${note.targetWord} and notetypeId ${note.notetypeId} already exists`);
    }
    const captured = isCaptureEnabled();
    const prev = captured ? await getById<SrsNote>(store, note.id) : undefined;
    const scope = captured
      ? ((await scopeOfDeck(tx, note.deckId)) ??
        (await readRecordMeta(store, `notes:${note.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, note);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsNote', key: `notes:${note.id}`, op: 'put' });
      const prevScope = prev && prev.deckId !== note.deckId ? await scopeOfDeck(tx, prev.deckId) : null;
      if (prevScope && prevScope !== scope) {
        await captureChange(store, { scope: prevScope, dataClass: 'srsNote', key: `notes:${note.id}`, op: 'delete' });
      }
    }
    return Object.freeze(note);
  });
}

/** Import path: Zod-validated + sync-captured, but skips the targetWord+notetype uniqueness guard (imported sibling clones share both). */
export async function putNoteForImport(note: SrsNote): Promise<SrsNote> {
  const parsed = SrsNoteSchema.safeParse(note);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const prev = captured ? await getById<SrsNote>(store, note.id) : undefined;
    const scope = captured
      ? ((await scopeOfDeck(tx, note.deckId)) ??
        (await readRecordMeta(store, `notes:${note.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, note);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsNote', key: `notes:${note.id}`, op: 'put' });
      const prevScope = prev && prev.deckId !== note.deckId ? await scopeOfDeck(tx, prev.deckId) : null;
      if (prevScope && prevScope !== scope) {
        await captureChange(store, { scope: prevScope, dataClass: 'srsNote', key: `notes:${note.id}`, op: 'delete' });
      }
    }
    return Object.freeze(note);
  });
}

export async function deleteNote(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const row = await getById<SrsNote>(store, id);
    let scope = captured && row ? await scopeOfDeck(tx, row.deckId) : null;
    if (!scope && captured) {
      scope = (await readRecordMeta(store, `notes:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsNote', key: `notes:${id}`, op: 'delete' });
    }
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
