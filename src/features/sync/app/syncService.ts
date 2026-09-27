import type {
  Connection,
  ConnectionId,
  Hlc,
  Scope,
} from '../domain/types';
import { scopeForTarget } from '../domain/scope';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import type { SrsSyncAccess } from '../ports/srsSyncAccess';
import type { ProviderId } from '../domain/types';
import { ProviderError, type StorageProvider } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import { clearDisconnectMarker, runConnectionDisconnect, type DisconnectDeps, type DisconnectResult } from './disconnect';
import { runScopeRebind, writeRoutingValue, type RebindDeps, type RebindResult } from './rebind';
import {
  runScopeReconciliation,
  type ReconcileDeps,
  type ReconcileResult,
} from './reconciliation';
import {
  readRouting,
  routeForScope,
  SYNC_DIRECTORY_STORAGE_KEY,
  type RoutingSnapshot,
} from './routing';
import { scopesPrefix } from './remotePaths';
import type { SyncStore } from './syncStore';
import type { ConnectionPullDeps } from './pullCycle';
import { SYNC_APPLIED_AT_KEY } from './pullCycle';
import { listPendingDisconnects } from './disconnect';

export interface SyncServiceDeps {
  readonly providerFor: (providerId: ProviderId) => StorageProvider;
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: () => readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly srs: SrsSyncAccess;
  readonly profileTargets: () => Promise<readonly string[]>;
  readonly deviceId: () => Promise<string>;
  readonly cycleId: () => string;
  readonly clock: Clock;
  readonly tick: () => Hlc;
  readonly fence: () => Promise<void>;
  readonly pendingLimit?: number;
  readonly observeHlc?: ConnectionPullDeps['observeHlc'];
  readonly onRoutingChange?: ConnectionPullDeps['onRoutingChange'];
  readonly onDisconnect?: (connectionId: ConnectionId) => Promise<void>;
}

export class SyncServiceError extends Error {
  constructor(
    readonly code:
      | 'unknown-provider'
      | 'unknown-connection'
      | 'auth-cancelled'
      | 'system-connection-required'
      | 'invalid-destination'
      | 'sync-busy',
    message: string,
  ) {
    super(message);
    this.name = 'SyncServiceError';
  }
}

export interface ConnectResult {
  readonly connection: Connection;
  readonly reconciled: ReconcileResult[];
  readonly isFirstConnection: boolean;
}

export interface ConnectionStatusEntry {
  readonly connectionId: ConnectionId;
  readonly providerId: ProviderId;
  readonly displayName: string;
  readonly isSystem: boolean;
  readonly disconnectPending: boolean;
}

export interface BindingStatusEntry {
  readonly target: string;
  readonly scope: Scope;
  readonly destination: ConnectionId | 'local';
  readonly frozen: boolean;
  readonly waiting: boolean;
}

export interface SyncStatusSnapshot {
  readonly connections: ConnectionStatusEntry[];
  readonly bindings: BindingStatusEntry[];
  readonly systemConnection: ConnectionId | null;
  readonly lastAppliedAt: number | null;
}

export interface SyncStatusView {
  readonly engine: {
    readonly state:
      | 'idle'
      | 'running'
      | 'backoff'
      | 'needs-reauth'
      | 'offline'
      | 'storage-full';
    readonly retryAt?: number;
    readonly lastError?: string;
    readonly updatedAt: number;
  };
  readonly directory: SyncStatusSnapshot;
}

function rebindDeps(
  deps: SyncServiceDeps,
  deviceId: string,
  cycleId: string,
  routing: RoutingSnapshot,
): RebindDeps {
  const byId = new Map(routing.connections.map((c) => [c.connectionId, c] as const));
  return {
    providerFor: deps.providerFor,
    connectionFor: (id) => byId.get(id) ?? null,
    kv: deps.kv,
    store: deps.store,
    sources: deps.sources(),
    blobs: deps.blobs,
    deviceId,
    cycleId,
    clock: deps.clock,
    tick: deps.tick,
    fence: deps.fence,
    pendingLimit: deps.pendingLimit,
    observeHlc: deps.observeHlc,
    onRoutingChange: deps.onRoutingChange,
  };
}

