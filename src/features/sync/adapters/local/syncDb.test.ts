import 'fake-indexeddb/auto';
import type { ChangeRecord, ConnectionId, Scope } from '../../domain/types';
import {
  SYNC_DB_NAME,
  SYNC_DB_SCHEMA_VERSION,
  SYNC_INDEXES,
  SYNC_STORES,
  allocateSeq,
  allocateSnapshotN,
  awaitSyncTx,
  clearDeferredRecords,
  clearOpaqueRecords,
  closeSyncDB,
  deferredRecordKey,
  deleteDeferredRecord,
  deleteOpaqueRecord,
  deleteSyncDB,
  findDeferredRecordsByBlobHash,
  freezeBatch,
  freezeBatchInTx,
  getAllDeferredRecords,
  getAllOpaqueRecords,
  getDeferredRecord,
  getOpaqueRecord,
  getPendingBatch,
  getPendingBatchForScope,
  getSequenceCounters,
  getSyncDB,
  listPendingBatchesByCreatedAt,
  nextSeqFor,
  nextSnapshotNFor,
  opaqueRecordKey,
  pendingBatchKey,
  putDeferredRecord,
  putOpaqueRecord,
  putPendingBatch,
  removePendingBatch,
  sequenceKey,
  takePendingBatches,
} from './syncDb';

const connA = 'google-drive:acct-1' as ConnectionId;
const connB = 'google-drive:acct-2' as ConnectionId;

const record = (key: string, scope: Scope = 'global', wall = 1000): ChangeRecord => ({
  scope,
  dataClass: 'settings',
  key,
  op: 'put',
  value: { v: wall },
  hlc: { wall, counter: 0, node: 'dev-1:ctx-1' },
});

const freezeInput = (connectionId: ConnectionId, scope: Scope, createdAt: number, cycleId = 'cycle-1') => ({
  connectionId,
  scope,
  records: [record('kv:settings/theme', scope), record('kv:settings/locale', scope)],
  cycleId,
  createdAt,
});

