import type { ChangeRecord, DataClass, RecordKey, Scope } from '../domain/types';

export type { PendingKey } from '../domain/types';
import type { PendingKey } from '../domain/types';

export interface ApplyResult {
  applied: ChangeRecord[];
  localWon: ChangeRecord[];
  opaque: ChangeRecord[];
}

export interface LocalSource {
  readonly dataClass: DataClass;
  pending(limit: number): Promise<PendingKey[]>;
  resolve(keys: PendingKey[]): Promise<ChangeRecord[]>;
  ack(keys: PendingKey[]): Promise<void>;
  stampCommitted(records: readonly ChangeRecord[]): Promise<void>;
  snapshot(scope: Scope): AsyncIterable<ChangeRecord>;
  current(scope: Scope, keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>>;
  applyRemote(records: ChangeRecord[]): Promise<ApplyResult>;
}
