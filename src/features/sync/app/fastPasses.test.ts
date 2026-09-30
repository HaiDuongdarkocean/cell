import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DeterministicIdSource } from '../adapters/memory/DeterministicIdSource';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { createFakeDrive } from '../adapters/google-drive/fakeDrive';
import { GoogleDriveStorageProvider } from '../adapters/google-drive/googleDriveStorageProvider';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import { connectionId } from '../domain/scope';
import type {
  ChangeRecord,
  Connection,
  DataClass,
  PendingKey,
  RecordKey,
  Scope,
} from '../domain/types';
import type { ApplyResult, LocalSource } from '../ports/localSource';
import type { StorageProvider } from '../ports/storageProvider';
import { journalPath } from './remotePaths';
import { SyncEngine } from './SyncEngine';
import type { CycleResult, EngineStatus, SyncEngineDeps } from './SyncEngine';
import { createSyncDbStore } from './syncDbStore';
import type { SyncStore } from './syncStore';
import { encodeJournal } from './wireCodec';

const DEVICE = 'dev-1';
const GLOBAL: Scope = 'global';
const MEM_ID = 'mem';
const DRIVE_ID = 'google-drive';

class FakeSource implements LocalSource {
  keys: PendingKey[] = [];
  acked: PendingKey[] = [];
  remoteApplied: ChangeRecord[] = [];
  private wall = 0;

  constructor(
    readonly dataClass: DataClass,
    private readonly scope: Scope,
  ) {}

  pushKey(key: string, op: 'put' | 'delete' = 'put'): void {
    this.keys.push({ scope: this.scope, dataClass: this.dataClass, key, op });
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
          value: key.op === 'put' ? { k: key.key } : undefined,
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

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    const mine = records.filter(
      (r) => r.scope === this.scope && r.dataClass === this.dataClass,
    );
    this.remoteApplied.push(...mine);
    return { applied: mine, localWon: [], opaque: [] };
  }
}

const peerRecord = (key: string): ChangeRecord => ({
  scope: GLOBAL,
  dataClass: 'settings',
  key,
  op: 'put',
  value: { k: key },
  hlc: { wall: 50, counter: 0, node: 'peer-1:ctx' },
});

interface MemHarness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  store: SyncStore;
  statuses: EngineStatus[];
  applied: { dataClasses: DataClass[]; scopes: Scope[] }[];
  makeEngine(overrides?: Partial<SyncEngineDeps>): SyncEngine;
}

async function memHarness(provider?: StorageProvider): Promise<MemHarness> {
  const mem = provider ?? new InMemoryStorageProvider({ providerId: MEM_ID });
  const account = await mem.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `${mem.providerId}:${account.accountKey}` as Connection['connectionId'],
    providerId: mem.providerId,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const kv = new InMemoryKeyValueStore();
  const store = createSyncDbStore();
  const statuses: EngineStatus[] = [];
  const applied: { dataClasses: DataClass[]; scopes: Scope[] }[] = [];
  await kv.set('local', 'syncState', {
    deviceId: DEVICE,
    systemConnection: connection.connectionId,
    [`connection:${connection.connectionId}`]: {
      providerId: mem.providerId,
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
      providerFor: () => mem,
      connections: async () => [connection],
      deviceId: async () => DEVICE,
      clock: new SeededClock(1000),
      ids: new DeterministicIdSource(),
      lock: { schedule: () => () => undefined },
      localScopes: async () => [GLOBAL],
      onApplied: (payload) => {
        applied.push({ dataClasses: [...payload.dataClasses], scopes: [...payload.scopes] });
      },
      ...overrides,
    });
    engine.subscribe((status) => statuses.push(status));
    return engine;
  };
  return {
    provider: mem as InMemoryStorageProvider,
    connection,
    kv,
    store,
    statuses,
    applied,
    makeEngine,
  };
}

