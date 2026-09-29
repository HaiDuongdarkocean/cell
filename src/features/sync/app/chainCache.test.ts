import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { createFakeDrive } from '../adapters/google-drive/fakeDrive';
import { GoogleDriveStorageProvider } from '../adapters/google-drive/googleDriveStorageProvider';
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
import { runConnectionPush } from './pushCycle';
import type { ConnectionPushDeps } from './pushCycle';
import { journalPath, snapshotPath } from './remotePaths';
import { createSyncDbStore } from './syncDbStore';
import type { SyncStore } from './syncStore';

const DEVICE = 'dev-1';
const PROVIDER_ID = 'mem';
const GLOBAL: Scope = 'global';

class FakeSource implements LocalSource {
  keys: PendingKey[] = [];
  acked: PendingKey[] = [];
  stamped: ChangeRecord[] = [];
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

  async stampCommitted(records: readonly ChangeRecord[]): Promise<void> {
    this.stamped.push(...records);
  }

  async *snapshot(): AsyncIterable<ChangeRecord> {}

  async current(): Promise<Map<RecordKey, ChangeRecord | null>> {
    return new Map();
  }

  async applyRemote(): Promise<ApplyResult> {
    return { applied: [], localWon: [], opaque: [] };
  }
}

interface Harness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  store: SyncStore;
  deps(overrides?: Partial<ConnectionPushDeps>): ConnectionPushDeps;
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
  const deps = (overrides: Partial<ConnectionPushDeps> = {}): ConnectionPushDeps => ({
    provider,
    connection,
    kv,
    store,
    sources: [],
    blobs: { read: async () => null },
    deviceId: DEVICE,
    cycleId: 'cycle-1',
    clock,
    fence: async () => undefined,
    ...overrides,
  });
  return { provider, connection, store, deps };
}

const pending = (source: FakeSource): Map<Scope, PendingKey[]> =>
  new Map([[GLOBAL, source.keys]]);

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('chainCache fast push', () => {
  it('SC-4 mechanics: a second push with a warm chainCache makes zero provider.list calls', async () => {
    const t = await harness();
    const chainCache = new Map<string, { journalCount: number }>();
    const listSpy = jest.spyOn(t.provider, 'list');
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    await runConnectionPush(t.deps({ sources: [source], chainCache }), pending(source));
    expect(listSpy).toHaveBeenCalledTimes(1);

    listSpy.mockClear();
    source.pushKey('k2');
    await runConnectionPush(t.deps({ sources: [source], chainCache }), pending(source));
    expect(listSpy).not.toHaveBeenCalled();
    expect(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 2)),
    ).toBeDefined();
  });

  it('journal writes on google-drive are fresh: warm push = 1 Drive request, zero files.list', async () => {
    const kv = new InMemoryKeyValueStore();
    const drive = createFakeDrive();
    const provider = new GoogleDriveStorageProvider({
      kv,
      clientId: 'chain-cache-test',
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
    const chainCache = new Map<string, { journalCount: number }>();
    const deps = (source: FakeSource): ConnectionPushDeps => ({
      provider,
      connection,
      kv,
      store,
      sources: [source],
      blobs: { read: async () => null },
      deviceId: DEVICE,
      cycleId: 'cycle-1',
      clock: new SeededClock(1000),
      fence: async () => undefined,
      chainCache,
    });
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    await runConnectionPush(deps(source), pending(source));

    drive.requests.length = 0;
    source.pushKey('k2');
    await runConnectionPush(deps(source), pending(source));

    const api = drive.requests.filter(
      (r) => r.url.includes('/drive/v3/') || r.url.includes('/upload/drive/v3/'),
    );
    expect(api).toHaveLength(1);
    expect(api[0]!.method).toBe('POST');
    expect(api[0]!.url).toContain('uploadType=multipart');
  });

  it('SC-5: exceeding the threshold compacts and resets the cached count', async () => {
    const t = await harness();
    const chainCache = new Map<string, { journalCount: number }>();
    const deps = (source: FakeSource): ConnectionPushDeps =>
      t.deps({ sources: [source], chainCache, journalCompactionThreshold: 2 });
    const source = new FakeSource('settings', GLOBAL);
    for (let i = 1; i <= 3; i += 1) {
      source.pushKey(`k${i}`);
      await runConnectionPush(deps(source), pending(source));
    }
    const entries = await t.provider.list(t.connection, 'cell-sync/v1/');
    const paths = entries.map((e) => e.path);
    expect(paths).toContain(snapshotPath(GLOBAL, DEVICE, 1));
    expect(paths.some((p) => p.includes('journal-'))).toBe(false);
    expect(chainCache.get(`${t.connection.connectionId}|${GLOBAL}`)?.journalCount).toBe(0);
  });

  it('SC-5: at or under the threshold the cache short-circuits without listing', async () => {
    const t = await harness();
    const chainCache = new Map<string, { journalCount: number }>();
    const listSpy = jest.spyOn(t.provider, 'list');
    const deps = (source: FakeSource): ConnectionPushDeps =>
      t.deps({ sources: [source], chainCache, journalCompactionThreshold: 3 });
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    await runConnectionPush(deps(source), pending(source));
    source.pushKey('k2');
    await runConnectionPush(deps(source), pending(source));
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 2)),
    ).toBeDefined();
  });

  it('a commit error drops the cache key so the next push re-heals', async () => {
    const t = await harness();
    const chainCache = new Map<string, { journalCount: number }>();
    const listSpy = jest.spyOn(t.provider, 'list');
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    await runConnectionPush(t.deps({ sources: [source], chainCache }), pending(source));

    t.provider.failNext(1, 'network');
    source.pushKey('k2');
    await expect(
      runConnectionPush(t.deps({ sources: [source], chainCache }), pending(source)),
    ).rejects.toThrow();
    expect(chainCache.size).toBe(0);

    const result = await runConnectionPush(
      t.deps({ sources: [source], chainCache }),
      pending(source),
    );
    expect(result.outcomes[0]!.journalSeq).toBe(2);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('SC-6: without a chainCache every push keeps the old heal + compaction listing', async () => {
    const t = await harness();
    const listSpy = jest.spyOn(t.provider, 'list');
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('k1');
    await runConnectionPush(t.deps({ sources: [source] }), pending(source));
    source.pushKey('k2');
    await runConnectionPush(t.deps({ sources: [source] }), pending(source));
    expect(listSpy).toHaveBeenCalledTimes(4);
  });
});
