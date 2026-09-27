import type { SrsCollection } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getByIndex } from './srsRepositoryHelpers';
import { collectionScope } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

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
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store) => {
    const scope = isCaptureEnabled() ? await collectionScope(collection) : null;
    await putRecord(store, collection);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsCollection', key: `collections:${collection.id}`, op: 'put' });
      if (collection.defaultStudyConfigId) {
        await captureChange(store, { scope, dataClass: 'studyConfig', key: `studyConfigs:${collection.defaultStudyConfigId}`, op: 'put' });
      }
    }
    return Object.freeze(collection);
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store) => {
    const row = await getById<SrsCollection>(store, id);
    let scope = isCaptureEnabled() && row ? await collectionScope(row) : null;
    if (!scope && isCaptureEnabled()) {
      scope = (await readRecordMeta(store, `collections:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsCollection', key: `collections:${id}`, op: 'delete' });
    }
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
