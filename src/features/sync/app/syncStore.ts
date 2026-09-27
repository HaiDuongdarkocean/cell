import type { ChangeRecord, ConnectionId, DataClass, Scope } from '../domain/types';

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

export interface SyncStore {
  freezeBatch(input: FreezeBatchInput): Promise<FrozenBatch>;
  pendingBatches(connectionId: ConnectionId): Promise<FrozenBatch[]>;
  deletePendingBatch(key: string): Promise<void>;
  allocateSnapshotN(connectionId: ConnectionId, scope: Scope): Promise<number>;
}

export const KV_DATA_CLASSES: ReadonlySet<DataClass> = new Set<DataClass>([
  'settings',
  'secondaryKey',
  'syncDirectory',
  'profileConfig',
]);
