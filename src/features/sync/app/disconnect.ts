import { logger } from '@/shared/lib/logger';
import type { Connection, ConnectionId, Hlc, Scope } from '../domain/types';
import { isPlainJsonObject } from '../domain/flatten';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import type { ProviderId } from '../domain/types';
import { ProviderError, type StorageProvider } from '../ports/storageProvider';
import { blobToBytes } from '../adapters/contract/blobBytes';
import { CycleLockLostError } from './cycleLock';
import type { BlobReader } from './blobRefs';
import { DISCONNECT_MARKER_PATH } from './remotePaths';
import {
  collectPendingKeys,
  DEFAULT_PENDING_LIMIT,
  groupPendingByScope,
  runConnectionPush,
  type ConnectionPushDeps,
} from './pushCycle';
import { readRouting, routeForScope, SYNC_DIRECTORY_STORAGE_KEY } from './routing';
import { collectScopeSnapshot, publishScopeSnapshot } from './snapshotPublish';
import { clearCheckpoint, listCheckpoints } from './checkpoints';
import { stampKvMetaHlc } from '../adapters/local/kv/kvMeta';
import type { SyncStore } from './syncStore';

export const DISCONNECT_PENDING_PREFIX = 'syncDisconnectPending:';

export interface DisconnectDeps {
  readonly providerFor: (providerId: ProviderId) => StorageProvider;
  readonly connections: () => Promise<readonly Connection[]>;
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
  readonly onDisconnect?: (connectionId: ConnectionId) => Promise<void>;
}

export type DisconnectStatus = 'disconnected' | 'pending';

export interface DisconnectResult {
  readonly connectionId: ConnectionId;
  readonly status: DisconnectStatus;
}

export class SystemConnectionRequiredError extends Error {
  constructor(connectionId: ConnectionId) {
    super(
      `connection ${connectionId} is the system connection — pick a new system connection first`,
    );
    this.name = 'SystemConnectionRequiredError';
  }
}

export function encodeDisconnectMarker(hlc: Hlc, deviceId: string): Blob {
  return new Blob([
    JSON.stringify({ formatVersion: 1, kind: 'disconnect', hlc, deviceId }),
  ]);
}

export async function decodeDisconnectMarker(
  blob: Blob,
): Promise<{ hlc: Hlc; deviceId: string } | null> {
  try {
    const bytes = await blobToBytes(blob);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isPlainJsonObject(parsed)) return null;
    if (parsed['kind'] !== 'disconnect') return null;
    const hlc = parsed['hlc'];
    const deviceId = parsed['deviceId'];
    if (!isPlainJsonObject(hlc) || typeof deviceId !== 'string') return null;
    if (
      typeof hlc['wall'] !== 'number' ||
      typeof hlc['counter'] !== 'number' ||
      typeof hlc['node'] !== 'string'
    ) {
      return null;
    }
    return { hlc: hlc as unknown as Hlc, deviceId };
  } catch {
    return null;
  }
}

function isUnreachable(e: unknown): boolean {
  return (
    e instanceof ProviderError &&
    (e.kind === 'auth' || e.kind === 'network' || e.kind === 'rate-limit')
  );
}

async function markPending(deps: DisconnectDeps, connectionId: ConnectionId): Promise<void> {
  await deps.kv.set('local', `${DISCONNECT_PENDING_PREFIX}${connectionId}`, {
    at: deps.clock.now(),
  });
}

export async function clearDisconnectPending(
  kv: KeyValueStore,
  connectionId: ConnectionId,
): Promise<void> {
  await kv.del('local', `${DISCONNECT_PENDING_PREFIX}${connectionId}`);
}

export async function listPendingDisconnects(kv: KeyValueStore): Promise<ConnectionId[]> {
  const keys = await kv.list('local', DISCONNECT_PENDING_PREFIX);
  return keys.map((key) => key.slice(DISCONNECT_PENDING_PREFIX.length) as ConnectionId);
}

export async function runConnectionDisconnect(
  deps: DisconnectDeps,
  connection: Connection,
): Promise<DisconnectResult> {
  const connId = connection.connectionId;
  const routing = await readRouting(deps.kv);
  if (
    routing.systemConnection === connId &&
    routing.connections.length > 1
  ) {
    throw new SystemConnectionRequiredError(connId);
  }

  try {
    await finalFlush(deps, connection, routing);
    const provider = deps.providerFor(connection.providerId);
    await deps.fence();
    await provider.write(
      connection,
      DISCONNECT_MARKER_PATH,
      encodeDisconnectMarker(deps.tick(), deps.deviceId),
    );
  } catch (e) {
    if (isUnreachable(e)) {
      await markPending(deps, connId);
      return { connectionId: connId, status: 'pending' };
    }
    throw e;
  }

  await completeDisconnectLocally(deps, connId);
  return { connectionId: connId, status: 'disconnected' };
}

