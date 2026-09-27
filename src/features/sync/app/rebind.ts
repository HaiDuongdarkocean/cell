import type {
  Connection,
  ConnectionId,
  Hlc,
  Scope,
} from '../domain/types';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import type { ProviderId } from '../domain/types';
import type { StorageProvider } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import {
  clearCheckpoint,
  getCheckpoint,
  writeCheckpoint,
  type SyncCheckpoint,
} from './checkpoints';
import {
  isConnectionDisconnected,
  runConnectionPull,
  type ConnectionPullDeps,
} from './pullCycle';
import {
  ackPendingKeys,
  collectPendingKeys,
  DEFAULT_PENDING_LIMIT,
  runConnectionPush,
  type ConnectionPushDeps,
} from './pushCycle';
import { writeRouteMarker } from './routeMarkers';
import { readRouting, routeForScope, SYNC_DIRECTORY_STORAGE_KEY } from './routing';
import { collectScopeSnapshot, publishScopeSnapshot } from './snapshotPublish';
import type { SyncStore } from './syncStore';
import { scopesPrefix } from './remotePaths';

export interface RebindDeps {
  readonly providerFor: (providerId: ProviderId) => StorageProvider;
  readonly connectionFor: (connectionId: ConnectionId) => Connection | null;
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly deviceId: string;
  readonly cycleId: string;
  readonly clock: Clock;
  readonly tick: () => Hlc;
  readonly fence: () => Promise<void>;
  readonly pendingLimit?: number;
  readonly observeHlc?: ConnectionPullDeps['observeHlc'];
  readonly onRoutingChange?: ConnectionPullDeps['onRoutingChange'];
}

export interface RebindResult {
  readonly scope: Scope;
  readonly done: boolean;
  readonly phase: SyncCheckpoint['phase'] | 'done';
  readonly waitingFor: ConnectionId | null;
}

export class RebindBlockedError extends Error {
  constructor(
    readonly waitingFor: ConnectionId,
    scope: Scope,
  ) {
    super(`rebind of ${scope} waits for connection ${waitingFor}`);
    this.name = 'RebindBlockedError';
  }
}

function pullDepsFor(deps: RebindDeps, connection: Connection): ConnectionPullDeps {
  return {
    provider: deps.providerFor(connection.providerId),
    connection,
    kv: deps.kv,
    store: deps.store,
    sources: deps.sources,
    blobs: deps.blobs,
    deviceId: deps.deviceId,
    clock: deps.clock,
    fence: deps.fence,
    observeHlc: deps.observeHlc,
    onRoutingChange: deps.onRoutingChange,
  };
}

function pushDepsFor(deps: RebindDeps, connection: Connection): ConnectionPushDeps {
  return {
    provider: deps.providerFor(connection.providerId),
    connection,
    kv: deps.kv,
    store: deps.store,
    sources: deps.sources,
    blobs: deps.blobs,
    deviceId: deps.deviceId,
    cycleId: deps.cycleId,
    clock: deps.clock,
    fence: deps.fence,
    pendingLimit: deps.pendingLimit,
  };
}

export async function writeRoutingValue(
  deps: Pick<RebindDeps, 'kv'>,
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<void> {
  if (scope === 'global' && destination === 'local') {
    throw new Error('global scope cannot be routed to local');
  }
  const state = await deps.kv.get<Record<string, unknown>>(
    'local',
    SYNC_DIRECTORY_STORAGE_KEY,
  );
  const key =
    scope === 'global'
      ? 'systemConnection'
      : `binding:${scope.slice('profile:'.length)}`;
  const next = { ...(state ?? {}) };
  next[key] = destination;
  await deps.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, next);
}

