import type { ConnectionId, Scope } from '../domain/types';
import {
  allocateSnapshotN,
  awaitSyncTx,
  deleteDeferredRecord,
  findDeferredRecordsByBlobHash,
  freezeBatch,
  nextSeqFor,
  getAllDeferredRecords,
  getAllOpaqueRecords,
  getSyncDB,
  putDeferredRecord,
  putOpaqueRecord,
  deleteOpaqueRecord,
  removePendingBatch,
  SYNC_STORES,
  takePendingBatches,
} from '../adapters/local/syncDb';
import type { DeferRecordInput, DeferredRecord, SyncStore } from './syncStore';

export function createSyncDbStore(): SyncStore {
  return {
    freezeBatch: (input) => freezeBatch(input),
    nextSeqFor: (connectionId, scope) => nextSeqFor(connectionId, scope),
    pendingBatches: (connectionId) => takePendingBatches(connectionId),
    deletePendingBatch: (key) => removePendingBatch(key),
    allocateSnapshotN: (connectionId, scope) => allocateSnapshotNStandalone(connectionId, scope),
    deferRecord: (input) => putDeferredRecord(toRowInput(input)),
    listDeferred: (connectionId) => getAllDeferredRecords(connectionId),
    listAllDeferred: () => getAllDeferredRecords(),
    deferredByBlobHash: (contentHash) => findDeferredRecordsByBlobHash(contentHash),
    updateDeferred: (row) => putDeferredRecord(toRowInput(row)),
    deleteDeferred: (key) => deleteDeferredRecord(key),
    putOpaque: async (record) => {
      await putOpaqueRecord(record);
    },
    listOpaque: (scope) => getAllOpaqueRecords(scope),
    deleteOpaque: (key) => deleteOpaqueRecord(key),
  };
}

function toRowInput(input: DeferRecordInput | DeferredRecord) {
  return {
    connectionId: input.connectionId,
    sourcePath: input.sourcePath,
    record: input.record,
    requiredBlobHashes: [...input.requiredBlobHashes],
    firstDeferredAt: input.firstDeferredAt,
    attempts: input.attempts,
  };
}

async function allocateSnapshotNStandalone(
  connectionId: ConnectionId,
  scope: Scope,
): Promise<number> {
  const db = await getSyncDB();
  const tx = db.transaction(SYNC_STORES.SEQUENCES, 'readwrite');
  const n = await allocateSnapshotN(connectionId, scope, tx);
  await awaitSyncTx(tx);
  return n;
}
