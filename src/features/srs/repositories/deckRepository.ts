import type { SrsDeck } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfCollection, announceStudyConfig } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

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
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const prev = captured ? await getById<SrsDeck>(store, deck.id) : undefined;
    const scope = captured
      ? ((await scopeOfCollection(tx, deck.collectionId)) ??
        (await readRecordMeta(store, `decks:${deck.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, deck);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsDeck', key: `decks:${deck.id}`, op: 'put' });
      const prevScope = prev && prev.collectionId !== deck.collectionId
        ? await scopeOfCollection(tx, prev.collectionId)
        : null;
      if (prevScope && prevScope !== scope) {
        await captureChange(store, { scope: prevScope, dataClass: 'srsDeck', key: `decks:${deck.id}`, op: 'delete' });
      }
      if (deck.studyConfigId) {
        await announceStudyConfig(store, scope, deck.studyConfigId);
      }
    }
    return Object.freeze(deck);
  });
}

export async function deleteDeck(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const row = await getById<SrsDeck>(store, id);
    let scope = captured && row ? await scopeOfCollection(tx, row.collectionId) : null;
    if (!scope && captured) {
      scope = (await readRecordMeta(store, `decks:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsDeck', key: `decks:${id}`, op: 'delete' });
    }
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
