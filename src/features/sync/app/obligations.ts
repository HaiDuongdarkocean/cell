import type { Connection, ConnectionId, Scope } from '../domain/types';
import type { KeyValueStore } from '../ports/keyValueStore';
import { ProviderError } from '../ports/storageProvider';
import {
  clearCheckpoint,
  listCheckpoints,
  persistDrainObligation,
  type SyncCheckpoint,
} from './checkpoints';
import {
  resumeScopeRebind,
  writeRoutingValue,
  type RebindDeps,
} from './rebind';
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
  readonly waitingFor: Partial<Record<Scope, ConnectionId>>;
  readonly errors: string[];
}

export async function processCheckpoints(
  deps: ObligationDeps,
): Promise<ObligationResult> {
  const completed: Scope[] = [];
  const waiting: Scope[] = [];
  const waitingFor: Partial<Record<Scope, ConnectionId>> = {};
  const errors: string[] = [];
  const connected = new Map(
    (await deps.connections()).map((c) => [c.connectionId, c] as const),
  );
  for (const cp of await listCheckpoints(deps.kv)) {
    try {
      const outcome = await processOne(deps, cp, connected);
      if (outcome.state === 'done') completed.push(cp.scope);
      else if (outcome.state === 'waiting') {
        waiting.push(cp.scope);
        if (outcome.waitingFor !== null) waitingFor[cp.scope] = outcome.waitingFor;
      }
    } catch (e) {
      errors.push(`${cp.scope}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { completed, waiting, waitingFor, errors };
}

interface CheckpointOutcome {
  readonly state: 'done' | 'waiting' | 'kept';
  readonly waitingFor: ConnectionId | null;
}

const OUTCOME_DONE: CheckpointOutcome = { state: 'done', waitingFor: null };
const OUTCOME_KEPT: CheckpointOutcome = { state: 'kept', waitingFor: null };

function waitingOn(connectionId: ConnectionId | null): CheckpointOutcome {
  return { state: 'waiting', waitingFor: connectionId };
}

async function processOne(
  deps: ObligationDeps,
  cp: SyncCheckpoint,
  connected: ReadonlyMap<ConnectionId, Connection>,
): Promise<CheckpointOutcome> {
  if (cp.kind === 'rebind') {
    const result = await resumeScopeRebind(deps, cp);
    if (result.done) return OUTCOME_DONE;
    return result.waitingFor === null ? OUTCOME_KEPT : waitingOn(result.waitingFor);
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
): Promise<CheckpointOutcome> {
  if (cp.to === 'local') {
    await clearCheckpoint(deps.kv, cp.scope);
    return OUTCOME_DONE;
  }
  const connection = connected.get(cp.to);
  if (connection === undefined) return waitingOn(cp.to);
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
  await writeRoutingValue(deps, cp.scope, cp.to);
  await clearCheckpoint(deps.kv, cp.scope);
  return OUTCOME_DONE;
}

async function sweepObligation(
  deps: ObligationDeps,
  cp: SyncCheckpoint,
  connected: ReadonlyMap<ConnectionId, Connection>,
): Promise<CheckpointOutcome> {
  if (cp.until !== null && deps.clock.now() > cp.until) {
    await clearCheckpoint(deps.kv, cp.scope);
    return OUTCOME_DONE;
  }
  if (cp.from === null) {
    await clearCheckpoint(deps.kv, cp.scope);
    return OUTCOME_DONE;
  }
  const routing = await readRouting(deps.kv);
  const current = routeForScope(routing, cp.scope);
  if (current !== null && current.kind === 'connection' && current.connectionId === cp.from) {
    return OUTCOME_KEPT;
  }
  const connection = connected.get(cp.from);
  if (connection === undefined) return OUTCOME_KEPT;
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
    return OUTCOME_DONE;
  }
  return OUTCOME_KEPT;
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
