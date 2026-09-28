import type { Scope } from '../domain/types';

export const REMOTE_ROOT = 'cell-sync/v1';
export const WIRE_FORMAT_VERSION = 1;
export const META_PREFIX = `${REMOTE_ROOT}/meta/`;
export const META_FORMAT_PATH = `${REMOTE_ROOT}/meta/format.json`;
export const DISCONNECT_MARKER_PATH = `${REMOTE_ROOT}/meta/disconnect.json`;
export const BLOBS_PREFIX = `${REMOTE_ROOT}/blobs/`;

export function routeMarkerPath(scope: Scope): string {
  return `${META_PREFIX}routes/${scope}.json`;
}

export const BLOBS_NEEDED_PREFIX = `${META_PREFIX}blobs-needed/`;

export function blobsNeededPath(contentHash: string): string {
  return `${BLOBS_NEEDED_PREFIX}${contentHash}.json`;
}

export function blobsNeededHash(path: string): string | null {
  if (!path.startsWith(BLOBS_NEEDED_PREFIX) || !path.endsWith('.json')) return null;
  return path.slice(BLOBS_NEEDED_PREFIX.length, path.length - '.json'.length);
}

export function blobPath(contentHash: string): string {
  return `${BLOBS_PREFIX}${contentHash}`;
}

export function scopesPrefix(): string {
  return `${REMOTE_ROOT}/scopes/`;
}

export function scopeOfRemotePath(path: string): Scope | null {
  const prefix = scopesPrefix();
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const cut = rest.indexOf('/');
  if (cut <= 0) return null;
  const scope = rest.slice(0, cut);
  return scope === 'global' || scope.startsWith('profile:') ? (scope as Scope) : null;
}

export function scopeDevicesPrefix(scope: Scope): string {
  return `${REMOTE_ROOT}/scopes/${scope}/devices/`;
}

export function scopeDevicePrefix(scope: Scope, deviceId: string): string {
  return `${scopeDevicesPrefix(scope)}${deviceId}/`;
}

export function deviceIdOfRemotePath(path: string, scope: Scope): string | null {
  const prefix = scopeDevicesPrefix(scope);
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const cut = rest.indexOf('/');
  return cut <= 0 ? null : rest.slice(0, cut);
}

export function journalPath(scope: Scope, deviceId: string, seq: number): string {
  return `${scopeDevicePrefix(scope, deviceId)}journal-${seq}.json.gz`;
}

export function snapshotPath(scope: Scope, deviceId: string, n: number): string {
  return `${scopeDevicePrefix(scope, deviceId)}snapshot-${n}.json.gz`;
}

export function parseJournalSeq(path: string): number | null {
  return parseNumbered(path, 'journal-');
}

export function parseSnapshotN(path: string): number | null {
  return parseNumbered(path, 'snapshot-');
}

function parseNumbered(path: string, prefix: string): number | null {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (!name.startsWith(prefix) || !name.endsWith('.json.gz')) return null;
  const raw = name.slice(prefix.length, name.length - '.json.gz'.length);
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
