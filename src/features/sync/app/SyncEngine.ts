import type {
  ChangeRecord,
  Connection,
  ConnectionId,
  DataClass,
  Hlc,
  PendingKey,
  ProviderId,
  Scope,
} from '../domain/types';
import type { Clock } from '../ports/clock';
import type { IdSource } from '../ports/idSource';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import { ProviderError } from '../ports/storageProvider';
import type { StorageProvider } from '../ports/storageProvider';
import { backoffDelayMs, BackoffTracker, type EngineState } from './backoff';
import type { BlobReader } from './blobRefs';
import { acquireCycleLock, CycleLockLostError } from './cycleLock';
import type { CycleLock, CycleLockDeps } from './cycleLock';
import {
  ackPendingKeys,
  resolvePendingKeys,
  collectPendingKeys,
  DEFAULT_JOURNAL_COMPACTION_THRESHOLD,
  DEFAULT_PENDING_LIMIT,
  groupPendingByScope,
  runConnectionPush,
} from './pushCycle';
import {
  isConnectionDisconnected,
  runConnectionPull,
  SYNC_APPLIED_AT_KEY,
} from './pullCycle';
import {
  completeDisconnectLocally,
  completePendingDisconnects,
  type DisconnectDeps,
} from './disconnect';
import { observeRouteMarker, processCheckpoints } from './obligations';
import { scopesPrefix, scopeOfRemotePath } from './remotePaths';
import {
  runRemoteSweepIfDue,
  sweepDisconnectedFootprint,
} from './remoteSweep';
import { readRouteMarkers } from './routeMarkers';
import { readRouting, routeForScope } from './routing';
import type { RoutingSnapshot } from './routing';
import type { SyncStore } from './syncStore';

export type { EngineState } from './backoff';

export interface EngineStatus {
  readonly state: EngineState;
  readonly retryAt?: number;
  readonly lastError?: string;
  readonly updatedAt: number;
}

export interface ConnectionFailure {
  readonly connectionId: ConnectionId;
  readonly state: EngineState;
  readonly retryAt: number;
}

export interface CycleResult {
  readonly acquired: boolean;
  readonly lockLost: boolean;
  readonly scopesPushed: Scope[];
  readonly ackedKeys: number;
  readonly compactedScopes: Scope[];
  readonly scopesPulled: Scope[];
  readonly appliedDataClasses: DataClass[];
  readonly appliedScopes: Scope[];
  readonly waitingScopes: Scope[];
  readonly waitingFor: Partial<Record<Scope, ConnectionId>>;
  readonly obligationErrors: string[];
  readonly failed: ConnectionFailure[];
  readonly retryAt?: number;
}

export interface SyncAppliedPayload {
  readonly dataClasses: DataClass[];
  readonly scopes: Scope[];
}

export interface SyncEngineDeps {
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly providerFor: (providerId: ProviderId) => StorageProvider;
  readonly connections: () => Promise<Connection[]>;
  readonly deviceId: () => Promise<string>;
  readonly clock: Clock;
  readonly ids: IdSource;
  readonly tick?: () => Hlc;
  readonly observeHlc?: (hlc: Hlc) => void;
  readonly onRoutingChange?: (record: ChangeRecord) => Promise<void>;
  readonly onDisconnect?: (connectionId: ConnectionId) => Promise<void>;
  readonly onApplied?: (payload: SyncAppliedPayload) => void | Promise<void>;
  readonly pendingLimit?: number;
  readonly journalCompactionThreshold?: number;
  readonly lock?: Partial<Pick<CycleLockDeps, 'ttlMs' | 'heartbeatMs' | 'schedule'>>;
}

export function engineStateForError(error: unknown): EngineState {
  if (error instanceof ProviderError) {
    switch (error.kind) {
      case 'auth':
        return 'needs-reauth';
      case 'quota':
        return 'storage-full';
      case 'network':
        return 'offline';
      default:
        return 'backoff';
    }
  }
  return 'backoff';
}

export class SyncEngine {
  private status: EngineStatus;
  private readonly listeners = new Set<(status: EngineStatus) => void>();
  private readonly backoff = new BackoffTracker();
  private cycleFailures = 0;
  private inflight: Promise<CycleResult> | null = null;
  private rerunRequested = false;
  private rerunWaiters: Array<{
    resolve: (result: CycleResult) => void;
    reject: (error: unknown) => void;
  }> = [];

  constructor(private readonly deps: SyncEngineDeps) {
    this.status = { state: 'idle', updatedAt: deps.clock.now() };
  }

  connectionHealth(): ReadonlyMap<ConnectionId, { state: EngineState; retryAt: number }> {
    return this.backoff.snapshot();
  }

  get current(): EngineStatus {
    return this.status;
  }

