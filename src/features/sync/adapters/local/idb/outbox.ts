import { idbRequest } from '@/shared/lib/storage/idb';
import { compareHlc } from '../../../domain/hlc';
import type { ChangeRecord, DataClass, PendingKey, RecordKey, Scope } from '../../../domain/types';
import type { ChangeOp, Hlc } from '../../../domain/types';
import { SYNC_META, SYNC_OUTBOX, metaPk } from './capture';
import type { StoredRecordMeta } from './capture';

export const OUTBOX_KEY_INDEX = 'by_key';

export interface OutboxRow {
  readonly scope: Scope | null;
  readonly dataClass: DataClass;
  readonly key: RecordKey;
  readonly op: ChangeOp;
}

export interface PendingDrain {
  readonly pending: PendingKey;
  readonly rowIds: readonly number[];
}

export function awaitIdbTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function keyPrefixRange(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, `${prefix}￿`);
}

interface KeyRows {
  readonly scoped: Map<string, { scope: Scope; op: ChangeOp; dataClass: DataClass; rowIds: number[] }>;
  readonly nullRowIds: number[];
}

export async function listPending(
  db: IDBDatabase,
  keyPrefix: string,
  limit: number,
): Promise<PendingDrain[]> {
  if (limit <= 0) return [];
  const tx = db.transaction(SYNC_OUTBOX, 'readonly');
  const index = tx.objectStore(SYNC_OUTBOX).index(OUTBOX_KEY_INDEX);
  const byKey = new Map<RecordKey, KeyRows>();
  const order: RecordKey[] = [];
  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(keyPrefixRange(keyPrefix));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const row = cursor.value as OutboxRow;
      const group = byKey.get(row.key);
      if (!group && byKey.size >= limit) {
        resolve();
        return;
      }
      const rowId = cursor.primaryKey as number;
      const entry =
        group ??
        ({
          scoped: new Map(),
          nullRowIds: [] as number[],
        } satisfies KeyRows);
      if (!group) {
        byKey.set(row.key, entry);
        order.push(row.key);
      }
      if (row.scope === null) {
        entry.nullRowIds.push(rowId);
      } else {
        const scoped =
          entry.scoped.get(row.scope) ??
          { scope: row.scope, op: row.op, dataClass: row.dataClass, rowIds: [] };
        scoped.op = row.op;
        scoped.rowIds.push(rowId);
        entry.scoped.set(row.scope, scoped);
      }
      cursor.continue();
    };
  });
  const drains: PendingDrain[] = [];
  for (const key of order) {
    const entry = byKey.get(key);
    if (!entry || entry.scoped.size === 0) continue;
    const scopedGroups = [...entry.scoped.values()];
    const newest = scopedGroups.reduce((a, b) =>
      (a.rowIds[a.rowIds.length - 1] ?? -1) > (b.rowIds[b.rowIds.length - 1] ?? -1) ? a : b,
    );
    for (const group of scopedGroups) {
      const rowIds = group === newest ? [...group.rowIds, ...entry.nullRowIds] : group.rowIds;
      drains.push({
        pending: { scope: group.scope, dataClass: group.dataClass, key, op: group.op },
        rowIds,
      });
    }
  }
  return drains;
}

export async function hasPendingRowAt(
  tx: IDBTransaction,
  scope: Scope,
  key: RecordKey,
): Promise<boolean> {
  const rows = await idbRequest(
    tx.objectStore(SYNC_OUTBOX).index(OUTBOX_KEY_INDEX).getAll(key) as IDBRequest<
      OutboxRow[] | undefined
    >,
  );
  return (rows ?? []).some((row) => row.scope === scope || row.scope === null);
}

export async function deleteOutboxEntries(
  db: IDBDatabase,
  rowIds: readonly number[],
): Promise<void> {
  if (rowIds.length === 0) return;
  const tx = db.transaction(SYNC_OUTBOX, 'readwrite');
  const store = tx.objectStore(SYNC_OUTBOX);
  for (const id of rowIds) store.delete(id);
  await awaitIdbTx(tx);
}

