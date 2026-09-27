import 'fake-indexeddb/auto';
import { DeterministicIdSource } from '../adapters/memory/DeterministicIdSource';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { createKvLocalSource } from '../adapters/local/kv/kvLocalSource';
import { SYNC_META_KV_STORAGE_KEY } from '../adapters/local/kv/keys';
import { stampKvMeta } from '../adapters/local/kv/kvMeta';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import type {
  ChangeRecord,
  Connection,
  DataClass,
  PendingKey,
  RecordKey,
  RecordMeta,
  Scope,
} from '../domain/types';
import type { ApplyResult, LocalSource } from '../ports/localSource';
import { BACKOFF_BASE_MS } from './backoff';
import { SYNC_LOCK_STORAGE_KEY } from './cycleLock';
import { SYNC_APPLIED_AT_KEY } from './pullCycle';
import { journalPath, parseSnapshotN, scopeDevicePrefix, DISCONNECT_MARKER_PATH } from './remotePaths';
import { routeMarkerPath } from './remotePaths';
import { encodeRouteMarker } from './routeMarkers';
import { writeCheckpoint } from './checkpoints';
import { DISCONNECT_PENDING_PREFIX } from './disconnect';
import { readRouting } from './routing';
import { SyncEngine } from './SyncEngine';
import type { EngineStatus, SyncEngineDeps } from './SyncEngine';
import { createSyncDbStore } from './syncDbStore';
import { decodeJournal, encodeJournal } from './wireCodec';

const DEVICE = 'dev-1';
const PROVIDER_ID = 'mem';
const GLOBAL: Scope = 'global';

class FakeSource implements LocalSource {
  keys: PendingKey[] = [];
  acked: PendingKey[] = [];
  private readonly values = new Map<string, unknown>();
  private wall = 0;

  constructor(
    readonly dataClass: DataClass,
    private readonly scope: Scope,
  ) {}

  pushKey(key: string, op: 'put' | 'delete' = 'put', value?: unknown): void {
    this.keys.push({ scope: this.scope, dataClass: this.dataClass, key, op });
    if (value !== undefined) this.values.set(key, value);
  }

  async pending(limit: number): Promise<PendingKey[]> {
    return this.keys.slice(0, limit);
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    const owned = new Set(this.keys.map((k) => `${k.scope}|${k.key}`));
    return keys
      .filter((key) => owned.has(`${key.scope}|${key.key}`))
      .map((key) => {
        this.wall += 10;
        return {
          scope: this.scope,
          dataClass: this.dataClass,
          key: key.key,
          op: key.op,
          value: key.op === 'put' ? this.values.get(key.key) ?? 1 : undefined,
          hlc: { wall: this.wall, counter: 0, node: `${DEVICE}:ctx` },
        };
      });
  }

  async ack(keys: PendingKey[]): Promise<void> {
    const mine = keys.filter((k) => k.scope === this.scope && k.dataClass === this.dataClass);
    this.acked.push(...mine);
    const done = new Set(mine.map((k) => `${k.scope}|${k.key}`));
    this.keys = this.keys.filter((k) => !done.has(`${k.scope}|${k.key}`));
  }

  async stampCommitted(): Promise<void> {}

  async *snapshot(): AsyncIterable<ChangeRecord> {}

  async current(
    _scope: Scope,
    keys: RecordKey[],
  ): Promise<Map<RecordKey, ChangeRecord | null>> {
    return new Map(keys.map((k) => [k, null]));
  }

  remoteApplied: ChangeRecord[] = [];

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    const mine = records.filter(
      (r) => r.scope === this.scope && r.dataClass === this.dataClass,
    );
    this.remoteApplied.push(...mine);
    return { applied: mine, localWon: [], opaque: [] };
  }
}

interface Harness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  store: ReturnType<typeof createSyncDbStore>;
  statuses: EngineStatus[];
  makeEngine(overrides?: Partial<SyncEngineDeps>): SyncEngine;
  remotePaths(prefix?: string): Promise<string[]>;
  setDirectory(patch: Record<string, unknown>): Promise<void>;
}