export async function runScopeRebind(
  deps: RebindDeps,
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<RebindResult> {
  if (scope === 'global' && destination === 'local') {
    throw new Error('global scope cannot be rebound to local');
  }
  if (destination !== 'local' && deps.connectionFor(destination) === null) {
    throw new Error(`cannot rebind ${scope}: unknown connection ${destination}`);
  }
  let existing = await getCheckpoint(deps.kv, scope);
  if (existing !== null && existing.kind === 'sweep') {
    await clearCheckpoint(deps.kv, scope);
    existing = null;
  }
  if (existing !== null && (existing.kind !== 'rebind' || existing.to !== destination)) {
    throw new Error(
      `scope ${scope} has an incompatible ${existing.kind} obligation to ${existing.to}`,
    );
  }
  const checkpoint =
    existing ??
    (await (async () => {
      const routing = await readRouting(deps.kv);
      const target = routeForScope(routing, scope);
      const from = target !== null && target.kind === 'connection' ? target.connectionId : null;
      const fresh: SyncCheckpoint = {
        scope,
        kind: 'rebind',
        phase: 'freeze',
        from,
        to: destination,
        writtenPaths: [],
        markerHlc: null,
        startedAt: deps.clock.now(),
        until: null,
      };
      await writeCheckpoint(deps.kv, fresh);
      return fresh;
    })());
  return advanceRebind(deps, checkpoint);
}

export async function resumeScopeRebind(
  deps: RebindDeps,
  checkpoint: SyncCheckpoint,
): Promise<RebindResult> {
  return advanceRebind(deps, checkpoint);
}

export async function cancelScopeRebind(
  deps: Pick<RebindDeps, 'kv'>,
  scope: Scope,
): Promise<void> {
  const cp = await getCheckpoint(deps.kv, scope);
  if (cp !== null && cp.kind === 'rebind') await clearCheckpoint(deps.kv, scope);
}

async function advanceRebind(
  deps: RebindDeps,
  initial: SyncCheckpoint,
): Promise<RebindResult> {
  let cp = initial;
  while (true) {
    try {
      if (cp.phase === 'freeze') {
        await pullFromSource(deps, cp);
        cp = await copyToDestination(deps, cp);
        continue;
      }
      if (cp.phase === 'copied') {
        cp = await writeRoutingMarkers(deps, cp);
        continue;
      }
      if (cp.phase === 'routed') {
        await drainHeldKeys(deps, cp);
        await clearCheckpoint(deps.kv, cp.scope);
        return { scope: cp.scope, done: true, phase: 'done', waitingFor: null };
      }
      return { scope: cp.scope, done: false, phase: cp.phase, waitingFor: null };
    } catch (e) {
      if (e instanceof RebindBlockedError) {
        if (deps.connectionFor(e.waitingFor) === null) {
          await clearCheckpoint(deps.kv, cp.scope);
          return { scope: cp.scope, done: true, phase: 'done', waitingFor: null };
        }
        return {
          scope: cp.scope,
          done: false,
          phase: cp.phase,
          waitingFor: e.waitingFor,
        };
      }
      throw e;
    }
  }
}

async function pullFromSource(deps: RebindDeps, cp: SyncCheckpoint): Promise<void> {
  if (cp.from === null) return;
  const connection = deps.connectionFor(cp.from);
  if (connection === null) return;
  const pullDeps = pullDepsFor(deps, connection);
  const disconnected = await isConnectionDisconnected({
    provider: pullDeps.provider,
    connection,
    kv: deps.kv,
  });
  if (disconnected) return;
  await runConnectionPull(pullDeps, [cp.scope]);
}

async function copyToDestination(
  deps: RebindDeps,
  cp: SyncCheckpoint,
): Promise<SyncCheckpoint> {
  if (cp.to === 'local') {
    const next: SyncCheckpoint = { ...cp, phase: 'copied', writtenPaths: [] };
    await writeCheckpoint(deps.kv, next);
    return next;
  }
  const connection = deps.connectionFor(cp.to);
  if (connection === null) throw new RebindBlockedError(cp.to, cp.scope);
  const records = await collectScopeSnapshot(deps, cp.scope);
  const published = await publishScopeSnapshot(
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
  const next: SyncCheckpoint = {
    ...cp,
    phase: 'copied',
    writtenPaths: published.writtenPaths,
  };
  await writeCheckpoint(deps.kv, next);
  return next;
}

async function writeRoutingMarkers(
  deps: RebindDeps,
  cp: SyncCheckpoint,
): Promise<SyncCheckpoint> {
  const marker = { hlc: deps.tick(), destination: cp.to };
  if (cp.to !== 'local') {
    const connection = deps.connectionFor(cp.to);
    if (connection === null) throw new RebindBlockedError(cp.to, cp.scope);
    const landed = await writeRouteMarker(
      { provider: deps.providerFor(connection.providerId), connection, fence: deps.fence },
      cp.scope,
      marker,
    );
    if (!landed) throw new Error(`route marker for ${cp.scope} superseded on remote`);
  }
  if (cp.from !== null) {
    const connection = deps.connectionFor(cp.from);
    if (connection !== null) {
      await writeRouteMarker(
        { provider: deps.providerFor(connection.providerId), connection, fence: deps.fence },
        cp.scope,
        marker,
      );
    }
  }
  await writeRoutingValue(deps, cp.scope, cp.to);
  const next: SyncCheckpoint = { ...cp, phase: 'routed', markerHlc: marker.hlc };
  await writeCheckpoint(deps.kv, next);
  return next;
}

async function drainHeldKeys(deps: RebindDeps, cp: SyncCheckpoint): Promise<void> {
  const limit = deps.pendingLimit ?? DEFAULT_PENDING_LIMIT;
  const pending = (await collectPendingKeys(deps.sources, limit)).filter(
    (key) => key.scope === cp.scope,
  );
  if (cp.to === 'local') {
    if (pending.length > 0) await ackPendingKeys(deps.sources, pending);
    return;
  }
  const connection = deps.connectionFor(cp.to);
  if (connection === null) throw new RebindBlockedError(cp.to, cp.scope);
  if (pending.length > 0) {
    const buckets = new Map([[cp.scope, pending]]);
    const result = await runConnectionPush(pushDepsFor(deps, connection), buckets);
    const failed = result.outcomes.find((o) => o.scope === cp.scope && o.error !== undefined);
    if (failed !== undefined) throw new Error(failed.error);
  }
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
}

export async function deleteScopeCopyOnVacated(
  deps: Pick<RebindDeps, 'providerFor' | 'connectionFor' | 'kv' | 'clock' | 'fence'>,
  scope: Scope,
  connectionId: ConnectionId,
  sweepMs: number,
): Promise<void> {
  const connection = deps.connectionFor(connectionId);
  if (connection === null) return;
  const routing = await readRouting(deps.kv);
  const current = routeForScope(routing, scope);
  if (
    current !== null &&
    current.kind === 'connection' &&
    current.connectionId === connectionId
  ) {
    return;
  }
  const provider = deps.providerFor(connection.providerId);
  const entries = await provider.list(connection, `${scopesPrefix()}${scope}/`);
  for (const entry of entries) {
    await deps.fence();
    await provider.remove(connection, entry.path);
  }
  await writeCheckpoint(deps.kv, {
    scope,
    kind: 'sweep',
    phase: 'open',
    from: connectionId,
    to: 'local',
    writtenPaths: [],
    markerHlc: null,
    startedAt: deps.clock.now(),
    until: deps.clock.now() + sweepMs,
  });
}
