import type { Connection, ConnectionId, Scope } from '../domain/types';
import type { KeyValueStore } from '../ports/keyValueStore';
import { isPlainJsonObject } from '../domain/flatten';

export const SYNC_DIRECTORY_STORAGE_KEY = 'syncState';
export const SYNC_CHECKPOINTS_STORAGE_KEY = 'syncCheckpoints';

const CONNECTION_KEY_PREFIX = 'connection:';
const BINDING_KEY_PREFIX = 'binding:';
const LOCAL_DESTINATION = 'local';

export type RouteTarget =
  | { readonly kind: 'local' }
  | { readonly kind: 'connection'; readonly connectionId: ConnectionId };

export interface RoutingSnapshot {
  readonly connections: Connection[];
  readonly systemConnection: ConnectionId | null;
  readonly bindings: ReadonlyMap<string, ConnectionId | typeof LOCAL_DESTINATION>;
  readonly frozenScopes: ReadonlySet<Scope>;
}

export function routeForScope(
  routing: RoutingSnapshot,
  scope: Scope,
): RouteTarget | null {
  if (scope !== 'global') {
    const target = scope.slice('profile:'.length);
    const binding = routing.bindings.get(target);
    if (binding === LOCAL_DESTINATION) return { kind: 'local' };
    if (typeof binding === 'string') return { kind: 'connection', connectionId: binding };
  }
  if (routing.systemConnection !== null) {
    return { kind: 'connection', connectionId: routing.systemConnection };
  }
  return null;
}

export async function readRouting(kv: KeyValueStore): Promise<RoutingSnapshot> {
  const [state, checkpoints] = await Promise.all([
    kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY),
    kv.get<unknown>('local', SYNC_CHECKPOINTS_STORAGE_KEY),
  ]);
  const connections: Connection[] = [];
  const bindings = new Map<string, ConnectionId | typeof LOCAL_DESTINATION>();
  let systemConnection: ConnectionId | null = null;
  if (isPlainJsonObject(state)) {
    for (const [key, value] of Object.entries(state)) {
      if (key.startsWith(CONNECTION_KEY_PREFIX)) {
        const connection = parseConnection(key.slice(CONNECTION_KEY_PREFIX.length), value);
        if (connection) connections.push(connection);
      } else if (key.startsWith(BINDING_KEY_PREFIX)) {
        const target = key.slice(BINDING_KEY_PREFIX.length);
        if (value === LOCAL_DESTINATION) bindings.set(target, LOCAL_DESTINATION);
        else if (typeof value === 'string' && value !== '') {
          bindings.set(target, value as ConnectionId);
        }
      } else if (key === 'systemConnection') {
        if (typeof value === 'string' && value !== '') {
          systemConnection = value as ConnectionId;
        }
      }
    }
  }
  connections.sort((a, b) =>
    a.connectionId < b.connectionId ? -1 : a.connectionId > b.connectionId ? 1 : 0,
  );
  return {
    connections,
    systemConnection,
    bindings,
    frozenScopes: parseFrozenScopes(checkpoints),
  };
}

function parseConnection(id: string, value: unknown): Connection | null {
  if (!isPlainJsonObject(value)) return null;
  const { providerId, accountKey, displayName } = value;
  if (typeof providerId !== 'string' || typeof accountKey !== 'string') return null;
  return {
    connectionId: `${providerId}:${accountKey}` as ConnectionId,
    providerId,
    accountKey,
    displayName: typeof displayName === 'string' ? displayName : id,
  };
}

function parseFrozenScopes(raw: unknown): Set<Scope> {
  const out = new Set<Scope>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (isPlainJsonObject(entry) && isScope(entry['scope'])) out.add(entry['scope']);
    }
    return out;
  }
  if (isPlainJsonObject(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (!isScope(key)) continue;
      if (!isPlainJsonObject(value)) {
        out.add(key);
        continue;
      }
      const kind = value['kind'];
      const phase = value['phase'];
      if (kind === undefined || phase === undefined) {
        out.add(key);
        continue;
      }
      if (kind === 'rebind' && (phase === 'freeze' || phase === 'copied')) {
        out.add(key);
      }
    }
  }
  return out;
}

function isScope(value: unknown): value is Scope {
  return value === 'global' || (typeof value === 'string' && value.startsWith('profile:'));
}