async function harness(): Promise<Harness> {
  const provider = new InMemoryStorageProvider({ providerId: PROVIDER_ID });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `${PROVIDER_ID}:${account.accountKey}` as Connection['connectionId'],
    providerId: PROVIDER_ID,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const kv = new InMemoryKeyValueStore();
  const clock = new SeededClock(1000);
  const store = createSyncDbStore();
  const statuses: EngineStatus[] = [];
  const setDirectory = async (patch: Record<string, unknown>) => {
    const state = (await kv.get<Record<string, unknown>>('local', 'syncState')) ?? {};
    await kv.set('local', 'syncState', { ...state, ...patch });
  };
  await setDirectory({
    deviceId: DEVICE,
    systemConnection: connection.connectionId,
    [`connection:${connection.connectionId}`]: {
      providerId: PROVIDER_ID,
      accountKey: account.accountKey,
      displayName: account.displayName,
    },
  });
  const makeEngine = (overrides: Partial<SyncEngineDeps> = {}): SyncEngine => {
    const engine = new SyncEngine({
      kv,
      store,
      sources: [],
      blobs: { read: async () => null },
      providerFor: () => provider,
      connections: async () => [connection],
      deviceId: async () => DEVICE,
      clock,
      ids: new DeterministicIdSource(),
      lock: { schedule: () => () => undefined },
      ...overrides,
    });
    engine.subscribe((status) => statuses.push(status));
    return engine;
  };
  return {
    provider,
    connection,
    kv,
    clock,
    store,
    statuses,
    makeEngine,
    setDirectory,
    remotePaths: async (prefix = 'cell-sync/v1/') =>
      (await provider.list(connection, prefix)).map((e) => e.path).sort(),
  };
}

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('SyncEngine.runCycle', () => {
  it('acquires the lock, pushes pending records, releases the lock and reports idle', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/theme', 'put', 'dark');
    const engine = t.makeEngine({ sources: [source] });

    const result = await engine.runCycle();
    expect(result.acquired).toBe(true);
    expect(result.lockLost).toBe(false);
    expect(result.failed).toEqual([]);
    expect(result.scopesPushed).toEqual([GLOBAL]);
    expect(result.ackedKeys).toBe(1);

    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
    const journal = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 1)),
    );
    expect(journal.records.map((r) => r.key)).toEqual(['kv:settings/theme']);
    expect(await t.kv.get('session', SYNC_LOCK_STORAGE_KEY)).toBeUndefined();
    expect(engine.current.state).toBe('idle');
    expect(t.statuses.map((s) => s.state)).toEqual(['running', 'idle']);
  });

  it('does not acquire when a foreign live lock exists', async () => {
    const t = await harness();
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
      cycleId: 'other-cycle',
      expiresAt: t.clock.now() + 60_000,
    });
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.acquired).toBe(false);
    expect(await t.remotePaths()).toEqual([]);
    expect(source.acked).toEqual([]);
    expect(engine.current.state).toBe('idle');
    expect(source.keys).toHaveLength(1);
  });

  it('joins an in-flight cycle', async () => {
    const t = await harness();
    const engine = t.makeEngine();
    const first = engine.runCycle();
    const second = engine.runCycle();
    expect(second).toBe(first);
    await first;
    const next = await engine.runCycle();
    expect(next.acquired).toBe(true);
  });

  it('steals an expired lock', async () => {
    const t = await harness();
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
      cycleId: 'dead-cycle',
      expiresAt: t.clock.now() - 1,
    });
    const engine = t.makeEngine();
    const result = await engine.runCycle();
    expect(result.acquired).toBe(true);
    expect(await t.kv.get('session', SYNC_LOCK_STORAGE_KEY)).toBeUndefined();
  });
});

