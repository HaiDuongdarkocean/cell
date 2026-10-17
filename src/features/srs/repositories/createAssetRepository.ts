import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import type { DataClass } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfAsset } from './srsSyncScope';
import { idbRequest } from '@/shared/lib/storage/idb';

export function createAssetRepository<T extends { id: string; noteId: string; fieldId: string }>(cfg: {
  store: string;
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } };
  dataClass: string;
  keyPrefix: string;
  label: string;
}): {
  get: (id: string) => Promise<T>;
  put: (asset: T) => Promise<T>;
  del: (id: string) => Promise<void>;
  getByNote: (noteId: string) => Promise<readonly T[]>;
  getAll: () => Promise<readonly T[]>;
} {
  const WRITE_STORES = [cfg.store, SRS_STORES.NOTES, SRS_STORES.DECKS, SRS_STORES.COLLECTIONS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];
  const keyOf = (id: string): string => `${cfg.keyPrefix}:${id}`;

  function asArrayBuffer(value: ArrayBuffer): ArrayBuffer {
    if (value instanceof ArrayBuffer) return value;
    const view = new Uint8Array(value as ArrayBufferLike);
    return view.slice().buffer;
  }

  async function get(id: string): Promise<T> {
    return withReadonlyStore(cfg.store, async (store) => {
      const record = await getById<T>(store, id);
      if (!record) throw new SrsError('NOT_FOUND', `${cfg.label} asset ${id} not found`);
      return Object.freeze(record) as T;
    });
  }

  async function put(asset: T): Promise<T> {
    if (!asset.id || !asset.noteId || !asset.fieldId) {
      throw new SrsError('INVALID_INPUT', `${cfg.label} asset id, noteId and fieldId are required`);
    }

    const normalized = {
      ...asset,
      bytes: asArrayBuffer((asset as unknown as { bytes: ArrayBuffer }).bytes),
    } as T;

    const parsed = cfg.schema.safeParse(normalized);
    if (!parsed.success) {
      throw new SrsError('INVALID_INPUT', parsed.error?.issues.map((e) => e.message).join('; ') ?? '');
    }

    await ensureSyncRuntime();
    return withStore(WRITE_STORES, async (store, tx) => {
      const captured = isCaptureEnabled();
      const scope = captured
        ? ((await scopeOfAsset(tx, normalized)) ??
          (await readRecordMeta(store, keyOf(normalized.id)))?.scope ??
          null)
        : null;
      await putRecord(store, normalized);
      if (captured) {
        await captureChange(store, { scope, dataClass: cfg.dataClass as DataClass, key: keyOf(normalized.id), op: 'put' });
      }
      return Object.freeze(normalized) as T;
    });
  }

  async function del(id: string): Promise<void> {
    await ensureSyncRuntime();
    return withStore(WRITE_STORES, async (store, tx) => {
      const captured = isCaptureEnabled();
      const row = await getById<T>(store, id);
      let scope = captured && row ? await scopeOfAsset(tx, row) : null;
      if (!scope && captured) {
        scope = (await readRecordMeta(store, keyOf(id)))?.scope ?? null;
      }
      await deleteRecord(store, id);
      if (captured) {
        await captureChange(store, { scope, dataClass: cfg.dataClass as DataClass, key: keyOf(id), op: 'delete' });
      }
    });
  }

  async function getByNote(noteId: string): Promise<readonly T[]> {
    return withReadonlyStore(cfg.store, async (store) => {
      const records = await getAllByIndex<T>(store, SRS_INDEXES.by_note, noteId);
      return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly T[];
    });
  }

  async function getAll(): Promise<readonly T[]> {
    return withReadonlyStore(cfg.store, async (store) => {
      const records = await idbRequest(store.getAll());
      return Object.freeze(records.map((r) => Object.freeze(r))) as unknown as readonly T[];
    });
  }

  return { get, put, del, getByNote, getAll };
}
