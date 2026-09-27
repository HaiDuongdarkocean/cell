import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { DataClass, Hlc, RecordKey, Scope } from '../../../domain/types';
import { SYNC_CONFLICT_LOG_STORAGE_KEY } from './keys';

export const SYNC_CONFLICT_LOG_LIMIT = 500;

export interface ConflictLogEntry {
  readonly at: number;
  readonly scope: Scope;
  readonly dataClass: DataClass;
  readonly key: RecordKey;
  readonly localHlc: Hlc;
  readonly remoteHlc: Hlc;
  readonly winner: 'local' | 'remote';
}

export async function appendConflictLog(
  kv: KeyValueStore,
  entries: readonly ConflictLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const raw = await kv.get<unknown>('local', SYNC_CONFLICT_LOG_STORAGE_KEY);
  const existing = Array.isArray(raw) ? (raw as ConflictLogEntry[]) : [];
  await kv.set('local', SYNC_CONFLICT_LOG_STORAGE_KEY, [...existing, ...entries].slice(-SYNC_CONFLICT_LOG_LIMIT));
}
