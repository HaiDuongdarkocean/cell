import type { ChangeRecord, DataClass, Hlc, RecordKey, Scope } from '../domain/types';

export type { PendingKey } from '../domain/types';
import type { PendingKey } from '../domain/types';

export interface ConflictLogEntry {
  readonly at: number;
  readonly scope: Scope;
  readonly dataClass: DataClass;
  readonly key: RecordKey;
  readonly localHlc: Hlc;
  readonly remoteHlc: Hlc;
  readonly winner: 'local' | 'remote';
}

export interface ApplyResult {
  applied: ChangeRecord[];
  localWon: ChangeRecord[];
  opaque: ChangeRecord[];
  conflicts?: ConflictLogEntry[];
}

export interface ApplyContext {
  readonly fetchBlob?: (contentHash: string) => Promise<Blob | null>;
}

export interface LocalSource {
  readonly dataClass: DataClass;
  pending(limit: number): Promise<PendingKey[]>;
  resolve(keys: PendingKey[]): Promise<ChangeRecord[]>;
  ack(keys: PendingKey[]): Promise<void>;
  stampCommitted(records: readonly ChangeRecord[]): Promise<void>;
  snapshot(scope: Scope): AsyncIterable<ChangeRecord>;
  current(scope: Scope, keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>>;
  applyRemote(records: ChangeRecord[], ctx?: ApplyContext): Promise<ApplyResult>;
}