describe('routing', () => {
  it('acks local-bound scope keys without any remote write', async () => {
    const t = await harness();
    await t.setDirectory({ 'binding:fr': 'local' });
    const source = new FakeSource('wordStatus', 'profile:fr');
    source.pushKey('word:bonjour', 'put', { level: 'known' });
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.ackedKeys).toBe(1);
    expect(result.scopesPushed).toEqual([]);
    expect(await t.remotePaths()).toEqual([]);
    expect(source.acked.map((k) => k.key)).toEqual(['word:bonjour']);
  });

  it('holds keys of scopes frozen by a routing checkpoint', async () => {
    const t = await harness();
    await t.kv.set('local', 'syncCheckpoints', {
      'profile:en': { kind: 'rebind', phase: 'freeze', from: 'a', to: 'b' },
    });
    const source = new FakeSource('srsCard', 'profile:en');
    source.pushKey('cards:c1', 'put', { id: 'c1' });
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.ackedKeys).toBe(0);
    expect(source.acked).toEqual([]);
    expect(source.keys).toHaveLength(1);
    expect(await t.remotePaths()).toEqual([]);
  });

  it('holds keys routed to a connection without a usable session', async () => {
    const t = await harness();
    await t.setDirectory({ 'binding:en': 'mem:other-acct' });
    const source = new FakeSource('srsCard', 'profile:en');
    source.pushKey('cards:c1', 'put', { id: 'c1' });
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.ackedKeys).toBe(0);
    expect(await t.remotePaths()).toEqual([]);
  });

  it('routes profile scopes to their binding and global to the system connection', async () => {
    const t = await harness();
    const other = await t.provider.authorize({ interactive: true, accountHint: 'x' });
    const otherConn: Connection = {
      connectionId: `${PROVIDER_ID}:${other.accountKey}` as Connection['connectionId'],
      providerId: PROVIDER_ID,
      accountKey: other.accountKey,
      displayName: other.displayName,
    };
    await t.setDirectory({
      'binding:en': otherConn.connectionId,
      [`connection:${otherConn.connectionId}`]: {
        providerId: PROVIDER_ID,
        accountKey: other.accountKey,
        displayName: other.displayName,
      },
    });
    const global = new FakeSource('settings', GLOBAL);
    global.pushKey('kv:settings/a', 'put', 1);
    const profile = new FakeSource('srsCard', 'profile:en');
    profile.pushKey('cards:c1', 'put', { id: 'c1' });
    const engine = t.makeEngine({
      sources: [global, profile],
      connections: async () => [t.connection, otherConn],
    });
    const result = await engine.runCycle();
    expect(result.scopesPushed.sort()).toEqual([GLOBAL, 'profile:en'].sort());
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
    const otherPaths = await t.provider.list(otherConn, 'cell-sync/v1/');
    expect(otherPaths.map((e) => e.path)).toEqual([
      journalPath('profile:en', DEVICE, 1),
    ]);
  });
});

describe('crash resume and fencing', () => {
  it('re-uploads a pending batch left by a crashed cycle before draining new keys', async () => {
    const t = await harness();
    const frozen: ChangeRecord = {
      scope: GLOBAL,
      dataClass: 'settings',
      key: 'kv:settings/frozen',
      op: 'put',
      value: 'kept',
      hlc: { wall: 7, counter: 0, node: `${DEVICE}:ctx` },
    };
    await t.store.freezeBatch({
      connectionId: t.connection.connectionId,
      scope: GLOBAL,
      records: [frozen],
      cycleId: 'dead-cycle',
      createdAt: 5,
    });
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/fresh', 'put', 'new');
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.scopesPushed).toEqual([GLOBAL]);
    const first = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 1)),
    );
    const second = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 2)),
    );
    expect(first.records[0]).toMatchObject({ key: 'kv:settings/frozen', value: 'kept' });
    expect(second.records[0]).toMatchObject({ key: 'kv:settings/fresh' });
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
  });

  it('aborts without acking when the lock is stolen mid-cycle, then recovers', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    const base = t.store;
    const stealingStore = {
      ...base,
      freezeBatch: async (input: Parameters<typeof base.freezeBatch>[0]) => {
        const batch = await base.freezeBatch(input);
        await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
          cycleId: 'stealer',
          expiresAt: t.clock.now() + 60_000,
        });
        return batch;
      },
    };
    const engine = t.makeEngine({ sources: [source], store: stealingStore });
    const result = await engine.runCycle();
    expect(result.lockLost).toBe(true);
    expect(await t.remotePaths()).toEqual([]);
    expect(source.acked).toEqual([]);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toHaveLength(1);
    expect(engine.current.state).toBe('idle');
    expect(engine.current.lastError).toBe('cycle lock lost');

    await t.kv.del('session', SYNC_LOCK_STORAGE_KEY);
    const recovered = await engine.runCycle();
    expect(recovered.lockLost).toBe(false);
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
    expect(t.provider.countCopies(t.connection, journalPath(GLOBAL, DEVICE, 1))).toBe(1);
    expect(source.acked.map((k) => k.key)).toEqual(['kv:settings/a']);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
  });
});

