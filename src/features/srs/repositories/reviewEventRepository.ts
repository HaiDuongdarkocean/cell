import { SrsReviewRecordSchema } from '@/entities/srs/schemas';
import type { SrsReviewRecord } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

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

  return withStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    await putRecord(store, event);
    return Object.freeze(event);
  });
}

export async function deleteReviewEvent(id: string): Promise<void> {
  return withStore(SRS_STORES.REVIEW_EVENTS, async (store) => {
    await deleteRecord(store, id);
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