function disconnectDeps(
  deps: SyncServiceDeps,
  deviceId: string,
  cycleId: string,
): DisconnectDeps {
  return {
    providerFor: deps.providerFor,
    connections: async () => (await readRouting(deps.kv)).connections,
    kv: deps.kv,
    store: deps.store,
    sources: deps.sources(),
    blobs: deps.blobs,
    deviceId,
    cycleId,
    clock: deps.clock,
    tick: deps.tick,
    fence: deps.fence,
    pendingLimit: deps.pendingLimit,
    onDisconnect: deps.onDisconnect,
  };
}

function reconcileDeps(
  deps: SyncServiceDeps,
  connection: Connection,
  deviceId: string,
): ReconcileDeps {
  return {
    provider: deps.providerFor(connection.providerId),
    connection,
    kv: deps.kv,
    store: deps.store,
    sources: deps.sources(),
    blobs: deps.blobs,
    srs: deps.srs,
    deviceId,
    clock: deps.clock,
    fence: deps.fence,
    observeHlc: deps.observeHlc,
    onRoutingChange: deps.onRoutingChange,
    onDisconnect: deps.onDisconnect,
  };
}

async function writeDirectoryEntry(
  deps: SyncServiceDeps,
  patch: Record<string, unknown>,
): Promise<void> {
  const state =
    (await deps.kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY)) ?? {};
  await deps.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, { ...state, ...patch });
}

export async function connectProvider(
  deps: SyncServiceDeps,
  providerId: ProviderId,
): Promise<ConnectResult> {
  const provider = deps.providerFor(providerId);
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `${providerId}:${account.accountKey}` as ConnectionId,
    providerId,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const deviceId = await deps.deviceId();
  const routing = await readRouting(deps.kv);
  const known = routing.connections.some(
    (c) => c.connectionId === connection.connectionId,
  );
  const isFirstConnection = routing.connections.length === 0;

  const patch: Record<string, unknown> = {
    deviceId,
    [`connection:${connection.connectionId}`]: {
      providerId,
      accountKey: account.accountKey,
      displayName: account.displayName,
    },
  };
  if (isFirstConnection) {
    patch['systemConnection'] = connection.connectionId;
    for (const target of await deps.profileTargets()) {
      patch[`binding:${target}`] = connection.connectionId;
    }
  }
  await writeDirectoryEntry(deps, patch);

  try {
    await clearDisconnectMarker({ provider, connection, fence: deps.fence });
  } catch {
    // marker absence is fine; re-reading it every cycle is the guard
  }

  const reconciled: ReconcileResult[] = [];
  const scopes = new Set<Scope>(['global']);
  if (isFirstConnection) {
    for (const target of await deps.profileTargets()) scopes.add(scopeForTarget(target));
  } else {
    const fresh = await readRouting(deps.kv);
    for (const [target, destination] of fresh.bindings) {
      if (destination === connection.connectionId) scopes.add(`profile:${target}` as Scope);
    }
  }
  for (const scope of [...scopes].sort()) {
    reconciled.push(await runScopeReconciliation(reconcileDeps(deps, connection, deviceId), scope));
  }
  return { connection, reconciled, isFirstConnection: isFirstConnection && !known };
}

export async function disconnectAccount(
  deps: SyncServiceDeps,
  connectionId: ConnectionId,
): Promise<DisconnectResult> {
  const routing = await readRouting(deps.kv);
  const connection = routing.connections.find((c) => c.connectionId === connectionId);
  if (connection === undefined) {
    throw new SyncServiceError('unknown-connection', `no such connection: ${connectionId}`);
  }
  return runConnectionDisconnect(
    disconnectDeps(deps, await deps.deviceId(), deps.cycleId()),
    connection,
  );
}

