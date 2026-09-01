import { SrsNotetypeSchema } from '@/entities/srs/schemas';
import type { SrsNotetype } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

export async function getNotetype(id: string): Promise<SrsNotetype> {
  return withReadonlyStore(SRS_STORES.NOTETYPES, async (store) => {
    const record = await getById<SrsNotetype>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Notetype ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putNotetype(notetype: SrsNotetype): Promise<SrsNotetype> {
  if (!notetype.id || !notetype.collectionId || !notetype.name) {
    throw new SrsError('INVALID_INPUT', 'Notetype id, collectionId and name are required');
  }

  const targetField = notetype.fields.find((f) => f.id === notetype.targetFieldId);
  if (!targetField || targetField.type !== 'text') {
    throw new SrsError('INVALID_INPUT', `targetFieldId ${notetype.targetFieldId} must point to a text field`);
  }

  const parsed = SrsNotetypeSchema.safeParse(notetype);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  return withStore(SRS_STORES.NOTETYPES, async (store) => {
    await putRecord(store, notetype);
    return Object.freeze(notetype);
  });
}

export async function deleteNotetype(id: string): Promise<void> {
  return withStore(SRS_STORES.NOTETYPES, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getNotetypesByCollection(collectionId: string): Promise<readonly SrsNotetype[]> {
  return withReadonlyStore(SRS_STORES.NOTETYPES, async (store) => {
    const records = await getAllByIndex<SrsNotetype>(store, SRS_INDEXES.by_collection, collectionId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsNotetype[];
  });
}

export async function getNotetypesByTargetField(fieldId: string): Promise<readonly SrsNotetype[]> {
  const all = await getAllNotetypes();
  return all.filter((n) => n.targetFieldId === fieldId);
}

/** Batch fetch notetypes by id. */
export async function getNotetypesByIds(ids: readonly string[]): Promise<SrsNotetype[]> {
  return withReadonlyStore(SRS_STORES.NOTETYPES, async (store) => {
    const records = await Promise.all(ids.map((id) => getById<SrsNotetype>(store, id)));
    return records.filter((n): n is SrsNotetype => n !== undefined).map((n) => Object.freeze(n));
  });
}

export async function getAllNotetypes(): Promise<readonly SrsNotetype[]> {
  return withReadonlyStore(SRS_STORES.NOTETYPES, async (store) => {
    const request = store.getAll();
    const records = await new Promise<SrsNotetype[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SrsNotetype[]);
      request.onerror = () => reject(request.error);
    });
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsNotetype[];
  });
}