export function getMetaAt(
  tx: IDBTransaction,
  key: RecordKey,
  scope: Scope | null,
): Promise<StoredRecordMeta | undefined> {
  return idbRequest(
    tx.objectStore(SYNC_META).get(metaPk(scope, key)) as IDBRequest<StoredRecordMeta | undefined>,
  );
}

export function getMetaByRecKeyAt(
  tx: IDBTransaction,
  key: RecordKey,
): Promise<StoredRecordMeta[]> {
  return idbRequest(
    tx.objectStore(SYNC_META).index('by_recKey').getAll(key) as IDBRequest<StoredRecordMeta[]>,
  ).then((rows) => rows ?? []);
}

export async function latestMetaByRecKeyAt(
  tx: IDBTransaction,
  key: RecordKey,
): Promise<StoredRecordMeta | undefined> {
  const rows = await getMetaByRecKeyAt(tx, key);
  let best: StoredRecordMeta | undefined;
  for (const row of rows) {
    if (!best || compareHlc(row.hlc, best.hlc) > 0) best = row;
  }
  return best;
}

export async function getMeta(
  db: IDBDatabase,
  key: RecordKey,
  scope: Scope | null,
): Promise<StoredRecordMeta | undefined> {
  const tx = db.transaction(SYNC_META, 'readonly');
  return getMetaAt(tx, key, scope);
}

export function listMetaEntriesIn(
  tx: IDBTransaction,
  keyPrefix: string,
): Promise<StoredRecordMeta[]> {
  return idbRequest(
    tx.objectStore(SYNC_META).index('by_recKey').getAll(keyPrefixRange(keyPrefix)) as IDBRequest<
      StoredRecordMeta[]
    >,
  ).then((rows) => rows ?? []);
}

export async function listMetaEntries(
  db: IDBDatabase,
  keyPrefix: string,
): Promise<StoredRecordMeta[]> {
  const tx = db.transaction(SYNC_META, 'readonly');
  return listMetaEntriesIn(tx, keyPrefix);
}

export async function putMetaAt(tx: IDBTransaction, meta: StoredRecordMeta): Promise<void> {
  await idbRequest(tx.objectStore(SYNC_META).put(meta));
}

export async function tombstoneMetaAt(
  tx: IDBTransaction,
  key: RecordKey,
  scope: Scope,
  hlc: Hlc,
): Promise<void> {
  const prev = await getMetaAt(tx, key, scope);
  if (prev && compareHlc(prev.hlc, hlc) > 0) return;
  await putMetaAt(tx, {
    key: metaPk(scope, key),
    recKey: key,
    scope,
    hlc,
    firstHlc: prev?.firstHlc ?? prev?.hlc ?? hlc,
    op: 'delete',
    valueHash: prev?.valueHash,
  });
}

export function metaChangeRecord(
  scope: Scope,
  dataClass: DataClass,
  key: RecordKey,
  meta: Pick<StoredRecordMeta, 'hlc' | 'firstHlc' | 'op'>,
  value?: unknown,
): ChangeRecord {
  if (meta.op === 'delete') {
    return { scope, dataClass, key, op: 'delete', hlc: meta.hlc, firstHlc: meta.firstHlc };
  }
  return {
    scope,
    dataClass,
    key,
    op: 'put',
    value,
    hlc: meta.hlc,
    firstHlc: meta.firstHlc,
  };
}

export function getRowAt<T>(tx: IDBTransaction, storeName: string, key: string): Promise<T | undefined> {
  return idbRequest(tx.objectStore(storeName).get(key) as IDBRequest<T | undefined>);
}

export function allRowsAt<T>(tx: IDBTransaction, storeName: string): Promise<T[]> {
  return idbRequest(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
}

export function rowsByIndexAt<T>(
  tx: IDBTransaction,
  storeName: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  return idbRequest(tx.objectStore(storeName).index(indexName).getAll(key) as IDBRequest<T[]>);
}