export async function rebindScope(
  deps: SyncServiceDeps,
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<RebindResult> {
  const routing = await readRouting(deps.kv);
  return runScopeRebind(
    rebindDeps(deps, await deps.deviceId(), deps.cycleId(), routing),
    scope,
    destination,
  );
}

export async function setSystemConnection(
  deps: SyncServiceDeps,
  connectionId: ConnectionId,
): Promise<RebindResult | ReconcileResult | null> {
  const routing = await readRouting(deps.kv);
  if (!routing.connections.some((c) => c.connectionId === connectionId)) {
    throw new SyncServiceError('unknown-connection', `no such connection: ${connectionId}`);
  }
  return setScopeBinding(deps, 'global', connectionId);
}

export async function setScopeBinding(
  deps: SyncServiceDeps,
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<RebindResult | ReconcileResult | null> {
  if (scope === 'global' && destination === 'local') {
    throw new SyncServiceError(
      'invalid-destination',
      'the global scope must stay bound to a connection',
    );
  }
  const routing = await readRouting(deps.kv);
  const target = routeForScope(routing, scope);
  const current =
    target === null ? null : target.kind === 'local' ? 'local' : target.connectionId;
  if (current === destination) return null;
  const hasSyncedCopy = await scopeHasRemoteData(deps, routing, scope);
  if (!hasSyncedCopy) {
    await writeRoutingValue(deps, scope, destination);
    if (destination === 'local') return null;
    const routingFresh = await readRouting(deps.kv);
    const connection = routingFresh.connections.find(
      (c) => c.connectionId === destination,
    );
    if (connection === undefined) {
      throw new SyncServiceError('unknown-connection', `no such connection: ${destination}`);
    }
    return runScopeReconciliation(
      reconcileDeps(deps, connection, await deps.deviceId()),
      scope,
    );
  }
  return runScopeRebind(
    rebindDeps(deps, await deps.deviceId(), deps.cycleId(), routing),
    scope,
    destination,
  );
}

async function scopeHasRemoteData(
  deps: SyncServiceDeps,
  routing: RoutingSnapshot,
  scope: Scope,
): Promise<boolean> {
  const target = routeForScope(routing, scope);
  if (target === null || target.kind !== 'connection') return false;
  const connection = routing.connections.find(
    (c) => c.connectionId === target.connectionId,
  );
  if (connection === undefined) return false;
  const provider = deps.providerFor(connection.providerId);
  try {
    const entries = await provider.list(connection, `${scopesPrefix()}${scope}/`);
    return entries.length > 0;
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return false;
    return true;
  }
}

export async function syncStatusSnapshot(
  deps: SyncServiceDeps,
): Promise<SyncStatusSnapshot> {
  const routing = await readRouting(deps.kv);
  const pendingDisconnects = new Set(await listPendingDisconnects(deps.kv));
  const lastAppliedAt =
    (await deps.kv.get<number>('session', SYNC_APPLIED_AT_KEY)) ?? null;
  const bindings: BindingStatusEntry[] = [...routing.bindings.entries()].map(
    ([target, destination]) => ({
      target,
      scope: `profile:${target}` as Scope,
      destination,
      frozen: routing.frozenScopes.has(`profile:${target}` as Scope),
      waiting:
        destination !== 'local' &&
        !routing.connections.some((c) => c.connectionId === destination),
    }),
  );
  return {
    connections: routing.connections.map((c) => ({
      connectionId: c.connectionId,
      providerId: c.providerId,
      displayName: c.displayName,
      isSystem: routing.systemConnection === c.connectionId,
      disconnectPending: pendingDisconnects.has(c.connectionId),
    })),
    bindings,
    systemConnection: routing.systemConnection,
    lastAppliedAt,
  };
}
