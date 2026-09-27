export type {
  ProviderId,
  AccountKey,
  ConnectionId,
  Scope,
  ProfileId,
  RecordKey,
  DataClass,
  Hlc,
  ChangeOp,
  ChangeRecord,
  PendingKey,
  RecordMeta,
  Connection,
  Cursor,
} from './domain/types';
export { targetOf, profileIdForTarget, scopeForTarget, connectionId } from './domain/scope';
export { compareHlc, hlcEq, maxHlc, HybridClock } from './domain/hlc';
export { stableJson, stableHash } from './domain/stableHash';
export type { LocalSource, ApplyResult } from './ports/localSource';
export {
  SYNC_OUTBOX,
  SYNC_META,
  SYNC_CAPTURE_STORES,
  captureChange,
  captureAll,
  readRecordMeta,
  stampRemoteMeta,
  listMetaByKey,
  listMetaKeysByPrefix,
  configureSyncRuntime,
  resetSyncRuntime,
  ensureSyncRuntime,
  mintRecordHlc,
  getDeviceId,
  isCaptureEnabled,
} from './adapters/local/idb/capture';
export type { CaptureInput, StoredRecordMeta } from './adapters/local/idb/capture';
export {
  listPending,
  deleteOutboxEntries,
  getMeta,
  getMetaAt,
  getMetaEntries,
  listMetaEntries,
  listMetaEntriesIn,
  putMetaAt,
  tombstoneMetaAt,
  metaChangeRecord,
  idbRequest,
  awaitIdbTx,
  keyPrefixRange,
  getRowAt,
  allRowsAt,
  rowsByIndexAt,
} from './adapters/local/idb/outbox';
export type { OutboxRow, PendingDrain } from './adapters/local/idb/outbox';
export { IdbLocalSource } from './adapters/local/idb/idbLocalSource';
export type {
  LocalValue,
  SnapshotEntry,
  ApplyDisposition,
} from './adapters/local/idb/idbLocalSource';
export {
  getSyncDB,
  closeSyncDB,
  deleteSyncDB,
  awaitSyncTx,
  opaqueRecordKey,
  putOpaqueRecord,
  getOpaqueRecord,
  getAllOpaqueRecords,
  deleteOpaqueRecord,
  clearOpaqueRecords,
} from './adapters/local/syncDb';
export type { OpaqueRecordRow } from './adapters/local/syncDb';