interface DriveHarness {
  provider: GoogleDriveStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  drive: ReturnType<typeof createFakeDrive>;
  store: SyncStore;
  makeEngine(overrides?: Partial<SyncEngineDeps>): SyncEngine;
}

async function driveHarness(): Promise<DriveHarness & { statuses: EngineStatus[] }> {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'fast-passes-test',
    launchWebAuthFlow: drive.launchWebAuthFlow,
    getRedirectUrl: () => 'https://fakeext.chromiumapp.org/',
    fetchFn: drive.fetchFn,
    clock: new SeededClock(1_700_000_000_000),
    sleep: async () => {},
  });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: connectionId(provider.providerId, account.accountKey),
    providerId: provider.providerId,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const store = createSyncDbStore();
  const statuses: EngineStatus[] = [];
  await kv.set('local', 'syncState', {
    deviceId: DEVICE,
    systemConnection: connection.connectionId,
    [`connection:${connection.connectionId}`]: {
      providerId: DRIVE_ID,
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
      clock: new SeededClock(1000),
      ids: new DeterministicIdSource(),
      lock: { schedule: () => () => undefined },
      localScopes: async () => [GLOBAL],
      ...overrides,
    });
    engine.subscribe((status) => statuses.push(status));
    return engine;
  };
  return { provider, connection, kv, drive, store, statuses, makeEngine };
}

const driveApiRequests = (drive: ReturnType<typeof createFakeDrive>) =>
  drive.requests.filter(
    (r) => r.url.includes('/drive/v3/') || r.url.includes('/upload/drive/v3/'),
  );

const seenKey = (connId: Connection['connectionId']) => `syncBellSeen:${connId}`;

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('runPush', () => {
  it('SC-3: no pending keys and no frozen batches → zero provider calls, no status change', async () => {
    const t = await memHarness();
    const listSpy = jest.spyOn(t.provider, 'list');
    const readSpy = jest.spyOn(t.provider, 'read');
    const writeSpy = jest.spyOn(t.provider, 'write');
    const engine = t.makeEngine();
    const result = await engine.runPush();
    expect(result.acquired).toBe(true);
    expect(result.scopesPushed).toEqual([]);
    expect(listSpy).not.toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(t.statuses).toEqual([]);
  });

  it('pushes a journal and rings the bell; the first check stamps seen, the next skips', async () => {
    const t = await memHarness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/theme');
    const engine = t.makeEngine({ sources: [source] });
    const result = await engine.runPush();
    expect(result.scopesPushed).toEqual([GLOBAL]);
    expect(result.ackedKeys).toBe(1);
    expect(await t.provider.signal!.peek(t.connection)).not.toBeNull();

    const first = await engine.checkRemote();
    expect(first.failed).toEqual([]);
    expect(
      await t.kv.get('session', seenKey(t.connection.connectionId)),
    ).toBe(await t.provider.signal!.peek(t.connection));

    const before = t.statuses.length;
    const check = await engine.checkRemote();
    expect(check.scopesPulled).toEqual([]);
    expect(t.statuses.length).toBe(before);
  });

  it('SC-4: second single-scope runPush on google-drive = bell get + journal create + bell update, zero files.list', async () => {
    const t = await driveHarness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    const engine = t.makeEngine({ sources: [source] });
    await engine.runPush();

    t.drive.requests.length = 0;
    source.pushKey('k2');
    await engine.runPush();

    const api = driveApiRequests(t.drive);
    expect(api).toHaveLength(3);
    const summary = api.map((r) => `${r.method} ${decodeURIComponent(r.url)}`);
    expect(
      summary.some((s) => s.startsWith('GET') && s.includes('files/') && s.includes('version')),
    ).toBe(true);
    expect(
      summary.some((s) => s.startsWith('POST') && s.includes('uploadType=multipart')),
    ).toBe(true);
    expect(
      summary.some((s) => s.startsWith('PATCH') && s.includes('uploadType=media')),
    ).toBe(true);
    expect(api.some((r) => r.method === 'GET' && decodeURIComponent(r.url).endsWith('/files'))).toBe(
      false,
    );
  });
});

