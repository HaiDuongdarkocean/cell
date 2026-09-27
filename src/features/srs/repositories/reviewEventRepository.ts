import { SrsReviewRecordSchema } from '@/entities/srs/schemas';
import type { SrsReviewRecord } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfReviewEvent } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.REVIEW_EVENTS, SRS_STORES.CARDS, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

export async function getReviewEvent(id: string): Promise<SrsReviewRecord> {
  return withReadonlyStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    const record = await getById<SrsReviewRecord>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Review event ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putReviewEvent(event: SrsReviewRecord): Promise<SrsReviewRecord> {
  if (!event.id || !event.cardId || !event.componentType) {
    throw new SrsError('INVALID_INPUT', 'Review event id, cardId and componentType are required');
  }

  const parsed = SrsReviewRecordSchema.safeParse(event);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const scope = isCaptureEnabled() ? await scopeOfReviewEvent(tx, event) : null;
    await putRecord(store, event);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsReviewEvent', key: `reviewEvents:${event.id}`, op: 'put' });
    }
    return Object.freeze(event);
  });
}

export async function deleteReviewEvent(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const row = await getById<SrsReviewRecord>(store, id);
    let scope = isCaptureEnabled() && row ? await scopeOfReviewEvent(tx, row) : null;
    if (!scope && isCaptureEnabled()) {
      scope = (await readRecordMeta(store, `reviewEvents:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsReviewEvent', key: `reviewEvents:${id}`, op: 'delete' });
    }
  });
}

export async function getReviewEventsByCard(cardId: string): Promise<readonly SrsReviewRecord[]> {
  return withReadonlyStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    const records = await getAllByIndex<SrsReviewRecord>(store, SRS_INDEXES.by_card, cardId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsReviewRecord[];
  });
}

export async function getReviewEventsByComponent(
  cardId: string,
  componentType: 'meaning' | 'sound' | 'spelling',
): Promise<readonly SrsReviewRecord[]> {
  return withReadonlyStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    const all = await getAllByIndex<SrsReviewRecord>(store, SRS_INDEXES.by_card, cardId);
    const filtered = all.filter((r) => r.componentType === componentType);
    return Object.freeze(filtered.map((r) => Object.freeze(r))) as unknown as readonly SrsReviewRecord[];
  });
}

export async function getReviewEventsByTimestampRange(
  start: number,
  end: number,
): Promise<readonly SrsReviewRecord[]> {
  return withReadonlyStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    const range = IDBKeyRange.bound(start, end);
    const records = await getAllByIndex<SrsReviewRecord>(store, SRS_INDEXES.by_timestamp, range);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsReviewRecord[];
  });
}
