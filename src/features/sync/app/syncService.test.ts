import 'fake-indexeddb/auto';
import type { ConnectionId, Hlc, Scope } from '../domain/types';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { createSyncDbStore } from './syncDbStore';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import { readRouting, SYNC_DIRECTORY_STORAGE_KEY } from './routing';
import { scopeForTarget } from '../domain/scope';
import { scopesPrefix } from './remotePaths';
import {
  connectProvider,
  disconnectAccount,
  setScopeBinding,
  setSystemConnection,
  syncStatusSnapshot,
  type SyncServiceDeps,
} from './syncService';
import type { SrsSyncAccess } from '../ports/srsSyncAccess';

const PROVIDER = 'google-drive';
const DEVICE = 'dev-test';

function fakeSrs(): SrsSyncAccess {
  return {
    listCollectionSummaries: async () => [],
    rewriteCollectionProfileIds: async () => 0,
  };
}

interface Harness {
  deps: SyncServiceDeps;
  kv: InMemoryKeyValueStore;
  provider: InMemoryStorageProvider;
  remotePaths(prefix?: string): Promise<string[]>;
  directory(): Promise<Record<string, unknown>>;
}

function makeHarness(profileTargets: string[] = []): Harness {
  const kv = new InMemoryKeyValueStore();
  const provider = new InMemoryStorageProvider({ providerId: PROVIDER });
  const clock = new SeededClock();
  const store = createSyncDbStore();
  let wall = 1_000;
  const deps: SyncServiceDeps = {
    providerFor: () => provider,
    kv,
    store,
    sources: () => [],
    blobs: { read: async () => null },
    srs: fakeSrs(),
    profileTargets: async () => profileTargets,
    deviceId: async () => DEVICE,
    cycleId: () => `cycle-${Math.random().toString(36).slice(2, 10)}`,
    clock,
    tick: (): Hlc => ({ wall: (wall += 1), counter: 0, node: `${DEVICE}:svc` }),
    fence: async () => undefined,
  };
  return {
    deps,
    kv,
    provider,
    remotePaths: async (prefix = '') =>
      provider
        .list(
          { connectionId: `${PROVIDER}:acct-1` as ConnectionId, providerId: PROVIDER, accountKey: 'acct-1', displayName: 'u' },
          prefix,
        )
        .then((entries) => entries.map((e) => e.path)),
    directory: async () =>
      (await kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY)) ?? {},
  };
}

describe('connectProvider', () => {
  beforeEach(async () => {
    await deleteSyncDB();
  });
  afterEach(() => {
    closeSyncDB();
  });

  it('first connection writes connection + systemConnection + per-target bindings', async () => {
    const h = makeHarness(['en', 'ja']);
    const result = await connectProvider(h.deps, PROVIDER);
    expect(result.isFirstConnection).toBe(true);
    const dir = await h.directory();
    expect(dir['systemConnection']).toBe(result.connection.connectionId);
    expect(dir[`connection:${result.connection.connectionId}`]).toMatchObject({
      providerId: PROVIDER,
      accountKey: result.connection.accountKey,
    });
    expect(dir['deviceId']).toBe(DEVICE);
    expect(dir['binding:en']).toBe(result.connection.connectionId);
    expect(dir['binding:ja']).toBe(result.connection.connectionId);
  });

  it('first connection publishes a snapshot for global and each bound profile scope', async () => {
    const h = makeHarness(['en', 'ja']);
    const result = await connectProvider(h.deps, PROVIDER);
    const paths = await h.remotePaths(scopesPrefix());
    const scopeSet = new Set(['global', scopeForTarget('en'), scopeForTarget('ja')]);
    const snapshotScopes = paths
      .map((p) => p.split('/')[3])
      .filter((s): s is string => s !== undefined);
    expect(new Set(snapshotScopes)).toEqual(scopeSet);
    expect(result.reconciled.map((r) => r.scope).sort()).toEqual([...scopeSet].sort());
  });

  it('second connection does not overwrite systemConnection or bindings', async () => {
    const h = makeHarness(['en']);
    const first = await connectProvider(h.deps, PROVIDER);
    const second = await connectProvider(h.deps, PROVIDER);
    expect(second.isFirstConnection).toBe(false);
    expect(second.connection.connectionId).not.toBe(first.connection.connectionId);
    const dir = await h.directory();
    expect(dir['systemConnection']).toBe(first.connection.connectionId);
    expect(dir['binding:en']).toBe(first.connection.connectionId);
  });

  it('reconnecting the same connection id updates the entry without duplicating', async () => {
    const h = makeHarness([]);
    const first = await connectProvider(h.deps, PROVIDER);
    await h.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, {
      ...(await h.directory()),
      [`connection:${first.connection.connectionId}`]: {
        providerId: PROVIDER,
        accountKey: first.connection.accountKey,
        displayName: 'renamed@in-memory.test',
      },
    });
    const routing = await readRouting(h.kv);
    expect(routing.connections).toHaveLength(1);
    expect(routing.connections[0]!.displayName).toBe('renamed@in-memory.test');
  });
});

