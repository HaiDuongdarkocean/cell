import type { KeyValueStore } from '../../../ports/keyValueStore';
import type { ConflictLogEntry } from '../../../ports/localSource';
import { SYNC_CONFLICT_LOG_STORAGE_KEY } from './keys';

export const SYNC_CONFLICT_LOG_LIMIT = 500;
export type { ConflictLogEntry } from '../../../ports/localSource';

export async function appendConflictLog(
  kv: KeyValueStore,
  entries: readonly ConflictLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const raw = await kv.get<unknown>('local', SYNC_CONFLICT_LOG_STORAGE_KEY);
  const existing = Array.isArray(raw) ? (raw as ConflictLogEntry[]) : [];
  await kv.set('local', SYNC_CONFLICT_LOG_STORAGE_KEY, [...existing, ...entries].slice(-SYNC_CONFLICT_LOG_LIMIT));
}