describe('error mapping and backoff', () => {
  it('maps network errors to offline, gates retries on retryAt and escalates backoff', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    t.provider.failNext(1, 'network');
    const engine = t.makeEngine({ sources: [source] });
    const first = await engine.runCycle();
    expect(first.failed).toHaveLength(1);
    expect(engine.current.state).toBe('offline');
    expect(engine.current.retryAt).toBe(1000 + BACKOFF_BASE_MS);

    const gated = await engine.runCycle();
    expect(gated.failed).toHaveLength(1);
    expect(gated.failed[0]!.state).toBe('offline');
    expect(engine.current.retryAt).toBe(1000 + BACKOFF_BASE_MS);
    expect(await t.remotePaths()).toEqual([]);

    t.clock.set(1000 + BACKOFF_BASE_MS);
    t.provider.failNext(1, 'network');
    const second = await engine.runCycle();
    expect(second.failed).toHaveLength(1);
    expect(engine.current.retryAt).toBe(1000 + BACKOFF_BASE_MS * 3);

    t.clock.set(1000 + BACKOFF_BASE_MS * 3);
    const third = await engine.runCycle();
    expect(third.failed).toEqual([]);
    expect(engine.current.state).toBe('idle');
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
  });

  it('maps auth errors to needs-reauth', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    t.provider.failNext(1, 'auth');
    const engine = t.makeEngine({ sources: [source] });
    await engine.runCycle();
    expect(engine.current.state).toBe('needs-reauth');
    expect(engine.current.retryAt).toBe(1000 + BACKOFF_BASE_MS);
  });

  it('maps quota errors to storage-full', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    t.provider.failNext(1, 'quota');
    const engine = t.makeEngine({ sources: [source] });
    await engine.runCycle();
    expect(engine.current.state).toBe('storage-full');
  });

  it('maps unexpected errors to backoff', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    source.resolve = async () => {
      throw new Error('resolve blew up');
    };
    const engine = t.makeEngine({ sources: [source] });
    await engine.runCycle();
    expect(engine.current.state).toBe('backoff');
    expect(engine.current.retryAt).toBe(1000 + BACKOFF_BASE_MS);
  });
});

describe('kv meta stamping', () => {
  it('stamps syncMetaKV after the journal write so pending stays clean', async () => {
    const t = await harness();
    await t.kv.set('local', 'themeMode', 'dark');
    let wall = 100;
    const source = createKvLocalSource('secondaryKey', {
      kv: t.kv,
      tick: () => ({ wall: (wall += 1), counter: 0, node: `${DEVICE}:ctx` }),
    });
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runCycle();
    expect(result.ackedKeys).toBe(1);
    const meta =
      (await t.kv.get<Record<string, RecordMeta>>('local', SYNC_META_KV_STORAGE_KEY)) ?? {};
    expect(meta['global|kv:themeMode']).toBeDefined();
    expect(await source.pending(10)).toEqual([]);
    const journal = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 1)),
    );
    expect(journal.records[0]).toMatchObject({
      dataClass: 'secondaryKey',
      key: 'kv:themeMode',
      value: 'dark',
    });
  });
});

