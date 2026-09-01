import type { SrsCollection } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getByIndex } from './srsRepositoryHelpers';

export async function getCollection(id: string): Promise<SrsCollection> {
  return withReadonlyStore(SRS_STORES.COLLECTIONS, async (store) => {
    const record = await getById<SrsCollection>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Collection ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putCollection(collection: SrsCollection): Promise<SrsCollection> {
  if (!collection.id || !collection.targetLanguage) {
    throw new SrsError('INVALID_INPUT', 'Collection id and targetLanguage are required');
  }
  return withStore(SRS_STORES.COLLECTIONS, async (store) => {
    await putRecord(store, collection);
    return Object.freeze(collection);
  });
}

export async function deleteCollection(id: string): Promise<void> {
  return withStore(SRS_STORES.COLLECTIONS, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getCollectionByLanguageProfileId(
  languageProfileId: string,
): Promise<SrsCollection | undefined> {
  return withReadonlyStore(SRS_STORES.COLLECTIONS, async (store) => {
    const record = await getByIndex<SrsCollection>(
      store,
      SRS_INDEXES.by_languageProfileId,
      languageProfileId,
    );
    return record ? Object.freeze(record) : undefined;
  });
}

export async function getAllCollections(): Promise<readonly SrsCollection[]> {
  return withReadonlyStore(SRS_STORES.COLLECTIONS, async (store) => {
    const request = store.getAll();
    const records = await new Promise<SrsCollection[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SrsCollection[]);
      request.onerror = () => reject(request.error);
    });
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsCollection[];
  });
}