export async function completeDisconnectLocally(
  deps: DisconnectDeps,
  connId: ConnectionId,
): Promise<void> {
  const routing = await readRouting(deps.kv);
  const connection = routing.connections.find((c) => c.connectionId === connId);
  if (connection !== undefined) {
    try {
      await deps.providerFor(connection.providerId).revoke(connection);
    } catch (e) {
      logger.warn('sync: provider revoke failed during disconnect', {
        connectionId: connId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  await writeDirectoryDisconnect(deps, connId, routing);
  await clearCheckpointsFor(deps, connId);
  await propagateGlobalScope(deps, connId);
  await deps.onDisconnect?.(connId);
  await clearDisconnectPending(deps.kv, connId);
}

async function finalFlush(
  deps: DisconnectDeps,
  connection: Connection,
  routing: Awaited<ReturnType<typeof readRouting>>,
): Promise<void> {
  const pending = await collectPendingKeys(
    deps.sources,
    deps.pendingLimit ?? DEFAULT_PENDING_LIMIT,
  );
  const buckets = new Map<Scope, typeof pending>();
  for (const [scope, keys] of groupPendingByScope(pending)) {
    const target = routeForScope(routing, scope);
    if (target?.kind === 'connection' && target.connectionId === connection.connectionId) {
      buckets.set(scope, keys);
    }
  }
  if (buckets.size === 0) return;
  const result = await runConnectionPush(pushDepsFor(deps, connection), buckets);
  const failed = result.outcomes.filter((o) => o.error !== undefined);
  if (failed.length > 0) {
    throw new ProviderError('network', `disconnect flush failed: ${failed[0]!.error}`);
  }
}

function pushDepsFor(deps: DisconnectDeps, connection: Connection): ConnectionPushDeps {
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

async function writeDirectoryDisconnect(
  deps: DisconnectDeps,
  connId: ConnectionId,
  routing: Awaited<ReturnType<typeof readRouting>>,
): Promise<void> {
  const state =
    (await deps.kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY)) ?? {};
  const next: Record<string, unknown> = { ...state };
  delete next[`connection:${connId}`];
  for (const [target, bound] of routing.bindings) {
    if (bound === connId) next[`binding:${target}`] = 'local';
  }
  if (routing.systemConnection === connId) {
    const remaining = routing.connections.filter((c) => c.connectionId !== connId);
    const nextSystem = remaining[0]?.connectionId;
    if (nextSystem === undefined) delete next['systemConnection'];
    else next['systemConnection'] = nextSystem;
  }
  const stampKeys = [
    `connection:${connId}`,
    ...[...routing.bindings.entries()]
      .filter(([, bound]) => bound === connId)
      .map(([target]) => `binding:${target}`),
    ...(routing.systemConnection === connId ? ['systemConnection'] : []),
  ];
  await deps.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, next);
  const hlc = deps.tick();
  for (const key of stampKeys) {
    await stampKvMetaHlc(deps.kv, 'global', key, hlc);
  }
}

async function clearCheckpointsFor(
  deps: DisconnectDeps,
  connId: ConnectionId,
): Promise<void> {
  for (const cp of await listCheckpoints(deps.kv)) {
    if (cp.to === connId || cp.from === connId) {
      await clearCheckpoint(deps.kv, cp.scope);
    }
  }
}

async function propagateGlobalScope(
  deps: DisconnectDeps,
  connId: ConnectionId,
): Promise<void> {
  const routing = await readRouting(deps.kv);
  const target = routeForScope(routing, 'global');
  if (target?.kind !== 'connection' || target.connectionId === connId) return;
  const connection = (await deps.connections()).find(
    (c) => c.connectionId === target.connectionId,
  );
  if (connection === undefined) return;
  const records = await collectScopeSnapshot(deps, 'global');
  if (records.length === 0) return;
  try {
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
      'global',
      records,
    );
    for (const source of deps.sources) {
      const mine = records.filter((record) => record.dataClass === source.dataClass);
      await source.stampCommitted(mine);
    }
  } catch {
    // the next cycle re-publishes the global scope; the directory remains authoritative
  }
}

export async function clearDisconnectMarker(
  deps: { provider: StorageProvider; connection: Connection; fence: () => Promise<void> },
): Promise<void> {
  try {
    await deps.fence();
    await deps.provider.remove(deps.connection, DISCONNECT_MARKER_PATH);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return;
    throw e;
  }
}

export async function completePendingDisconnects(deps: DisconnectDeps): Promise<ConnectionId[]> {
  const done: ConnectionId[] = [];
  const connected = new Map(
    (await deps.connections()).map((c) => [c.connectionId, c] as const),
  );
  for (const connId of await listPendingDisconnects(deps.kv)) {
    const connection = connected.get(connId);
    if (connection === undefined) {
      try {
        await completeDisconnectLocally(deps, connId);
        done.push(connId);
      } catch (e) {
        if (e instanceof CycleLockLostError) throw e;
      }
      continue;
    }
    try {
      const result = await runConnectionDisconnect(deps, connection);
      if (result.status === 'disconnected') done.push(connId);
    } catch (e) {
      if (e instanceof CycleLockLostError) throw e;
    }
  }
  return done;
}