describe('pull', () => {
  const remoteRecord = (key: string, value: unknown, wall: number): ChangeRecord => ({
    scope: GLOBAL,
    dataClass: 'settings',
    key,
    op: 'put',
    value,
    hlc: { wall, counter: 0, node: 'dev-2:ctx' },
  });

  it('pulls remote journals, applies records and emits SYNC_DATA_APPLIED', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, 'dev-2', 1),
      encodeJournal({
        scope: GLOBAL,
        deviceId: 'dev-2',
        seq: 1,
        records: [remoteRecord('kv:settings/theme', 'dark', 10)],
      }),
    );
    const applied: { dataClasses: DataClass[]; scopes: Scope[] }[] = [];
    const engine = t.makeEngine({
      sources: [source],
      onApplied: (payload) => {
        applied.push(payload);
      },
    });

    const result = await engine.runCycle();

    expect(result.scopesPulled).toEqual([GLOBAL]);
    expect(result.appliedDataClasses).toEqual(['settings']);
    expect(result.appliedScopes).toEqual([GLOBAL]);
    expect(source.remoteApplied.map((r) => r.key)).toEqual(['kv:settings/theme']);
    expect(await t.kv.get('session', SYNC_APPLIED_AT_KEY)).toBe(1000);
    expect(applied).toEqual([{ dataClasses: ['settings'], scopes: [GLOBAL] }]);
  });

  it('does not emit applied hooks when nothing came in', async () => {
    const t = await harness();
    const engine = t.makeEngine();
    const result = await engine.runCycle();
    expect(result.appliedDataClasses).toEqual([]);
    expect(await t.kv.get('session', SYNC_APPLIED_AT_KEY)).toBeUndefined();
  });

  it('invokes onDisconnect when the remote disconnect marker is newer', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    await stampKvMeta(t.kv, [
      {
        scope: GLOBAL,
        dataClass: 'syncDirectory',
        key: `connection:${t.connection.connectionId}`,
        op: 'put',
        value: { connectionId: t.connection.connectionId },
        hlc: { wall: 1, counter: 0, node: `${DEVICE}:ctx` },
      },
    ]);
    await t.provider.write(
      t.connection,
      'cell-sync/v1/meta/disconnect.json',
      new Blob([
        JSON.stringify({
          formatVersion: 1,
          kind: 'disconnect',
          hlc: { wall: 5000, counter: 0, node: 'dev-2:ctx' },
        }),
      ]),
    );
    const disconnected: string[] = [];
    const engine = t.makeEngine({
      sources: [source],
      onDisconnect: async (connectionId) => {
        disconnected.push(connectionId);
      },
    });
    const result = await engine.runCycle();
    expect(disconnected).toEqual([t.connection.connectionId]);
    expect(result.scopesPulled).toEqual([]);
    expect(result.scopesPushed).toEqual([]);
    await expect(t.provider.list(t.connection, 'cell-sync/v1/')).rejects.toThrow(
      'revoked',
    );
    await t.provider.authorize({
      interactive: false,
      accountHint: t.connection.accountKey,
    });
    const writes = (await t.remotePaths()).filter((p) => !p.endsWith('disconnect.json'));
    expect(writes).toEqual([]);
  });

  it('observes remote HLCs through observeHlc', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, 'dev-2', 1),
      encodeJournal({
        scope: GLOBAL,
        deviceId: 'dev-2',
        seq: 1,
        records: [remoteRecord('kv:a', 1, 10), remoteRecord('kv:b', 2, 20)],
      }),
    );
    const observed: number[] = [];
    const engine = t.makeEngine({
      sources: [source],
      observeHlc: (hlc) => {
        observed.push(hlc.wall);
      },
    });
    await engine.runCycle();
    expect(observed).toEqual([10, 20]);
  });
});

