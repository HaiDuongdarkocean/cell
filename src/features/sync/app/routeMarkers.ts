import type { Connection, ConnectionId, Hlc, Scope } from '../domain/types';
import { isPlainJsonObject } from '../domain/flatten';
import { compareHlc } from '../domain/hlc';
import type { StorageProvider } from '../ports/storageProvider';
import { ProviderError } from '../ports/storageProvider';
import { META_PREFIX, routeMarkerPath } from './remotePaths';
import { blobToBytes } from '../adapters/contract/blobBytes';

const ROUTES_PREFIX = `${META_PREFIX}routes/`;

export interface RouteMarker {
  readonly hlc: Hlc;
  readonly destination: ConnectionId | 'local';
}

export interface RouteMarkerWire {
  readonly formatVersion: number;
  readonly kind: 'route';
  readonly hlc: Hlc;
  readonly destination: ConnectionId | 'local';
}

function isHlc(value: unknown): value is Hlc {
  return (
    isPlainJsonObject(value) &&
    typeof value['wall'] === 'number' &&
    typeof value['counter'] === 'number' &&
    typeof value['node'] === 'string'
  );
}

export function encodeRouteMarker(marker: RouteMarker): Blob {
  const wire: RouteMarkerWire = {
    formatVersion: 1,
    kind: 'route',
    hlc: marker.hlc,
    destination: marker.destination,
  };
  return new Blob([JSON.stringify(wire)]);
}

export async function decodeRouteMarker(blob: Blob): Promise<RouteMarker | null> {
  try {
    const bytes = await blobToBytes(blob);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isPlainJsonObject(parsed)) return null;
    if (parsed['formatVersion'] !== 1 || parsed['kind'] !== 'route') return null;
    const { hlc, destination } = parsed;
    if (!isHlc(hlc)) return null;
    if (destination !== 'local' && typeof destination !== 'string') return null;
    return { hlc, destination: destination as ConnectionId | 'local' };
  } catch {
    return null;
  }
}

export async function writeRouteMarker(
  deps: {
    readonly provider: StorageProvider;
    readonly connection: Connection;
    readonly fence: () => Promise<void>;
  },
  scope: Scope,
  marker: RouteMarker,
): Promise<boolean> {
  const existing = await readRouteMarker(deps.provider, deps.connection, scope);
  if (existing !== null && compareHlc(existing.hlc, marker.hlc) > 0) return false;
  await deps.fence();
  await deps.provider.write(
    deps.connection,
    routeMarkerPath(scope),
    encodeRouteMarker(marker),
  );
  const landed = await readRouteMarker(deps.provider, deps.connection, scope);
  return landed !== null && compareHlc(landed.hlc, marker.hlc) === 0;
}

export async function readRouteMarker(
  provider: StorageProvider,
  connection: Connection,
  scope: Scope,
): Promise<RouteMarker | null> {
  let blob: Blob;
  try {
    blob = await provider.read(connection, routeMarkerPath(scope));
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return null;
    throw e;
  }
  return decodeRouteMarker(blob);
}

export async function readRouteMarkers(
  provider: StorageProvider,
  connection: Connection,
): Promise<Map<Scope, RouteMarker>> {
  let entries;
  try {
    entries = await provider.list(connection, ROUTES_PREFIX);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'not-found') return new Map();
    throw e;
  }
  const out = new Map<Scope, RouteMarker>();
  for (const entry of entries) {
    const file = entry.path.slice(ROUTES_PREFIX.length);
    if (!file.endsWith('.json')) continue;
    const scope = file.slice(0, -'.json'.length);
    if (scope !== 'global' && !scope.startsWith('profile:')) continue;
    try {
      const marker = await decodeRouteMarker(
        await provider.read(connection, entry.path),
      );
      if (marker !== null) out.set(scope as Scope, marker);
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') continue;
      throw e;
    }
  }
  return out;
}
