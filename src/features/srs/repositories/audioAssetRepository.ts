import { SrsAudioAssetSchema } from '@/entities/srs/schemas';
import type { SrsAudioAsset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

export async function getAudioAsset(id: string): Promise<SrsAudioAsset> {
  return withReadonlyStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    const record = await getById<SrsAudioAsset>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `Audio asset ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putAudioAsset(asset: SrsAudioAsset): Promise<SrsAudioAsset> {
  if (!asset.id || !asset.noteId || !asset.fieldId) {
    throw new SrsError('INVALID_INPUT', 'Audio asset id, noteId and fieldId are required');
  }

  const parsed = SrsAudioAssetSchema.safeParse(asset);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  return withStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    await putRecord(store, asset);
    return Object.freeze(asset);
  });
}

export async function deleteAudioAsset(id: string): Promise<void> {
  return withStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    await deleteRecord(store, id);
  });
}

export async function getAudioAssetsByNote(noteId: string): Promise<readonly SrsAudioAsset[]> {
  return withReadonlyStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    const records = await getAllByIndex<SrsAudioAsset>(store, SRS_INDEXES.by_note, noteId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsAudioAsset[];
  });
}