describe('checkRemote', () => {
  it('SC-7: unchanged bell → exactly 1 Drive request and no status change', async () => {
    const t = await driveHarness();
    const token = await t.provider.signal!.ring(t.connection);
    await t.kv.set('session', seenKey(t.connection.connectionId), token);
    const engine = t.makeEngine();
    t.drive.requests.length = 0;
    const result = await engine.checkRemote();
    expect(result.acquired).toBe(true);
    expect(result.scopesPulled).toEqual([]);
    expect(driveApiRequests(t.drive)).toHaveLength(1);
    expect(t.statuses).toEqual([]);
  });

  it('SC-8: changed bell pulls peer journals, touches no markers/blobs, updates seen', async () => {
    const t = await driveHarness();
    const source = new FakeSource('settings', GLOBAL);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, 'peer-1', 1),
      encodeJournal({
        scope: GLOBAL,
        deviceId: 'peer-1',
        seq: 1,
        records: [peerRecord('kv:settings/accent')],
      }),
    );
    await t.provider.signal!.ring(t.connection);
    const engine = t.makeEngine({ sources: [source] });

    t.drive.requests.length = 0;
    const result = await engine.checkRemote();

    expect(result.scopesPulled).toEqual([GLOBAL]);
    expect(result.appliedDataClasses).toEqual(['settings']);
    expect(source.remoteApplied.map((r) => r.key)).toEqual(['kv:settings/accent']);
    const urls = driveApiRequests(t.drive).map((r) => decodeURIComponent(r.url));
    expect(urls.some((u) => u.includes('blobs'))).toBe(false);
    expect(urls.some((u) => u.includes('routes'))).toBe(false);
    expect(urls.some((u) => u.includes('disconnect'))).toBe(false);
    const token = await t.provider.signal!.peek(t.connection);
    expect(await t.kv.get('session', seenKey(t.connection.connectionId))).toBe(token);
  });

  it('SC-9: changed bell with no peer files retries once and keeps the bell pending instead of stamping seen', async () => {
    const t = await memHarness();
    await t.provider.signal!.ring(t.connection);
    const sleeps: number[] = [];
    const listSpy = jest.spyOn(t.provider, 'list');
    const engine = t.makeEngine({
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      checkRetryDelayMs: 2000,
    });
    const result = await engine.checkRemote();
    expect(sleeps).toEqual([2000]);
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(
      await t.kv.get('session', seenKey(t.connection.connectionId)),
    ).toBeUndefined();
    expect(result.failed).toEqual([]);

    const second = await engine.checkRemote();
    expect(listSpy).toHaveBeenCalledTimes(4);
    expect(second.failed).toEqual([]);
  });

  it('a pending bell is consumed once the peer journal becomes visible, then seen is stamped', async () => {
    const t = await memHarness();
    const source = new FakeSource('settings', GLOBAL);
    await t.provider.signal!.ring(t.connection);
    const engine = t.makeEngine({
      sources: [source],
      sleep: async () => {},
    });

    await engine.checkRemote();
    expect(
      await t.kv.get('session', seenKey(t.connection.connectionId)),
    ).toBeUndefined();
    expect(source.remoteApplied).toEqual([]);

    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, 'peer-1', 1),
      encodeJournal({
        scope: GLOBAL,
        deviceId: 'peer-1',
        seq: 1,
        records: [peerRecord('kv:settings/late')],
      }),
    );

    const result = await engine.checkRemote();
    expect(result.scopesPulled).toEqual([GLOBAL]);
    expect(source.remoteApplied.map((r) => r.key)).toEqual(['kv:settings/late']);
    expect(
      await t.kv.get('session', seenKey(t.connection.connectionId)),
    ).toBe(await t.provider.signal!.peek(t.connection));

    const listSpy = jest.spyOn(t.provider, 'list');
    const third = await engine.checkRemote();
    expect(third.scopesPulled).toEqual([]);
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('a bell whose pull never yields files converges after the pending cap', async () => {
    const t = await memHarness();
    await t.provider.signal!.ring(t.connection);
    const v = await t.provider.signal!.peek(t.connection);
    await t.kv.set('session', `syncBellPending:${t.connection.connectionId}`, {
      v,
      n: 15,
    });
    const engine = t.makeEngine({ sleep: async () => {} });
    const result = await engine.checkRemote();
    expect(result.failed).toEqual([]);
    expect(await t.kv.get('session', seenKey(t.connection.connectionId))).toBe(v);
  });

  it('SC-10: after own push with established seen, checkRemote on google-drive issues exactly 1 request', async () => {
    const t = await driveHarness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    const engine = t.makeEngine({ sources: [source] });
    await engine.runPush();
    await engine.checkRemote();
    source.pushKey('k2');
    await engine.runPush();
    t.drive.requests.length = 0;
    const result = await engine.checkRemote();
    expect(result.scopesPulled).toEqual([]);
    expect(driveApiRequests(t.drive)).toHaveLength(1);
  });

  it('a bell peek failure backs off the connection and leaves seen unchanged', async () => {
    const t = await memHarness();
    t.provider.failNext(1, 'network');
    const engine = t.makeEngine();
    const result = await engine.checkRemote();
    expect(result.failed).toHaveLength(1);
    expect(await t.kv.get('session', seenKey(t.connection.connectionId))).toBeUndefined();
  });

  it('providers without signal make checkRemote a no-op', async () => {
    const inner = new InMemoryStorageProvider({ providerId: MEM_ID });
    const bare = new Proxy(inner, {
      get: (target, prop, receiver) =>
        prop === 'signal' ? undefined : Reflect.get(target, prop, receiver),
    });
    const t = await memHarness(bare);
    const engine = t.makeEngine();
    const result = await engine.checkRemote();
    expect(result.acquired).toBe(true);
    expect(result.scopesPulled).toEqual([]);
    expect(t.statuses).toEqual([]);
  });
});