  subscribe(listener: (status: EngineStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  runCycle(): Promise<CycleResult> {
    if (this.inflight) {
      this.rerunRequested = true;
      return new Promise<CycleResult>((resolve, reject) => {
        this.rerunWaiters.push({ resolve, reject });
      });
    }
    return this.startCycle();
  }

  private startCycle(): Promise<CycleResult> {
    const run = this.executeCycle().finally(() => {
      this.inflight = null;
      if (!this.rerunRequested) return;
      this.rerunRequested = false;
      const waiters = this.rerunWaiters.splice(0);
      this.startCycle().then(
        (result) => {
          for (const w of waiters) w.resolve(result);
        },
        (error) => {
          for (const w of waiters) w.reject(error);
        },
      );
    });
    this.inflight = run;
    return run;
  }

  private setStatus(state: EngineState, extra?: { retryAt?: number; lastError?: string }): void {
    const next: EngineStatus = { state, updatedAt: this.deps.clock.now() };
    if (extra?.retryAt !== undefined) {
      (next as { retryAt?: number }).retryAt = extra.retryAt;
    }
    if (extra?.lastError !== undefined) {
      (next as { lastError?: string }).lastError = extra.lastError;
    }
    this.status = next;
    for (const listener of this.listeners) listener(next);
  }

  private async executeCycle(): Promise<CycleResult> {
    const deps = this.deps;
    const cycleId = deps.ids.uuid();
    const lock = await acquireCycleLock(
      {
        kv: deps.kv,
        clock: deps.clock,
        ttlMs: deps.lock?.ttlMs,
        heartbeatMs: deps.lock?.heartbeatMs,
        schedule: deps.lock?.schedule,
      },
      cycleId,
    );
    if (lock === null) {
      return emptyCycleResult();
    }
    this.setStatus('running');
    try {
      return await this.runAll(lock, cycleId);
    } finally {
      await lock.release();
    }
  }

  private async runAll(lock: CycleLock, cycleId: string): Promise<CycleResult> {
    const deps = this.deps;
    const failed: ConnectionFailure[] = [];
    const scopesPushed: Scope[] = [];
    const compactedScopes: Scope[] = [];
    const scopesPulled = new Set<Scope>();
    const appliedDataClasses = new Set<DataClass>();
    const appliedScopes = new Set<Scope>();
    const waitingScopes = new Set<Scope>();
    const waitingFor: Partial<Record<Scope, ConnectionId>> = {};
    const obligationErrors: string[] = [];
    let ackedKeys = 0;
    let lockLost = false;
    let cycleError: unknown;

    try {
      const pending = await collectPendingKeys(
        deps.sources,
        deps.pendingLimit ?? DEFAULT_PENDING_LIMIT,
      );
      const connected = new Map<ConnectionId, Connection>();
      for (const connection of await deps.connections()) {
        connected.set(connection.connectionId, connection);
      }
      const deviceId = await deps.deviceId();

      const skipConnection = new Set<ConnectionId>();
      for (const connection of connected.values()) {
        const retryAt = this.backoff.retryAt(connection.connectionId);
        if (retryAt !== undefined && deps.clock.now() < retryAt) {
          failed.push({
            connectionId: connection.connectionId,
            state: this.backoff.stateOf(connection.connectionId) ?? 'backoff',
            retryAt,
          });
          skipConnection.add(connection.connectionId);
          continue;
        }
        const provider = deps.providerFor(connection.providerId);
        try {
          if (
            await isConnectionDisconnected({ provider, connection, kv: deps.kv })
          ) {
            try {
              await sweepDisconnectedFootprint({
                provider,
                connection,
                fence: () => lock.verify(),
              });
            } catch (sweepError) {
              if (sweepError instanceof CycleLockLostError) throw sweepError;
              obligationErrors.push(
                `disconnect sweep failed: ${describeError(sweepError)}`,
              );
            }
            try {
              await completeDisconnectLocally(
                this.disconnectDeps(() => lock.verify(), deviceId, cycleId),
                connection.connectionId,
              );
            } catch (error) {
              if (error instanceof CycleLockLostError) throw error;
              await deps.kv.set(
                'local',
                `syncDisconnectPending:${connection.connectionId}`,
                { at: deps.clock.now() },
              );
            }
            connected.delete(connection.connectionId);
            continue;
          }
          if (deps.tick !== undefined) {
            const markers = await readRouteMarkers(provider, connection);
            for (const [scope, marker] of markers) {
              await lock.verify();
              await observeRouteMarker(
                deps.kv,
                scope,
                marker,
                connection.connectionId,
                deps.clock.now(),
              );
            }
          }
        } catch (error) {
          if (error instanceof CycleLockLostError) throw error;
          const markerRetryAt = this.backoff.recordFailure(
            connection.connectionId,
            deps.clock.now(),
            engineStateForError(error),
          );
          failed.push({
            connectionId: connection.connectionId,
            state: engineStateForError(error),
            retryAt: markerRetryAt,
          });
          skipConnection.add(connection.connectionId);
        }
      }

      const routing = await readRouting(deps.kv);
      const buckets = new Map<ConnectionId, Map<Scope, PendingKey[]>>();
      const scoped = [...groupPendingByScope(pending).entries()].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      for (const [scope, keys] of scoped) {
        if (typeof scope !== 'string' || routing.frozenScopes.has(scope)) continue;
        const target = routeForScope(routing, scope);
        if (target === null) {
          waitingScopes.add(scope);
          continue;
        }
        if (target.kind === 'local') {
          await lock.verify();
          await resolvePendingKeys(deps.sources, keys);
          await ackPendingKeys(deps.sources, keys);
          ackedKeys += keys.length;
          continue;
        }
        if (
          !connected.has(target.connectionId) ||
          skipConnection.has(target.connectionId)
        ) {
          waitingScopes.add(scope);
          waitingFor[scope] = target.connectionId;
          continue;
        }
        const bucket = buckets.get(target.connectionId) ?? new Map<Scope, PendingKey[]>();
        bucket.set(scope, keys);
        buckets.set(target.connectionId, bucket);
      }

      for (const connection of connected.values()) {
        if (skipConnection.has(connection.connectionId)) continue;
        try {
          const provider = deps.providerFor(connection.providerId);
          const result = await runConnectionPush(
            {
              provider,
              connection,
              kv: deps.kv,
              store: deps.store,
              sources: deps.sources,
              blobs: deps.blobs,
              deviceId,
              cycleId,
              clock: deps.clock,
              fence: () => lock.verify(),
              pendingLimit: deps.pendingLimit,
              journalCompactionThreshold:
                deps.journalCompactionThreshold ?? DEFAULT_JOURNAL_COMPACTION_THRESHOLD,
            },
            buckets.get(connection.connectionId) ?? new Map(),
          );
          let scopeErrors = 0;
          for (const outcome of result.outcomes) {
            if (outcome.error !== undefined) scopeErrors += 1;
            if (outcome.journalSeq !== undefined && !scopesPushed.includes(outcome.scope)) {
              scopesPushed.push(outcome.scope);
            }
            if (
              outcome.snapshotN !== undefined &&
              !compactedScopes.includes(outcome.scope)
            ) {
              compactedScopes.push(outcome.scope);
            }
            ackedKeys += outcome.ackedKeys;
          }
          if (scopeErrors > 0) {
            const retryAt = this.backoff.recordFailure(
              connection.connectionId,
              deps.clock.now(),
            );
            failed.push({
              connectionId: connection.connectionId,
              state: 'backoff',
              retryAt,
            });
          } else {
            this.backoff.recordSuccess(connection.connectionId);
          }

          const pullScopes = await listPullScopes(provider, connection, routing);
          const pullResult = await runConnectionPull(
            {
              provider,
              connection,
              kv: deps.kv,
              store: deps.store,
              sources: deps.sources,
              blobs: deps.blobs,
              deviceId,
              clock: deps.clock,
              fence: () => lock.verify(),
              observeHlc: deps.observeHlc,
              onRoutingChange: deps.onRoutingChange,
              onRouteMarker:
                deps.tick === undefined
                  ? undefined
                  : async (scope, marker) => {
                      await observeRouteMarker(
                        deps.kv,
                        scope,
                        marker,
                        connection.connectionId,
                        deps.clock.now(),
                      );
                    },
              onDisconnect: deps.onDisconnect,
              onAppliedBatch: (scope, dataClasses) => {
                appliedScopes.add(scope);
                for (const dc of dataClasses) appliedDataClasses.add(dc);
              },
              allConnectionIds: async () =>
                (await deps.connections()).map((c) => c.connectionId),
            },
            pullScopes,
          );
          for (const outcome of pullResult.outcomes) {
            if (outcome.devices.length > 0) scopesPulled.add(outcome.scope);
          }
          for (const dc of pullResult.appliedDataClasses) appliedDataClasses.add(dc);
          for (const scope of pullResult.appliedScopes) appliedScopes.add(scope);

          try {
            await runRemoteSweepIfDue({
              provider,
              connection,
              kv: deps.kv,
              store: deps.store,
              deviceId,
              clock: deps.clock,
              fence: () => lock.verify(),
            });
          } catch (error) {
            if (error instanceof CycleLockLostError) throw error;
            obligationErrors.push(`remote sweep failed: ${describeError(error)}`);
          }
        } catch (error) {
          if (error instanceof CycleLockLostError) throw error;
          const retryAt = this.backoff.recordFailure(
            connection.connectionId,
            deps.clock.now(),
            engineStateForError(error),
          );
          failed.push({
            connectionId: connection.connectionId,
            state: engineStateForError(error),
            retryAt,
          });
        }
      }

      if (deps.tick !== undefined) {
        try {
          const obligations = await processCheckpoints({
            providerFor: deps.providerFor,
            connectionFor: (id) =>
              skipConnection.has(id) ? null : (connected.get(id) ?? null),
            connections: async () =>
              (await deps.connections()).filter(
                (c) => !skipConnection.has(c.connectionId),
              ),
            kv: deps.kv,
            store: deps.store,
            sources: deps.sources,
            blobs: deps.blobs,
            deviceId,
            cycleId,
            clock: deps.clock,
            tick: deps.tick,
            fence: () => lock.verify(),
            pendingLimit: deps.pendingLimit,
            observeHlc: deps.observeHlc,
            onRoutingChange: deps.onRoutingChange,
          });
          for (const scope of obligations.waiting) waitingScopes.add(scope);
          Object.assign(waitingFor, obligations.waitingFor);
          for (const message of obligations.errors) obligationErrors.push(message);
        } catch (error) {
          if (error instanceof CycleLockLostError) throw error;
          obligationErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        }
        try {
          const completed = await completePendingDisconnects(
            this.disconnectDeps(() => lock.verify(), deviceId, cycleId),
          );
          for (const connId of completed) connected.delete(connId);
        } catch (error) {
          if (error instanceof CycleLockLostError) throw error;
          obligationErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch (error) {
      if (error instanceof CycleLockLostError) {
        lockLost = true;
      } else {
        cycleError = error;
      }
    }

    const dataClasses = [...appliedDataClasses];
    const scopes = [...appliedScopes];
    if (dataClasses.length > 0 || scopes.length > 0) {
      await deps.kv.set('session', SYNC_APPLIED_AT_KEY, deps.clock.now());
      try {
        await deps.onApplied?.({ dataClasses, scopes });
      } catch (error) {
        cycleError = cycleError ?? error;
      }
    }
    const base = {
      acquired: true,
      lockLost,
      scopesPushed,
      ackedKeys,
      compactedScopes,
      scopesPulled: [...scopesPulled],
      appliedDataClasses: dataClasses,
      appliedScopes: scopes,
      waitingScopes: [...waitingScopes],
      waitingFor,
      obligationErrors,
      failed,
    };

    if (cycleError !== undefined) {
      this.cycleFailures += 1;
      const retryAt = deps.clock.now() + backoffDelayMs(this.cycleFailures);
      this.setStatus('backoff', { retryAt, lastError: describeError(cycleError) });
      return { ...base, retryAt };
    }
    if (lockLost) {
      this.setStatus('idle', { lastError: 'cycle lock lost' });
      return base;
    }
    if (failed.length > 0) {
      const retryAt = Math.min(...failed.map((f) => f.retryAt));
      this.setStatus(failed[0]!.state, {
        retryAt,
        lastError: `${failed.length} connection(s) failed`,
      });
      return { ...base, retryAt };
    }
    this.cycleFailures = 0;
    this.setStatus('idle');
    return base;
  }

  private disconnectDeps(
    fence: () => Promise<void>,
    deviceId: string,
    cycleId: string,
  ): DisconnectDeps {
    const deps = this.deps;
    const tick = deps.tick;
    return {
      providerFor: deps.providerFor,
      connections: deps.connections,
      kv: deps.kv,
      store: deps.store,
      sources: deps.sources,
      blobs: deps.blobs,
      deviceId,
      cycleId,
      clock: deps.clock,
      tick:
        tick ??
        (() => ({
          wall: deps.clock.now(),
          counter: 0,
          node: `${deviceId}:disconnect`,
        })),
      fence,
      pendingLimit: deps.pendingLimit,
      onDisconnect: deps.onDisconnect,
    };
  }
}

async function listPullScopes(
  provider: StorageProvider,
  connection: Connection,
  routing: RoutingSnapshot,
): Promise<Scope[]> {
  const entries = await provider.list(connection, scopesPrefix());
  const scopes = new Set<Scope>();
  for (const entry of entries) {
    const scope = scopeOfRemotePath(entry.path);
    if (scope !== null) scopes.add(scope);
  }
  const out: Scope[] = [];
  for (const scope of scopes) {
    if (routing.frozenScopes.has(scope)) continue;
    const target = routeForScope(routing, scope);
    if (target?.kind === 'connection' && target.connectionId === connection.connectionId) {
      out.push(scope);
    }
  }
  out.sort();
  return out;
}

function emptyCycleResult(): CycleResult {
  return {
    acquired: false,
    lockLost: false,
    scopesPushed: [],
    ackedKeys: 0,
    compactedScopes: [],
    scopesPulled: [],
    appliedDataClasses: [],
    appliedScopes: [],
    waitingScopes: [],
    waitingFor: {},
    obligationErrors: [],
    failed: [],
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
