import { SrsImageAssetSchema } from '@/entities/srs/schemas';
import type { SrsImageAsset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

export async function getImageAsset(id: string): Promise<SrsImageAsset> {
  return withReadonlyStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    const record = await getById<SrsImageAsset>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Image asset ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putImageAsset(asset: SrsImageAsset): Promise<SrsImageAsset> {
  if (!asset.id || !asset.noteId || !asset.fieldId) {
    throw new SrsError('INVALID_INPUT', 'Image asset id, noteId and fieldId are required');
  }

  const parsed = SrsImageAssetSchema.safeParse(asset);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  return withStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    await putRecord(store, asset);
    return Object.freeze(asset);
  });
}

export async function deleteImageAsset(id: string): Promise<void> {
  return withStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getImageAssetsByNote(noteId: string): Promise<readonly SrsImageAsset[]> {
  return withReadonlyStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    const records = await getAllByIndex<SrsImageAsset>(store, SRS_INDEXES.by_note, noteId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsImageAsset[];
  });
}
