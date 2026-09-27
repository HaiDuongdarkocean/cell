import type { ConnectionId, Cursor, Scope } from '../domain/types';
import { isPlainJsonObject } from '../domain/flatten';
import type { KeyValueStore } from '../ports/keyValueStore';

export const SYNC_CURSORS_STORAGE_KEY = 'syncCursors';

export type CursorMap = Record<string, Cursor>;

export function cursorKey(connectionId: ConnectionId, scope: Scope, deviceId: string): string {
  return `${connectionId}|${scope}|${deviceId}`;
}

function isCursor(value: unknown): value is Cursor {
  if (!isPlainJsonObject(value)) return false;
  const { snapshotN, seq } = value;
  return (
    typeof snapshotN === 'number' &&
    Number.isInteger(snapshotN) &&
    snapshotN >= 0 &&
    typeof seq === 'number' &&
    Number.isInteger(seq) &&
    seq >= 0
  );
}

export async function readCursors(kv: KeyValueStore): Promise<CursorMap> {
  const raw = await kv.get<unknown>('local', SYNC_CURSORS_STORAGE_KEY);
  if (!isPlainJsonObject(raw)) return {};
  const out: CursorMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isCursor(value)) out[key] = value;
  }
  return out;
}

export async function writeCursor(
  kv: KeyValueStore,
  connectionId: ConnectionId,
  scope: Scope,
  deviceId: string,
  cursor: Cursor,
): Promise<void> {
  const cursors = await readCursors(kv);
  cursors[cursorKey(connectionId, scope, deviceId)] = cursor;
  await kv.set('local', SYNC_CURSORS_STORAGE_KEY, cursors);
}
