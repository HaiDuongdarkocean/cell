import type { SrsCollection, SrsDeck } from '@/entities/srs/types';
import type { SrsCollectionSummary, SrsSyncAccess } from '@/features/sync';
import { allRowsAt, awaitIdbTx, idbRequest, rowsByIndexAt } from '@/features/sync';
import { SRS_INDEXES, SRS_STORES, getSrsDB } from '../repositories/srsDatabase';

async function listCollectionSummaries(): Promise<SrsCollectionSummary[]> {
  const db = await getSrsDB();
  const tx = db.transaction(
    [SRS_STORES.COLLECTIONS, SRS_STORES.DECKS, SRS_STORES.NOTES],
    'readonly',
  );
  const collections = await allRowsAt<SrsCollection>(tx, SRS_STORES.COLLECTIONS);
  const summaries: SrsCollectionSummary[] = [];
  for (const collection of collections) {
    const decks = await rowsByIndexAt<SrsDeck>(
      tx,
      SRS_STORES.DECKS,
      SRS_INDEXES.by_collection,
      collection.id,
    );
    let noteCount = 0;
    for (const deck of decks) {
      noteCount += await idbRequest(
        tx.objectStore(SRS_STORES.NOTES).index(SRS_INDEXES.by_deck).count(deck.id),
      );
    }
    summaries.push({ collection, deckIds: decks.map((deck) => deck.id), noteCount });
  }
  await awaitIdbTx(tx);
  return summaries;
}

async function rewriteCollectionProfileIds(
  remap: ReadonlyMap<string, string>,
): Promise<number> {
  const db = await getSrsDB();
  const tx = db.transaction([SRS_STORES.COLLECTIONS], 'readwrite');
  const store = tx.objectStore(SRS_STORES.COLLECTIONS);
  const rows = await allRowsAt<SrsCollection>(tx, SRS_STORES.COLLECTIONS);
  let rewritten = 0;
  for (const row of rows) {
    const next = row.languageProfileId === null ? undefined : remap.get(row.languageProfileId);
    if (next === undefined || next === row.languageProfileId) continue;
    await idbRequest(store.put({ ...row, languageProfileId: next }));
    rewritten += 1;
  }
  await awaitIdbTx(tx);
  return rewritten;
}

export function createSrsSyncAccess(): SrsSyncAccess {
  return { listCollectionSummaries, rewriteCollectionProfileIds };
}
