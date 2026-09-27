import type {
  ChangeRecord,
  Connection,
  ConnectionId,
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
import { backoffDelayMs, BackoffTracker } from './backoff';
import type { BlobReader } from './blobRefs';
import { acquireCycleLock, CycleLockLostError } from './cycleLock';
import type { CycleLock, CycleLockDeps } from './cycleLock';
import {
  ackPendingKeys,
  collectPendingKeys,
  DEFAULT_JOURNAL_COMPACTION_THRESHOLD,
  DEFAULT_PENDING_LIMIT,
  groupPendingByScope,
  runConnectionPush,
} from './pushCycle';
import { readRouting, routeForScope } from './routing';
import type { SyncStore } from './syncStore';

export type EngineState =
  | 'idle'
  | 'running'
  | 'backoff'
  | 'needs-reauth'
  | 'offline'
  | 'storage-full';

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
  readonly failed: ConnectionFailure[];
  readonly retryAt?: number;
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
  readonly stampKvMeta?: (records: readonly ChangeRecord[]) => Promise<void>;
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

  constructor(private readonly deps: SyncEngineDeps) {
    this.status = { state: 'idle', updatedAt: deps.clock.now() };
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
    if (this.inflight) return this.inflight;
    const run = this.executeCycle().finally(() => {
      this.inflight = null;
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
      return {
        acquired: false,
        lockLost: false,
        scopesPushed: [],
        ackedKeys: 0,
        compactedScopes: [],
        failed: [],
      };
    }
    this.setStatus('running');
    try {
      return await this.pushAll(lock, cycleId);
    } finally {
      await lock.release();
    }
  }

  private async pushAll(lock: CycleLock, cycleId: string): Promise<CycleResult> {
    const deps = this.deps;
    const failed: ConnectionFailure[] = [];
    const scopesPushed: Scope[] = [];
    const compactedScopes: Scope[] = [];
    let ackedKeys = 0;
    let lockLost = false;
    let cycleError: unknown;

    try {
      const routing = await readRouting(deps.kv);
      const pending = await collectPendingKeys(
        deps.sources,
        deps.pendingLimit ?? DEFAULT_PENDING_LIMIT,
      );
      const connected = new Map<ConnectionId, Connection>();
      for (const connection of await deps.connections()) {
        connected.set(connection.connectionId, connection);
      }

      const buckets = new Map<ConnectionId, Map<Scope, PendingKey[]>>();
      const scoped = [...groupPendingByScope(pending).entries()].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      for (const [scope, keys] of scoped) {
        if (routing.frozenScopes.has(scope)) continue;
        const target = routeForScope(routing, scope);
        if (target === null) continue;
        if (target.kind === 'local') {
          await lock.verify();
          await ackPendingKeys(deps.sources, keys);
          ackedKeys += keys.length;
          continue;
        }
        if (!connected.has(target.connectionId)) continue;
        const bucket = buckets.get(target.connectionId) ?? new Map<Scope, PendingKey[]>();
        bucket.set(scope, keys);
        buckets.set(target.connectionId, bucket);
      }

      const deviceId = await deps.deviceId();
      for (const connection of connected.values()) {
        try {
          const result = await runConnectionPush(
            {
              provider: deps.providerFor(connection.providerId),
              connection,
              kv: deps.kv,
              store: deps.store,
              sources: deps.sources,
              blobs: deps.blobs,
              deviceId,
              cycleId,
              clock: deps.clock,
              fence: () => lock.verify(),
              stampKvMeta: deps.stampKvMeta,
              pendingLimit: deps.pendingLimit,
              journalCompactionThreshold:
                deps.journalCompactionThreshold ?? DEFAULT_JOURNAL_COMPACTION_THRESHOLD,
            },
            buckets.get(connection.connectionId) ?? new Map(),
          );
          for (const outcome of result.outcomes) {
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
          this.backoff.recordSuccess(connection.connectionId);
        } catch (error) {
          if (error instanceof CycleLockLostError) throw error;
          const retryAt = this.backoff.recordFailure(
            connection.connectionId,
            deps.clock.now(),
          );
          failed.push({
            connectionId: connection.connectionId,
            state: engineStateForError(error),
            retryAt,
          });
        }
      }
    } catch (error) {
      if (error instanceof CycleLockLostError) {
        lockLost = true;
      } else {
        cycleError = error;
      }
    }

    if (cycleError !== undefined) {
      this.cycleFailures += 1;
      const retryAt = deps.clock.now() + backoffDelayMs(this.cycleFailures);
      this.setStatus('backoff', { retryAt, lastError: describeError(cycleError) });
      return {
        acquired: true,
        lockLost,
        scopesPushed,
        ackedKeys,
        compactedScopes,
        failed,
        retryAt,
      };
    }
    if (lockLost) {
      this.setStatus('idle', { lastError: 'cycle lock lost' });
      return {
        acquired: true,
        lockLost,
        scopesPushed,
        ackedKeys,
        compactedScopes,
        failed,
      };
    }
    if (failed.length > 0) {
      const retryAt = Math.min(...failed.map((f) => f.retryAt));
      this.setStatus(failed[0]!.state, {
        retryAt,
        lastError: `${failed.length} connection(s) failed`,
      });
      return {
        acquired: true,
        lockLost,
        scopesPushed,
        ackedKeys,
        compactedScopes,
        failed,
        retryAt,
      };
    }
    this.cycleFailures = 0;
    this.setStatus('idle');
    return {
      acquired: true,
      lockLost,
      scopesPushed,
      ackedKeys,
      compactedScopes,
      failed,
    };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
