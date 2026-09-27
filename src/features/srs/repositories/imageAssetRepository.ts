import { SrsImageAssetSchema } from '@/entities/srs/schemas';
import type { SrsImageAsset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfAsset } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.IMAGE_ASSETS, SRS_STORES.NOTES, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

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

  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const scope = captured
      ? ((await scopeOfAsset(tx, normalized)) ??
        (await readRecordMeta(store, `imageAssets:${normalized.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, normalized);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsImageAsset', key: `imageAssets:${normalized.id}`, op: 'put' });
    }
    return Object.freeze(normalized);
  });
}

export async function deleteImageAsset(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const row = await getById<SrsImageAsset>(store, id);
    let scope = captured && row ? await scopeOfAsset(tx, row) : null;
    if (!scope && captured) {
      scope = (await readRecordMeta(store, `imageAssets:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsImageAsset', key: `imageAssets:${id}`, op: 'delete' });
    }
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
