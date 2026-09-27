import type { ConnectionId, Scope } from '../domain/types';
import {
  allocateSnapshotN,
  awaitSyncTx,
  freezeBatch,
  getSyncDB,
  removePendingBatch,
  SYNC_STORES,
  takePendingBatches,
} from '../adapters/local/syncDb';
import type { SyncStore } from './syncStore';

export function createSyncDbStore(): SyncStore {
  return {
    freezeBatch: (input) => freezeBatch(input),
    pendingBatches: (connectionId) => takePendingBatches(connectionId),
    deletePendingBatch: (key) => removePendingBatch(key),
    allocateSnapshotN: (connectionId, scope) => allocateSnapshotNStandalone(connectionId, scope),
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
