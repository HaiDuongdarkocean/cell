import type { Connection, ConnectionId, Scope } from '../domain/types';
import type { KeyValueStore } from '../ports/keyValueStore';
import { ProviderError } from '../ports/storageProvider';
import { compareHlc } from '../domain/hlc';
import {
  clearCheckpoint,
  listCheckpoints,
  writeCheckpoint,
  type SyncCheckpoint,
} from './checkpoints';
import { RebindBlockedError, resumeScopeRebind, type RebindDeps } from './rebind';
import { scopesPrefix } from './remotePaths';
import { collectScopeSnapshot, publishScopeSnapshot } from './snapshotPublish';
import { readRouting, routeForScope } from './routing';
import type { RouteMarker } from './routeMarkers';

export interface ObligationDeps extends RebindDeps {
  readonly connections: () => Promise<readonly Connection[]>;
}

export interface ObligationResult {
  readonly completed: Scope[];
  readonly waiting: Scope[];
  readonly errors: string[];
}

export async function persistDrainObligation(
  kv: KeyValueStore,
  scope: Scope,
  marker: RouteMarker,
  currentTarget: ConnectionId | 'local' | null,
  now: number,
): Promise<boolean> {
  const existing = await getCheckpointSafe(kv, scope);
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

async function getCheckpointSafe(
  kv: KeyValueStore,
  scope: Scope,
): Promise<SyncCheckpoint | null> {
  const all = await listCheckpoints(kv);
  return all.find((cp) => cp.scope === scope) ?? null;
}

export async function processCheckpoints(
  deps: ObligationDeps,
): Promise<ObligationResult> {
  const completed: Scope[] = [];
  const waiting: Scope[] = [];
  const errors: string[] = [];
  const connected = new Map(
    (await deps.connections()).map((c) => [c.connectionId, c] as const),
  );
  for (const cp of await listCheckpoints(deps.kv)) {
    try {
      const outcome = await processOne(deps, cp, connected);
      if (outcome === 'done') completed.push(cp.scope);
      else if (outcome === 'waiting') waiting.push(cp.scope);
    } catch (e) {
      errors.push(`${cp.scope}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { completed, waiting, errors };
}

async function processOne(
  deps: ObligationDeps,
  cp: SyncCheckpoint,
  connected: ReadonlyMap<ConnectionId, Connection>,
): Promise<'done' | 'waiting' | 'kept'> {
  if (cp.kind === 'rebind') {
    try {
      const result = await resumeScopeRebind(deps, cp);
      return result.done ? 'done' : 'kept';
    } catch (e) {
      if (e instanceof RebindBlockedError) return 'waiting';
      throw e;
    }
  }
  if (cp.kind === 'drain') {
    return drainObligation(deps, cp, connected);
  }
  return sweepObligation(deps, cp, connected);
}

async function drainObligation(
  deps: ObligationDeps,
  cp: SyncCheckpoint,
  connected: ReadonlyMap<ConnectionId, Connection>,
): Promise<'done' | 'waiting'> {
  if (cp.to === 'local') {
    await clearCheckpoint(deps.kv, cp.scope);
    return 'done';
  }
  const connection = connected.get(cp.to);
  if (connection === undefined) return 'waiting';
  const records = await collectScopeSnapshot(deps, cp.scope);
  await publishScopeSnapshot(
    {
      provider: deps.providerFor(connection.providerId),
      connection,
      store: deps.store,
      sources: deps.sources,
      blobs: deps.blobs,
      deviceId: deps.deviceId,
      fence: deps.fence,
    },
    cp.scope,
    records,
  );
  for (const source of deps.sources) {
    const mine = records.filter((record) => record.dataClass === source.dataClass);
    await source.stampCommitted(mine);
  }
  await clearCheckpoint(deps.kv, cp.scope);
  return 'done';
}

async function sweepObligation(
  deps: ObligationDeps,
  cp: SyncCheckpoint,
  connected: ReadonlyMap<ConnectionId, Connection>,
): Promise<'done' | 'kept'> {
  if (cp.until !== null && deps.clock.now() > cp.until) {
    await clearCheckpoint(deps.kv, cp.scope);
    return 'done';
  }
  if (cp.from === null) {
    await clearCheckpoint(deps.kv, cp.scope);
    return 'done';
  }
  const connection = connected.get(cp.from);
  if (connection === undefined) return 'kept';
  const provider = deps.providerFor(connection.providerId);
  const entries = await provider.list(connection, `${scopesPrefix()}${cp.scope}/`);
  for (const entry of entries) {
    await deps.fence();
    try {
      await provider.remove(connection, entry.path);
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') continue;
      throw e;
    }
  }
  const remaining = await provider.list(connection, `${scopesPrefix()}${cp.scope}/`);
  if (remaining.length === 0) {
    await clearCheckpoint(deps.kv, cp.scope);
    return 'done';
  }
  return 'kept';
}

export async function observeRouteMarker(
  kv: KeyValueStore,
  scope: Scope,
  marker: RouteMarker,
  observedOn: ConnectionId,
  now: number,
): Promise<boolean> {
  const routing = await readRouting(kv);
  const target = routeForScope(routing, scope);
  const current =
    target === null ? null : target.kind === 'local' ? ('local' as const) : target.connectionId;
  if (current === marker.destination) return false;
  return persistDrainObligation(kv, scope, marker, current ?? observedOn, now);
}
