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
  listMetaKeysByPrefix,
  configureSyncRuntime,
  resetSyncRuntime,
  ensureSyncRuntime,
  getDeviceId,
  isCaptureEnabled,
} from './adapters/local/idb/capture';
export type { CaptureInput, StoredRecordMeta } from './adapters/local/idb/capture';