describe('disconnectAccount', () => {
  beforeEach(async () => {
    await deleteSyncDB();
  });
  afterEach(() => {
    closeSyncDB();
  });

  it('rejects unknown connections', async () => {
    const h = makeHarness([]);
    await expect(
      disconnectAccount(h.deps, 'google-drive:nope' as ConnectionId),
    ).rejects.toMatchObject({ code: 'unknown-connection' });
  });

  it('disconnecting the only connection removes it and clears systemConnection', async () => {
    const h = makeHarness([]);
    const result = await connectProvider(h.deps, PROVIDER);
    const out = await disconnectAccount(h.deps, result.connection.connectionId);
    expect(out.connectionId).toBe(result.connection.connectionId);
    const dir = await h.directory();
    expect(dir[`connection:${result.connection.connectionId}`]).toBeUndefined();
    expect(dir['systemConnection']).toBeUndefined();
  });
});

describe('setSystemConnection', () => {
  beforeEach(async () => {
    await deleteSyncDB();
  });
  afterEach(() => {
    closeSyncDB();
  });

  it('rejects unknown connections and switches to a known one', async () => {
    const h = makeHarness([]);
    const first = await connectProvider(h.deps, PROVIDER);
    const second = await connectProvider(h.deps, PROVIDER);
    await expect(
      setSystemConnection(h.deps, 'google-drive:nope' as ConnectionId),
    ).rejects.toMatchObject({ code: 'unknown-connection' });
    await setSystemConnection(h.deps, second.connection.connectionId);
    const dir = await h.directory();
    expect(dir['systemConnection']).toBe(second.connection.connectionId);
    expect(dir['systemConnection']).not.toBe(first.connection.connectionId);
  });
});

describe('setScopeBinding', () => {
  beforeEach(async () => {
    await deleteSyncDB();
  });
  afterEach(() => {
    closeSyncDB();
  });

  it('returns null when the scope already routes to the destination', async () => {
    const h = makeHarness([]);
    const result = await connectProvider(h.deps, PROVIDER);
    const out = await setScopeBinding(h.deps, 'global', result.connection.connectionId);
    expect(out).toBeNull();
  });

  it('fresh profile scope binds locally without touching the remote', async () => {
    const h = makeHarness([]);
    await connectProvider(h.deps, PROVIDER);
    const pathsBefore = await h.remotePaths(scopesPrefix());
    const out = await setScopeBinding(h.deps, 'profile:de' as Scope, 'local');
    expect(out).toBeNull();
    const dir = await h.directory();
    expect(dir['binding:de']).toBe('local');
    expect(await h.remotePaths(scopesPrefix())).toEqual(pathsBefore);
  });

  it('unbound profile scope follows the system connection implicitly', async () => {
    const h = makeHarness([]);
    const result = await connectProvider(h.deps, PROVIDER);
    const out = await setScopeBinding(
      h.deps,
      'profile:de' as Scope,
      result.connection.connectionId,
    );
    expect(out).toBeNull();
    const dir = await h.directory();
    expect(dir['binding:de']).toBeUndefined();
  });

  it('locally-bound fresh scope bound to a connection publishes a snapshot there', async () => {
    const h = makeHarness([]);
    const result = await connectProvider(h.deps, PROVIDER);
    await setScopeBinding(h.deps, 'profile:de' as Scope, 'local');
    const pathsBefore = await h.remotePaths(`${scopesPrefix()}profile:de/`);
    expect(pathsBefore.some((p) => p.includes('snapshot-'))).toBe(false);
    const out = await setScopeBinding(
      h.deps,
      'profile:de' as Scope,
      result.connection.connectionId,
    );
    expect(out).not.toBeNull();
    const dir = await h.directory();
    expect(dir['binding:de']).toBe(result.connection.connectionId);
    const paths = await h.remotePaths(`${scopesPrefix()}profile:de/`);
    expect(paths.some((p) => p.includes('snapshot-'))).toBe(true);
  });
});

describe('syncStatusSnapshot', () => {
  beforeEach(async () => {
    await deleteSyncDB();
  });
  afterEach(() => {
    closeSyncDB();
  });

  it('reports connections, bindings, and the system connection', async () => {
    const h = makeHarness(['en']);
    const result = await connectProvider(h.deps, PROVIDER);
    const status = await syncStatusSnapshot(h.deps);
    expect(status.systemConnection).toBe(result.connection.connectionId);
    expect(status.connections).toHaveLength(1);
    expect(status.connections[0]!.isSystem).toBe(true);
    expect(status.connections[0]!.disconnectPending).toBe(false);
    expect(status.bindings.map((b) => b.target)).toEqual(['en']);
    expect(status.bindings[0]!.destination).toBe(result.connection.connectionId);
  });
});