describe('SyncEngine obligations', () => {
  const SCOPE: Scope = 'profile:lang:en';
  const tickWall = { wall: 5_000 };

  const tick = () => {
    tickWall.wall += 1;
    return { wall: tickWall.wall, counter: 0, node: `${DEVICE}:cycle` };
  };

  async function secondConnection(t: Harness): Promise<Connection> {
    const account = await t.provider.authorize({ interactive: true });
    const conn: Connection = {
      connectionId: `${PROVIDER_ID}:${account.accountKey}` as Connection['connectionId'],
      providerId: PROVIDER_ID,
      accountKey: account.accountKey,
      displayName: account.displayName,
    };
    await t.setDirectory({
      [`connection:${conn.connectionId}`]: {
        providerId: PROVIDER_ID,
        accountKey: account.accountKey,
        displayName: account.displayName,
      },
      [`binding:${SCOPE.slice('profile:'.length)}`]: t.connection.connectionId,
    });
    return conn;
  }

  it('processes a drain checkpoint: publishes scope snapshot to the new destination', async () => {
    const t = await harness();
    const connB = await secondConnection(t);
    await writeCheckpoint(t.kv, {
      scope: SCOPE,
      kind: 'drain',
      phase: 'open',
      from: t.connection.connectionId,
      to: connB.connectionId,
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    const engine = t.makeEngine({
      connections: async () => [t.connection, connB],
      tick,
    });
    const result = await engine.runCycle();
    expect(result.failed).toEqual([]);
    const onB = (await t.provider.list(connB, scopeDevicePrefix(SCOPE, DEVICE))).filter(
      (e) => parseSnapshotN(e.path) !== null,
    );
    expect(onB).toHaveLength(1);
    const checkpoints = await t.kv.get('local', 'syncCheckpoints');
    expect(checkpoints ?? {}).toEqual({});
  });

  it('reports waitingScopes for a drain whose destination is not connected', async () => {
    const t = await harness();
    await writeCheckpoint(t.kv, {
      scope: SCOPE,
      kind: 'drain',
      phase: 'open',
      from: t.connection.connectionId,
      to: `${PROVIDER_ID}:ghost` as Connection['connectionId'],
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    const engine = t.makeEngine({ tick });
    const result = await engine.runCycle();
    expect(result.waitingScopes).toEqual([SCOPE]);
  });

  it('completes a pending disconnect: writes marker and removes the connection locally', async () => {
    const t = await harness();
    const connB = await secondConnection(t);
    await t.kv.set('local', `${DISCONNECT_PENDING_PREFIX}${connB.connectionId}`, {
      at: t.clock.now(),
    });
    const disconnected: string[] = [];
    const engine = t.makeEngine({
      connections: async () => [t.connection, connB],
      tick,
      onDisconnect: async (id) => {
        disconnected.push(id);
      },
    });
    const result = await engine.runCycle();
    expect(result.failed).toEqual([]);
    await t.provider.authorize({ interactive: false, accountHint: connB.accountKey });
    expect(await t.provider.list(connB, DISCONNECT_MARKER_PATH)).toHaveLength(1);
    expect(disconnected).toEqual([connB.connectionId]);
    expect(
      await t.kv.get('local', `${DISCONNECT_PENDING_PREFIX}${connB.connectionId}`),
    ).toBeUndefined();
    const state = await t.kv.get<Record<string, unknown>>('local', 'syncState');
    expect(state?.[`connection:${connB.connectionId}`]).toBeUndefined();
  });

  it('reads route markers before push: a newer marker freezes the scope in the same cycle', async () => {
    const t = await harness();
    const ghost = `${PROVIDER_ID}:ghost` as Connection['connectionId'];
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    await t.provider.write(
      t.connection,
      routeMarkerPath(SCOPE),
      encodeRouteMarker({
        hlc: { wall: 4000, counter: 0, node: 'dev-2:ctx' },
        destination: ghost,
      }),
    );
    const source = new FakeSource('settings', SCOPE);
    source.pushKey('kv:x', 'put', 1);
    const engine = t.makeEngine({ sources: [source], tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    expect(result.scopesPushed).toEqual([]);
    expect(result.waitingScopes).toEqual([SCOPE]);
    expect(result.waitingFor[SCOPE]).toBe(ghost);
    const scopeWrites = (await t.remotePaths()).filter((p) =>
      p.includes('/scopes/'),
    );
    expect(scopeWrites).toEqual([]);
    const checkpoints = await t.kv.get<Record<string, unknown>>(
      'local',
      'syncCheckpoints',
    );
    expect(checkpoints?.[SCOPE]).toMatchObject({ kind: 'drain', to: ghost });
  });

  it('ignores a route marker older than the applied routing record', async () => {
    const t = await harness();
    const ghost = `${PROVIDER_ID}:ghost` as Connection['connectionId'];
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    await stampKvMeta(t.kv, [
      {
        scope: GLOBAL,
        dataClass: 'syncDirectory',
        key: 'binding:lang:en',
        op: 'put',
        value: t.connection.connectionId,
        hlc: { wall: 6000, counter: 0, node: `${DEVICE}:ctx` },
      },
    ]);
    await t.provider.write(
      t.connection,
      routeMarkerPath(SCOPE),
      encodeRouteMarker({
        hlc: { wall: 4000, counter: 0, node: 'dev-2:ctx' },
        destination: ghost,
      }),
    );
    const source = new FakeSource('settings', SCOPE);
    source.pushKey('kv:x', 'put', 1);
    const engine = t.makeEngine({ sources: [source], tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    expect(result.scopesPushed).toEqual([SCOPE]);
    expect(result.waitingScopes).toEqual([]);
    const checkpoints = await t.kv.get<Record<string, unknown>>(
      'local',
      'syncCheckpoints',
    );
    expect(checkpoints ?? {}).toEqual({});
  });

  it('completes a drain-to-local checkpoint by routing the scope to local', async () => {
    const t = await harness();
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    await writeCheckpoint(t.kv, {
      scope: SCOPE,
      kind: 'drain',
      phase: 'open',
      from: t.connection.connectionId,
      to: 'local',
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    const source = new FakeSource('settings', SCOPE);
    source.pushKey('kv:x', 'put', 1);
    const engine = t.makeEngine({ sources: [source], tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    const routing = await readRouting(t.kv);
    expect(routing.bindings.get('lang:en')).toBe('local');
    expect(source.acked.map((k) => k.key)).toEqual(['kv:x']);
    const checkpoints = await t.kv.get<Record<string, unknown>>(
      'local',
      'syncCheckpoints',
    );
    expect(checkpoints ?? {}).toEqual({});
    expect((await t.remotePaths()).filter((p) => p.includes('/scopes/'))).toEqual(
      [],
    );
  });

  it('defers a routing record when the scope is occupied by another checkpoint', async () => {
    const t = await harness();
    const ghost = `${PROVIDER_ID}:ghost` as Connection['connectionId'];
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    await writeCheckpoint(t.kv, {
      scope: SCOPE,
      kind: 'rebind',
      phase: 'freeze',
      from: t.connection.connectionId,
      to: ghost,
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    const record: ChangeRecord = {
      scope: GLOBAL,
      dataClass: 'syncDirectory',
      key: 'binding:lang:en',
      op: 'put',
      value: `${PROVIDER_ID}:other`,
      hlc: { wall: 5, counter: 0, node: 'dev-2:ctx' },
    };
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, 'dev-2', 1),
      encodeJournal({
        scope: GLOBAL,
        deviceId: 'dev-2',
        seq: 1,
        records: [record],
      }),
    );
    const engine = t.makeEngine({ tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    const deferred = await t.store.listDeferred(t.connection.connectionId);
    expect(deferred.map((d) => d.recordKey)).toEqual(['binding:lang:en']);
    const routing = await readRouting(t.kv);
    expect(routing.bindings.get('lang:en')).toBe(t.connection.connectionId);
    const checkpoints = await t.kv.get<Record<string, unknown>>(
      'local',
      'syncCheckpoints',
    );
    expect(checkpoints?.[SCOPE]).toBeUndefined();
  });

  it('reports waitingScopes for pending keys with no destination', async () => {
    const t = await harness();
    await t.setDirectory({ systemConnection: undefined });
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:x', 'put', 1);
    const engine = t.makeEngine({ sources: [source] });

    const result = await engine.runCycle();

    expect(result.ackedKeys).toBe(0);
    expect(result.waitingScopes).toEqual([GLOBAL]);
  });

  it('clears orphaned checkpoints when completing a pending disconnect for an absent connection', async () => {
    const t = await harness();
    const ghost = `${PROVIDER_ID}:ghost` as Connection['connectionId'];
    await t.kv.set('local', `${DISCONNECT_PENDING_PREFIX}${ghost}`, {
      at: t.clock.now(),
    });
    await writeCheckpoint(t.kv, {
      scope: SCOPE,
      kind: 'drain',
      phase: 'open',
      from: t.connection.connectionId,
      to: ghost,
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    const engine = t.makeEngine({ tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    const checkpoints = await t.kv.get<Record<string, unknown>>(
      'local',
      'syncCheckpoints',
    );
    expect(checkpoints?.[SCOPE]).toBeUndefined();
    expect(
      await t.kv.get('local', `${DISCONNECT_PENDING_PREFIX}${ghost}`),
    ).toBeUndefined();
  });

  it('adopts deferred records left behind by a connection absent from the directory', async () => {
    const t = await harness();
    const ghost = `${PROVIDER_ID}:ghost` as Connection['connectionId'];
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    const source = new FakeSource('settings', SCOPE);
    await t.store.deferRecord({
      connectionId: ghost,
      record: {
        scope: SCOPE,
        dataClass: 'settings',
        key: 'kv:z',
        op: 'put',
        value: 7,
        hlc: { wall: 7, counter: 0, node: 'dev-2:ctx' },
      },
      requiredBlobHashes: [],
      firstDeferredAt: 0,
      attempts: 0,
    });
    const engine = t.makeEngine({ sources: [source], tick });

    const result = await engine.runCycle();

    expect(result.failed).toEqual([]);
    expect(source.remoteApplied.map((r) => r.key)).toEqual(['kv:z']);
    expect(await t.store.listAllDeferred()).toEqual([]);
  });

  it('reports waitingFor for pending keys whose target connection is in backoff', async () => {
    const t = await harness();
    await t.setDirectory({ 'binding:lang:en': t.connection.connectionId });
    const source = new FakeSource('settings', SCOPE);
    t.provider.failNext(1, 'network');
    const engine = t.makeEngine({ sources: [source], tick });
    await engine.runCycle();
    source.pushKey('kv:x', 'put', 1);

    const result = await engine.runCycle();

    expect(result.failed).toHaveLength(1);
    expect(result.waitingScopes).toEqual([SCOPE]);
    expect(result.waitingFor[SCOPE]).toBe(t.connection.connectionId);
  });
});