describe('pass queue', () => {
  it('SC-15: a full pass queued behind a push absorbs queued check waiters', async () => {
    const t = await memHarness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let pendingCalls = 0;
    const gated = new (class extends FakeSource {
      async pending(limit: number): Promise<PendingKey[]> {
        pendingCalls += 1;
        if (pendingCalls === 1) await gate;
        return super.pending(limit);
      }
    })('settings', GLOBAL);
    gated.keys = source.keys;
    const engine = t.makeEngine({ sources: [gated] });

    const pushPromise = engine.runPush();
    const fullPromise = engine.runCycle();
    const checkPromise = engine.checkRemote();
    releaseFirst();
    const [push, full, check]: CycleResult[] = await Promise.all([
      pushPromise,
      fullPromise,
      checkPromise,
    ]);
    expect(push.acquired).toBe(true);
    expect(full.acquired).toBe(true);
    expect(check).toBe(full);
  });

  it('queued passes of the same kind dedupe to one run', async () => {
    const t = await memHarness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    const engine = t.makeEngine({ sources: [source] });
    const [a, b, c] = await Promise.all([
      engine.runPush(),
      engine.runPush(),
      engine.runPush(),
    ]);
    expect(b).toBe(c);
    expect(a).not.toBe(b);

    const peekSpy = jest.spyOn(t.provider.signal!, 'peek');
    const [x, y, z] = await Promise.all([
      engine.checkRemote(),
      engine.checkRemote(),
      engine.checkRemote(),
    ]);
    expect(y).toBe(z);
    expect(x).not.toBe(y);
    expect(peekSpy).toHaveBeenCalledTimes(2);
  });
});
