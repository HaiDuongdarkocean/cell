import { SrsCardSchema } from '@/entities/srs/schemas';
import type { SrsCard } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

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

  return withStore(SRS_STORES.CARDS, async (store) => {
    const existing = await getCardByNoteAndDeckInStore(store, card.noteId, card.deckId);
    if (existing && existing.id !== card.id) {
      throw new SrsError('DUPLICATE', `Card for noteId ${card.noteId} and deckId ${card.deckId} already exists`);
    }
    await putRecord(store, card);
    return Object.freeze(card);
  });
}

export async function deleteCard(id: string): Promise<void> {
  return withStore(SRS_STORES.CARDS, async (store) => {
    await deleteRecord(store, id);
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

async function getCardByNoteAndDeckInStore(
  store: IDBObjectStore,
  noteId: string,
  deckId: string,
): Promise<SrsCard | undefined> {
  const records = await getAllByIndex<SrsCard>(store, SRS_INDEXES.by_note, noteId);
  return records.find((c) => c.deckId === deckId);
}
