import { SrsCardSchema } from '@/entities/srs/schemas';
import type { SrsCard } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfDeck } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.CARDS, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

export async function getCard(id: string): Promise<SrsCard> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const record = await getById<SrsCard>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Card ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putCard(card: SrsCard): Promise<SrsCard> {
  if (!card.id || !card.noteId || !card.deckId) {
    throw new SrsError('INVALID_INPUT', 'Card id, noteId and deckId are required');
  }

  const parsed = SrsCardSchema.safeParse(card);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const existing = await getCardByNoteAndDeckInStore(store, card.noteId, card.deckId);
    if (existing && existing.id !== card.id) {
      throw new SrsError('DUPLICATE', `Card for noteId ${card.noteId} and deckId ${card.deckId} already exists`);
    }
    const captured = isCaptureEnabled();
    const prev = captured ? await getById<SrsCard>(store, card.id) : undefined;
    const scope = captured
      ? ((await scopeOfDeck(tx, card.deckId)) ??
        (await readRecordMeta(store, `cards:${card.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, card);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsCard', key: `cards:${card.id}`, op: 'put' });
      const prevScope = prev && prev.deckId !== card.deckId ? await scopeOfDeck(tx, prev.deckId) : null;
      if (prevScope && prevScope !== scope) {
        await captureChange(store, { scope: prevScope, dataClass: 'srsCard', key: `cards:${card.id}`, op: 'delete' });
      }
    }
    return Object.freeze(card);
  });
}

/** Import path: Zod-validated + sync-captured, but skips the noteId+deckId uniqueness guard (imported sibling cards intentionally share a note's deck). */
export async function putCardForImport(card: SrsCard): Promise<SrsCard> {
  const parsed = SrsCardSchema.safeParse(card);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const prev = captured ? await getById<SrsCard>(store, card.id) : undefined;
    const scope = captured
      ? ((await scopeOfDeck(tx, card.deckId)) ??
        (await readRecordMeta(store, `cards:${card.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, card);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsCard', key: `cards:${card.id}`, op: 'put' });
      const prevScope = prev && prev.deckId !== card.deckId ? await scopeOfDeck(tx, prev.deckId) : null;
      if (prevScope && prevScope !== scope) {
        await captureChange(store, { scope: prevScope, dataClass: 'srsCard', key: `cards:${card.id}`, op: 'delete' });
      }
    }
    return Object.freeze(card);
  });
}

export async function deleteCard(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const row = await getById<SrsCard>(store, id);
    let scope = captured && row ? await scopeOfDeck(tx, row.deckId) : null;
    if (!scope && captured) {
      scope = (await readRecordMeta(store, `cards:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsCard', key: `cards:${id}`, op: 'delete' });
    }
  });
}

export async function getCardsByNote(noteId: string): Promise<readonly SrsCard[]> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const records = await getAllByIndex<SrsCard>(store, SRS_INDEXES.by_note, noteId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsCard[];
  });
}

export async function getCardsByDeck(deckId: string): Promise<readonly SrsCard[]> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const records = await getAllByIndex<SrsCard>(store, SRS_INDEXES.by_deck, deckId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsCard[];
  });
}

export async function getCardByNoteAndDeck(noteId: string, deckId: string): Promise<SrsCard | undefined> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const record = await getCardByNoteAndDeckInStore(store, noteId, deckId);
    return record ? Object.freeze(record) : undefined;
  });
}

/** Collect card IDs from a deck with nextDue <= before, up to maxResults. */
export async function getCardIdsByDeckDueBefore(deckId: string, before: string, maxResults: number): Promise<string[]> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const range = IDBKeyRange.bound([deckId, ''], [deckId, before]);
    const records = await getAllByIndex<SrsCard>(store, SRS_INDEXES.by_deck_due, range, maxResults);
    return records.map((c) => c.id);
  });
}

/** Batch fetch cards by id. */
export async function getCardsByIds(ids: readonly string[]): Promise<SrsCard[]> {
  return withReadonlyStore(SRS_STORES.CARDS, async (store) => {
    const records = await Promise.all(ids.map((id) => getById<SrsCard>(store, id)));
    return records.filter((c): c is SrsCard => c !== undefined).map((c) => Object.freeze(c));
  });
}

async function getCardByNoteAndDeckInStore(
  store: IDBObjectStore,
  noteId: string,
  deckId: string,
): Promise<SrsCard | undefined> {
  const records = await getAllByIndex<SrsCard>(store, SRS_INDEXES.by_note, noteId);
  return records.find((c) => c.deckId === deckId);
}
