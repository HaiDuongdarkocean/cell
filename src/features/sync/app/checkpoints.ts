import type { ConnectionId, Hlc, Scope } from '../domain/types';
import { isPlainJsonObject } from '../domain/flatten';
import { compareHlc } from '../domain/hlc';
import type { KeyValueStore } from '../ports/keyValueStore';
import { SYNC_CHECKPOINTS_STORAGE_KEY } from './routing';
import type { RouteMarker } from './routeMarkers';

export type CheckpointKind = 'rebind' | 'drain' | 'sweep';
export type RebindPhase = 'freeze' | 'copied' | 'routed';
export type CheckpointPhase = RebindPhase | 'open';
export type CheckpointDestination = ConnectionId | 'local';

export interface SyncCheckpoint {
  readonly scope: Scope;
  readonly kind: CheckpointKind;
  readonly phase: CheckpointPhase;
  readonly from: ConnectionId | null;
  readonly to: CheckpointDestination;
  readonly writtenPaths: readonly string[];
  readonly markerHlc: Hlc | null;
  readonly startedAt: number;
  readonly until: number | null;
}

export function isFrozenCheckpoint(cp: SyncCheckpoint): boolean {
  return cp.kind === 'rebind' && (cp.phase === 'freeze' || cp.phase === 'copied');
}

export async function persistDrainObligation(
  kv: KeyValueStore,
  scope: Scope,
  marker: RouteMarker,
  currentTarget: ConnectionId | 'local' | null,
  now: number,
): Promise<boolean> {
  const existing = await getCheckpoint(kv, scope);
  if (existing !== null && existing.kind !== 'drain') return false;
  if (
    existing !== null &&
    existing.markerHlc !== null &&
    compareHlc(marker.hlc, existing.markerHlc) <= 0
  ) {
    return false;
  }
  await writeCheckpoint(kv, {
    scope,
    kind: 'drain',
    phase: 'open',
    from: currentTarget === 'local' ? null : currentTarget,
    to: marker.destination,
    writtenPaths: [],
    markerHlc: marker.hlc,
    startedAt: now,
    until: null,
  });
  return true;
}

export async function listCheckpoints(kv: KeyValueStore): Promise<SyncCheckpoint[]> {
  const raw = await kv.get<unknown>('local', SYNC_CHECKPOINTS_STORAGE_KEY);
  if (!isPlainJsonObject(raw)) return [];
  const out: SyncCheckpoint[] = [];
  for (const [scope, value] of Object.entries(raw)) {
    const cp = parseCheckpoint(scope, value);
    if (cp !== null) out.push(cp);
  }
  return out;
}

export async function getCheckpoint(
  kv: KeyValueStore,
  scope: Scope,
): Promise<SyncCheckpoint | null> {
  const all = await listCheckpoints(kv);
  return all.find((cp) => cp.scope === scope) ?? null;
}

export async function writeCheckpoint(
  kv: KeyValueStore,
  checkpoint: SyncCheckpoint,
): Promise<void> {
  const raw = await kv.get<Record<string, unknown>>('local', SYNC_CHECKPOINTS_STORAGE_KEY);
  await kv.set('local', SYNC_CHECKPOINTS_STORAGE_KEY, {
    ...(isPlainJsonObject(raw) ? raw : {}),
    [checkpoint.scope]: serializeCheckpoint(checkpoint),
  });
}

export async function clearCheckpoint(kv: KeyValueStore, scope: Scope): Promise<void> {
  const raw = await kv.get<Record<string, unknown>>('local', SYNC_CHECKPOINTS_STORAGE_KEY);
  if (!isPlainJsonObject(raw) || !(scope in raw)) return;
  const next = { ...raw };
  delete next[scope];
  await kv.set('local', SYNC_CHECKPOINTS_STORAGE_KEY, next);
}

function serializeCheckpoint(cp: SyncCheckpoint): Record<string, unknown> {
  return {
    scope: cp.scope,
    kind: cp.kind,
    phase: cp.phase,
    from: cp.from,
    to: cp.to,
    writtenPaths: [...cp.writtenPaths],
    markerHlc: cp.markerHlc,
    startedAt: cp.startedAt,
    until: cp.until,
  };
}

function isScopeValue(value: unknown): value is Scope {
  return value === 'global' || (typeof value === 'string' && value.startsWith('profile:'));
}

function isHlcValue(value: unknown): value is Hlc {
  return (
    isPlainJsonObject(value) &&
    typeof value['wall'] === 'number' &&
    typeof value['counter'] === 'number' &&
    typeof value['node'] === 'string'
  );
}

function parseCheckpoint(scope: string, value: unknown): SyncCheckpoint | null {
  if (!isScopeValue(scope) || !isPlainJsonObject(value)) return null;
  const kind = value['kind'];
  if (kind !== 'rebind' && kind !== 'drain' && kind !== 'sweep') return null;
  const phase = value['phase'];
  if (phase !== 'freeze' && phase !== 'copied' && phase !== 'routed' && phase !== 'open') {
    return null;
  }
  const to = value['to'];
  if (to !== 'local' && typeof to !== 'string') return null;
  const from = value['from'];
  if (from !== null && from !== undefined && typeof from !== 'string') return null;
  const writtenPaths = Array.isArray(value['writtenPaths'])
    ? value['writtenPaths'].filter((p): p is string => typeof p === 'string')
    : [];
  const markerHlc = isHlcValue(value['markerHlc']) ? value['markerHlc'] : null;
  const startedAt = typeof value['startedAt'] === 'number' ? value['startedAt'] : 0;
  const until = typeof value['until'] === 'number' ? value['until'] : null;
  return {
    scope,
    kind,
    phase,
    from: (from ?? null) as ConnectionId | null,
    to: to as CheckpointDestination,
    writtenPaths,
    markerHlc,
    startedAt,
    until,
  };
}
