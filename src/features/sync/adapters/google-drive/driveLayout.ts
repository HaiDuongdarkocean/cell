import type { Scope } from '../../domain/types';

export const REMOTE_ROOT = 'cell-sync/v1';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface MappedPath {
  readonly chain: readonly string[];
  readonly leaf: string;
}

export type FolderedTarget =
  | { readonly kind: 'tree' }
  | { readonly kind: 'scopes'; readonly scopePrefix: string }
  | { readonly kind: 'chain'; readonly chain: readonly string[]; readonly leafPrefix: string };

export function scopeFolderName(scope: Scope): string {
  return scope === 'global' ? 'global' : `profile-${scope.slice('profile:'.length)}`;
}

export function scopeOfFolderName(name: string): Scope | null {
  if (name === 'global') return 'global';
  if (name.startsWith('profile-') && name.length > 'profile-'.length) {
    return `profile:${name.slice('profile-'.length)}` as Scope;
  }
  return null;
}

function routeLeafOf(scope: string): string {
  return `${scope.replace(':', '-')}.json`;
}

function scopeOfRouteLeaf(name: string): Scope | null {
  if (!name.endsWith('.json')) return null;
  const scope = name.slice(0, -'.json'.length).replace('-', ':');
  return scope === 'global' || scope.startsWith('profile:') ? (scope as Scope) : null;
}

const DEVICE_LEAF = /^(journal|snapshot)-\d+\.json\.gz$/;
const HASH_LEAF = /^[0-9a-z]+$/;
const META_LEAF = /^[^/]+\.json$/;

export function mapLogicalPath(path: string): MappedPath | null {
  const root = `${REMOTE_ROOT}/`;
  if (!path.startsWith(root)) return null;
  const rem = path.slice(root.length);
  if (rem.startsWith('scopes/')) {
    const seg = rem.slice('scopes/'.length).split('/');
    if (seg.length !== 4 || seg[1] !== 'devices' || seg[0] === '' || seg[2] === '') {
      return null;
    }
    const [scope, , deviceId, leaf] = seg;
    return { chain: [scopeFolderName(scope as Scope), deviceId!], leaf: leaf! };
  }
  if (rem.startsWith('blobs/')) {
    const leaf = rem.slice('blobs/'.length);
    if (leaf.includes('/')) return null;
    return { chain: ['blobs'], leaf };
  }
  if (rem.startsWith('meta/')) {
    const rest = rem.slice('meta/'.length);
    if (rest.startsWith('routes/')) {
      const leaf = rest.slice('routes/'.length);
      if (leaf.includes('/')) return null;
      const scope = leaf.endsWith('.json') ? leaf.slice(0, -'.json'.length) : leaf;
      return { chain: ['meta', 'routes'], leaf: routeLeafOf(scope) };
    }
    if (rest.startsWith('blobs-needed/')) {
      const leaf = rest.slice('blobs-needed/'.length);
      if (leaf.includes('/')) return null;
      return { chain: ['meta', 'blobs-needed'], leaf };
    }
    if (rest.includes('/')) return null;
    return { chain: ['meta'], leaf: rest };
  }
  return null;
}

export function logicalPathOf(chain: readonly string[], leaf: string): string | null {
  const root = REMOTE_ROOT;
  if (chain.length === 1 && chain[0] === 'blobs') {
    return HASH_LEAF.test(leaf) ? `${root}/blobs/${leaf}` : null;
  }
  if (chain.length === 1 && chain[0] === 'meta') {
    return META_LEAF.test(leaf) ? `${root}/meta/${leaf}` : null;
  }
  if (chain.length === 2 && chain[0] === 'meta' && chain[1] === 'routes') {
    const scope = scopeOfRouteLeaf(leaf);
    return scope === null ? null : `${root}/meta/routes/${scope}.json`;
  }
  if (chain.length === 2 && chain[0] === 'meta' && chain[1] === 'blobs-needed') {
    return /^[^/]+$/.test(leaf) ? `${root}/meta/blobs-needed/${leaf}` : null;
  }
  if (chain.length === 2) {
    const scope = scopeOfFolderName(chain[0]!);
    if (scope === null) return null;
    if (!DEVICE_LEAF.test(leaf)) return null;
    return `${root}/scopes/${scope}/devices/${chain[1]}/${leaf}`;
  }
  return null;
}

function metaChildIsFolder(name: string): boolean {
  return name === 'routes' || name === 'blobs-needed';
}

export function folderedTarget(prefix: string): FolderedTarget | null {
  if (REMOTE_ROOT.startsWith(prefix) || prefix === `${REMOTE_ROOT}/`) {
    return { kind: 'tree' };
  }
  const root = `${REMOTE_ROOT}/`;
  if (!prefix.startsWith(root)) return null;
  const rem = prefix.slice(root.length);
  const seg = rem.split('/');
  const last = seg[seg.length - 1]!;
  const complete = seg.slice(0, -1);

  if (complete.length === 0) {
    return last === '' ? { kind: 'tree' } : null;
  }

  if (complete[0] === 'scopes') {
    if (complete.length === 1) {
      return { kind: 'scopes', scopePrefix: last };
    }
    const scopeFolder = scopeFolderName(complete[1] as Scope);
    if (complete.length === 2) {
      return { kind: 'chain', chain: [scopeFolder], leafPrefix: last };
    }
    if (complete.length === 3 && complete[2] === 'devices') {
      return { kind: 'chain', chain: [scopeFolder], leafPrefix: last };
    }
    if (complete.length === 4 && complete[2] === 'devices' && complete[3] !== '') {
      return { kind: 'chain', chain: [scopeFolder, complete[3]], leafPrefix: last };
    }
    return null;
  }

  if (complete[0] === 'blobs') {
    if (complete.length !== 1) return null;
    return { kind: 'chain', chain: ['blobs'], leafPrefix: last };
  }

  if (complete[0] === 'meta') {
    if (complete.length === 1) {
      return { kind: 'chain', chain: ['meta'], leafPrefix: last };
    }
    if (complete.length === 2 && metaChildIsFolder(complete[1]!)) {
      return { kind: 'chain', chain: ['meta', complete[1]], leafPrefix: last };
    }
    return null;
  }

  return null;
}