const seqsTx = async (
  run: (tx: IDBTransaction) => Promise<number>,
): Promise<number> => {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.SEQUENCES, 'readwrite');
  const value = await run(tx);
  await awaitSyncTx(tx);
  return value;
};

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('syncDb', () => {
  describe('migration', () => {
    it('opens cell-sync at version 1 with all four stores', async () => {
      const db = await getSyncDB();
      expect(db.name).toBe(SYNC_DB_NAME);
      expect(db.version).toBe(SYNC_DB_SCHEMA_VERSION);
      for (const store of Object.values(SYNC_STORES)) {
        expect(db.objectStoreNames.contains(store)).toBe(true);
      }
    });

    it('creates indexes on pendingBatches, deferredRecords and opaqueRecords', async () => {
      const db = await getSyncDB();
      const pending = db
        .transaction(SYNC_STORES.PENDING_BATCHES, 'readonly')
        .objectStore(SYNC_STORES.PENDING_BATCHES);
      expect(pending.indexNames.contains(SYNC_INDEXES.by_connection)).toBe(true);
      expect(pending.indexNames.contains(SYNC_INDEXES.by_connection_scope)).toBe(true);
      expect(pending.indexNames.contains(SYNC_INDEXES.by_createdAt)).toBe(true);
      const deferred = db
        .transaction(SYNC_STORES.DEFERRED_RECORDS, 'readonly')
        .objectStore(SYNC_STORES.DEFERRED_RECORDS);
      expect(deferred.indexNames.contains(SYNC_INDEXES.by_connection)).toBe(true);
      expect(deferred.indexNames.contains(SYNC_INDEXES.by_blobHash)).toBe(true);
      const opaque = db
        .transaction(SYNC_STORES.OPAQUE_RECORDS, 'readonly')
        .objectStore(SYNC_STORES.OPAQUE_RECORDS);
      expect(opaque.indexNames.contains(SYNC_INDEXES.by_scope)).toBe(true);
    });

    it('is idempotent — reopening the same version keeps every store', async () => {
      const first = await getSyncDB();
      const storeCount = first.objectStoreNames.length;
      closeSyncDB();
      const second = await getSyncDB();
      expect(second.objectStoreNames.length).toBe(storeCount);
      expect(second.version).toBe(SYNC_DB_SCHEMA_VERSION);
    });

    it('caches the connection until closeSyncDB', async () => {
      const first = await getSyncDB();
      expect(await getSyncDB()).toBe(first);
      closeSyncDB();
      const reopened = await getSyncDB();
      expect(reopened).not.toBe(first);
    });
  });

  describe('sequences', () => {
    it('allocates the first seq as 1 and persists the counter', async () => {
      const seq = await seqsTx((tx) => allocateSeq(connA, 'global', tx));
      expect(seq).toBe(1);
      const row = await getSequenceCounters(connA, 'global');
      expect(row).toEqual({ key: sequenceKey(connA, 'global'), nextSeq: 2, nextSnapshotN: 1 });
    });

    it('allocates seq and snapshotN independently per (connectionId, scope)', async () => {
      expect(await seqsTx((tx) => allocateSeq(connA, 'global', tx))).toBe(1);
      expect(await seqsTx((tx) => allocateSeq(connA, 'global', tx))).toBe(2);
      expect(await seqsTx((tx) => allocateSeq(connA, 'profile:en', tx))).toBe(1);
      expect(await seqsTx((tx) => allocateSeq(connB, 'global', tx))).toBe(1);
      expect(await seqsTx((tx) => allocateSnapshotN(connA, 'global', tx))).toBe(1);
      expect(await seqsTx((tx) => allocateSnapshotN(connA, 'global', tx))).toBe(2);
      expect(await nextSeqFor(connA, 'global')).toBe(3);
      expect(await nextSnapshotNFor(connA, 'global')).toBe(3);
    });

    it('nextSeqFor/nextSnapshotNFor read without allocating', async () => {
      expect(await nextSeqFor(connA, 'global')).toBe(1);
      expect(await nextSeqFor(connA, 'global')).toBe(1);
      expect(await nextSnapshotNFor(connA, 'global')).toBe(1);
      expect(await getSequenceCounters(connA, 'global')).toBeUndefined();
    });

    it('serializes concurrent allocations through the IDB transaction', async () => {
      const [a, b] = await Promise.all([
        freezeBatch(freezeInput(connA, 'global', 1, 'cycle-a')),
        freezeBatch(freezeInput(connA, 'global', 2, 'cycle-b')),
      ]);
      expect([a.seq, b.seq].sort()).toEqual([1, 2]);
      expect(a.key).not.toBe(b.key);
    });
  });

  describe('pendingBatches', () => {
    it('freezeBatch allocates seq inside the same transaction as the stored batch', async () => {
      const batch = await freezeBatch(freezeInput(connA, 'global', 5000));
      expect(batch.seq).toBe(1);
      expect(batch.key).toBe(pendingBatchKey(connA, 'global', 1));
      const stored = await getPendingBatch(batch.key);
      expect(stored).toEqual(batch);
      expect(stored?.records).toHaveLength(2);
      expect(await nextSeqFor(connA, 'global')).toBe(2);
    });

    it('freezeBatchInTx stores the batch on a caller-owned transaction', async () => {
      const db = await getSyncDB();
      const tx = db.transaction(
        [SYNC_STORES.SEQUENCES, SYNC_STORES.PENDING_BATCHES],
        'readwrite',
      );
      const batch = await freezeBatchInTx(freezeInput(connA, 'profile:en', 7000), tx);
      await awaitSyncTx(tx);
      expect(batch.seq).toBe(1);
      expect(await getPendingBatchForScope(connA, 'profile:en')).toEqual(batch);
    });

    it('keeps counters monotonic when batches are removed (compaction never resets)', async () => {
      const first = await freezeBatch(freezeInput(connA, 'global', 1));
      await removePendingBatch(first.key);
      expect(await takePendingBatches(connA)).toEqual([]);
      const snapshotN = await seqsTx((tx) => allocateSnapshotN(connA, 'global', tx));
      expect(snapshotN).toBe(1);
      const second = await freezeBatch(freezeInput(connA, 'global', 2, 'cycle-2'));
      expect(second.seq).toBe(2);
      expect(await nextSnapshotNFor(connA, 'global')).toBe(2);
    });

    it('takePendingBatches returns only that connection’s batches in scope+seq order', async () => {
      const g1 = await freezeBatch(freezeInput(connA, 'global', 1));
      const p1 = await freezeBatch(freezeInput(connA, 'profile:en', 2));
      const g2 = await freezeBatch(freezeInput(connA, 'global', 3));
      await freezeBatch(freezeInput(connB, 'global', 4));
      const taken = await takePendingBatches(connA);
      expect(taken.map((b) => b.key)).toEqual([g1.key, g2.key, p1.key]);
    });

    it('listPendingBatchesByCreatedAt orders ascending and filters by connection', async () => {
      const late = await freezeBatch(freezeInput(connA, 'global', 9000));
      const early = await freezeBatch(freezeInput(connA, 'global', 1000));
      const other = await freezeBatch(freezeInput(connB, 'global', 500));
      const all = await listPendingBatchesByCreatedAt();
      expect(all.map((b) => b.key)).toEqual([other.key, early.key, late.key]);
      const onlyA = await listPendingBatchesByCreatedAt(connA);
      expect(onlyA.map((b) => b.key)).toEqual([early.key, late.key]);
    });

    it('putPendingBatch upserts a row for replayed writes', async () => {
      const batch = await freezeBatch(freezeInput(connA, 'global', 1));
      await putPendingBatch({ ...batch, cycleId: 'cycle-retry' });
      expect((await getPendingBatch(batch.key))?.cycleId).toBe('cycle-retry');
    });
  });

  describe('deferredRecords', () => {
    const deferredInput = (key: string, hashes: string[]) => ({
      connectionId: connA,
      sourcePath: 'cell-sync/v1/scopes/global/devices/dev-9/journal-4.json.gz',
      record: record(key, 'profile:en'),
      requiredBlobHashes: hashes,
      firstDeferredAt: 1234,
      attempts: 0,
    });

    it('round-trips the full record with required blob hashes', async () => {
      const row = await putDeferredRecord(deferredInput('book:b1', ['hash-1', 'hash-2']));
      expect(row.key).toBe(
        deferredRecordKey(connA, 'profile:en', 'dev-1:ctx-1', 'book:b1'),
      );
      const stored = await getDeferredRecord(row.key);
      expect(stored?.record).toEqual(record('book:b1', 'profile:en'));
      expect(stored?.requiredBlobHashes).toEqual(['hash-1', 'hash-2']);
      expect(stored?.firstDeferredAt).toBe(1234);
      expect(stored?.attempts).toBe(0);
      expect(stored?.sourcePath).toContain('journal-4');
    });

    it('updates attempts on re-put', async () => {
      const row = await putDeferredRecord(deferredInput('book:b1', ['hash-1']));
      await putDeferredRecord({ ...deferredInput('book:b1', ['hash-1']), attempts: 3 });
      expect((await getDeferredRecord(row.key))?.attempts).toBe(3);
    });

    it('finds deferred records by any required blob hash', async () => {
      await putDeferredRecord(deferredInput('book:b1', ['hash-1', 'hash-2']));
      await putDeferredRecord(deferredInput('book:b2', ['hash-3']));
      const hits = await findDeferredRecordsByBlobHash('hash-2');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.recordKey).toBe('book:b1');
    });

    it('getAllDeferredRecords filters by connection', async () => {
      await putDeferredRecord(deferredInput('book:b1', []));
      await putDeferredRecord({ ...deferredInput('book:b2', []), connectionId: connB });
      const all = await getAllDeferredRecords();
      expect(all).toHaveLength(2);
      const onlyA = await getAllDeferredRecords(connA);
      expect(onlyA).toHaveLength(1);
      expect(onlyA[0]?.recordKey).toBe('book:b1');
    });

    it('deleteDeferredRecord removes one row; clearDeferredRecords empties the store', async () => {
      const a = await putDeferredRecord(deferredInput('book:b1', []));
      await putDeferredRecord(deferredInput('book:b2', []));
      await deleteDeferredRecord(a.key);
      expect(await getAllDeferredRecords()).toHaveLength(1);
      await clearDeferredRecords();
      expect(await getAllDeferredRecords()).toEqual([]);
    });
  });

  describe('opaqueRecords', () => {
    it('round-trips put/get with scope and record key derived from the record', async () => {
      const row = await putOpaqueRecord(record('weird:new-thing/x', 'global'));
      expect(row.key).toBe(opaqueRecordKey('global', 'weird:new-thing/x'));
      expect(row.scope).toBe('global');
      const stored = await getOpaqueRecord(row.key);
      expect(stored?.record).toEqual(record('weird:new-thing/x', 'global'));
    });

    it('getAllOpaqueRecords lists every scope or filters by scope', async () => {
      await putOpaqueRecord(record('k1', 'global'));
      await putOpaqueRecord(record('k2', 'profile:en'));
      await putOpaqueRecord(record('k3', 'profile:en'));
      expect(await getAllOpaqueRecords()).toHaveLength(3);
      expect(await getAllOpaqueRecords('profile:en')).toHaveLength(2);
      expect(await getAllOpaqueRecords('profile:ja')).toEqual([]);
    });

    it('deleteOpaqueRecord removes one row; clearOpaqueRecords deletes all or per scope', async () => {
      const a = await putOpaqueRecord(record('k1', 'global'));
      await putOpaqueRecord(record('k2', 'global'));
      await putOpaqueRecord(record('k3', 'profile:en'));
      await deleteOpaqueRecord(a.key);
      expect(await getAllOpaqueRecords()).toHaveLength(2);
      await clearOpaqueRecords('global');
      const rest = await getAllOpaqueRecords();
      expect(rest).toHaveLength(1);
      expect(rest[0]?.scope).toBe('profile:en');
      await clearOpaqueRecords();
      expect(await getAllOpaqueRecords()).toEqual([]);
    });
  });
});
