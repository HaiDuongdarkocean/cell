import { SrsAudioAssetSchema } from '@/entities/srs/schemas';
import type { SrsAudioAsset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfAsset } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.AUDIO_ASSETS, SRS_STORES.NOTES, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

function asArrayBuffer(value: ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const view = new Uint8Array(value as ArrayBufferLike);
  return view.slice().buffer;
}

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

  const normalized: SrsAudioAsset = { ...asset, bytes: asArrayBuffer(asset.bytes) };

  const parsed = SrsAudioAssetSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new SrsError('INVALID_INPUT', parsed.error.issues.map((e) => e.message).join('; '));
  }

  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const scope = isCaptureEnabled() ? await scopeOfAsset(tx, normalized) : null;
    await putRecord(store, normalized);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsAudioAsset', key: `audioAssets:${normalized.id}`, op: 'put' });
    }
    return Object.freeze(normalized);
  });
}

export async function deleteAudioAsset(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const row = await getById<SrsAudioAsset>(store, id);
    let scope = isCaptureEnabled() && row ? await scopeOfAsset(tx, row) : null;
    if (!scope && isCaptureEnabled()) {
      scope = (await readRecordMeta(store, `audioAssets:${id}`))?.scope ?? null;
    }
    await deleteRecord(store, id);
    if (scope) {
      await captureChange(store, { scope, dataClass: 'srsAudioAsset', key: `audioAssets:${id}`, op: 'delete' });
    }
  });
}

export async function getAudioAssetsByNote(noteId: string): Promise<readonly SrsAudioAsset[]> {
  return withReadonlyStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    const records = await getAllByIndex<SrsAudioAsset>(store, SRS_INDEXES.by_note, noteId);
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsAudioAsset[];
  });
}

export async function getAllAudioAssets(): Promise<readonly SrsAudioAsset[]> {
  return withReadonlyStore(SRS_STORES.AUDIO_ASSETS, async (store) => {
    const request = store.getAll();
    const records = await new Promise<SrsAudioAsset[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SrsAudioAsset[]);
      request.onerror = () => reject(request.error);
    });
    return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly SrsAudioAsset[];
  });
}
