/** runHistory — bounded persisted log of sync cycles for the settings UI.
 *  Ring buffer in kv 'local' so history survives service-worker restarts. */

import type { ConnectionId, DataClass, Scope } from '../domain/types';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { EngineState } from './backoff';

export const SYNC_RUN_HISTORY_KEY = 'syncRunHistory';
export const SYNC_RUN_HISTORY_CAP = 20;

export type SyncRunKind = 'full' | 'push' | 'check';

export interface SyncRunFailure {
  readonly connectionId: ConnectionId;
  readonly state: EngineState;
}

export interface SyncRunRecord {
  readonly id: string;
  readonly at: number;
  readonly kind: SyncRunKind;
  readonly ok: boolean;
  readonly pushed: readonly Scope[];
  readonly pulled: readonly Scope[];
  readonly appliedDataClasses: readonly DataClass[];
  readonly ackedKeys: number;
  readonly failed: readonly SyncRunFailure[];
  readonly errors: readonly string[];
}

export async function listRunHistory(
  kv: KeyValueStore,
): Promise<readonly SyncRunRecord[]> {
  const rows = await kv.get<readonly SyncRunRecord[]>('local', SYNC_RUN_HISTORY_KEY);
  return Array.isArray(rows) ? rows : [];
}

export async function appendRunRecord(
  kv: KeyValueStore,
  record: SyncRunRecord,
): Promise<void> {
  const rows = await listRunHistory(kv);
  await kv.set(
    'local',
    SYNC_RUN_HISTORY_KEY,
    [record, ...rows].slice(0, SYNC_RUN_HISTORY_CAP),
  );
}
