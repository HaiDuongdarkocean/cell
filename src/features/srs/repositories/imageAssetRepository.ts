import { SrsImageAssetSchema } from '@/entities/srs/schemas';
import type { SrsImageAsset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';

function asArrayBuffer(value: ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const view = new Uint8Array(value as ArrayBufferLike);
  return view.slice().buffer;
}

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

  const normalized: SrsImageAsset = { ...asset, bytes: asArrayBuffer(asset.bytes) };

  const parsed = SrsImageAssetSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  return withStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    await putRecord(store, normalized);
    return Object.freeze(normalized);
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

export async function getAllImageAssets(): Promise<readonly SrsImageAsset[]> {
  return withReadonlyStore(SRS_STORES.IMAGE_ASSETS, async (store) => {
    const request = store.getAll();
    const records = await new Promise<SrsImageAsset[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SrsImageAsset[]);
      request.onerror = () => reject(request.error);
    });
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsImageAsset[];
  });
}
