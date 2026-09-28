import type {
  ChangeRecord,
  ConnectionId,
  DataClass,
  RecordKey,
  Scope,
} from '../domain/types';

export interface FrozenBatch {
  readonly key: string;
  readonly connectionId: ConnectionId;
  readonly scope: Scope;
  readonly seq: number;
  readonly records: ChangeRecord[];
  readonly cycleId: string;
  readonly createdAt: number;
}

export interface FreezeBatchInput {
  readonly connectionId: ConnectionId;
  readonly scope: Scope;
  readonly records: ChangeRecord[];
  readonly cycleId: string;
  readonly createdAt: number;
}

export interface DeferredRecord {
  readonly key: string;
  readonly connectionId: ConnectionId;
  readonly scope: Scope;
  readonly recordKey: RecordKey;
  readonly sourcePath?: string;
  readonly record: ChangeRecord;
  readonly requiredBlobHashes: string[];
  readonly firstDeferredAt: number;
  readonly attempts: number;
}

export interface DeferRecordInput {
  readonly connectionId: ConnectionId;
  readonly sourcePath?: string;
  readonly record: ChangeRecord;
  readonly requiredBlobHashes: readonly string[];
  readonly firstDeferredAt: number;
  readonly attempts: number;
}

export interface OpaqueRecord {
  readonly key: string;
  readonly scope: Scope;
  readonly recordKey: RecordKey;
  readonly record: ChangeRecord;
}

export interface SyncStore {
  freezeBatch(input: FreezeBatchInput): Promise<FrozenBatch>;
  nextSeqFor(connectionId: ConnectionId, scope: Scope): Promise<number>;
  pendingBatches(connectionId: ConnectionId): Promise<FrozenBatch[]>;
  deletePendingBatch(key: string): Promise<void>;
  allocateSnapshotN(connectionId: ConnectionId, scope: Scope): Promise<number>;
  deferRecord(input: DeferRecordInput): Promise<DeferredRecord>;
  listDeferred(connectionId: ConnectionId): Promise<DeferredRecord[]>;
  listAllDeferred(): Promise<DeferredRecord[]>;
  deferredByBlobHash(contentHash: string): Promise<DeferredRecord[]>;
  updateDeferred(row: DeferredRecord): Promise<DeferredRecord>;
  deleteDeferred(key: string): Promise<void>;
  putOpaque(record: ChangeRecord): Promise<void>;
  listOpaque(scope: Scope): Promise<OpaqueRecord[]>;
  deleteOpaque(key: string): Promise<void>;
}

export const KV_DATA_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  'settings',
  'secondaryKey',
  'syncDirectory',
  'profileConfig',
]);
