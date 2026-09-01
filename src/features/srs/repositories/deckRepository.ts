import type { SrsDeck } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

export async function getDeck(id: string): Promise<SrsDeck> {
  return withReadonlyStore(SRS_STORES.DECKS, async (store) => {
    const record = await getById<SrsDeck>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Deck ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putDeck(deck: SrsDeck): Promise<SrsDeck> {
  if (!deck.id || !deck.collectionId || !deck.name) {
    throw new SrsError('INVALID_INPUT', 'Deck id, collectionId and name are required');
  }
  return withStore(SRS_STORES.DECKS, async (store) => {
    await putRecord(store, deck);
    return Object.freeze(deck);
  });
}

export async function deleteDeck(id: string): Promise<void> {
  return withStore(SRS_STORES.DECKS, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getDecksByCollection(collectionId: string): Promise<readonly SrsDeck[]> {
  return withReadonlyStore(SRS_STORES.DECKS, async (store) => {
    const records = await getAllByIndex<SrsDeck>(store, SRS_INDEXES.by_collection, collectionId);
    const sorted = records.slice().sort((a, b) => a.order - b.order);
    return Object.freeze(sorted.map((d) => Object.freeze(d))) as unknown as readonly SrsDeck[];
  });
}

export async function getDecksByParent(parentId: string | null): Promise<readonly SrsDeck[]> {
  return withReadonlyStore(SRS_STORES.DECKS, async (store) => {
    const records = await getAllByIndex<SrsDeck>(store, SRS_INDEXES.by_parent, parentId ?? '');
    const sorted = records.slice().sort((a, b) => a.order - b.order);
    return Object.freeze(sorted.map((d) => Object.freeze(d))) as unknown as readonly SrsDeck[];
  });
}

export async function getRootDecksByCollection(collectionId: string): Promise<readonly SrsDeck[]> {
  const all = await getDecksByCollection(collectionId);
  return all.filter((d) => d.parentId === null);
}

export async function getSubDecks(parentId: string): Promise<readonly SrsDeck[]> {
  return getDecksByParent(parentId);
}

export async function getDeckByCollectionAndName(
  collectionId: string,
  name: string,
): Promise<SrsDeck | undefined> {
  const decks = await getDecksByCollection(collectionId);
  const record = decks.find((d) => d.name === name);
  return record ? Object.freeze(record) : undefined;
}
