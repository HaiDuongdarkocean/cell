import 'fake-indexeddb/auto';
import {
  awaitSyncTx,
  closeSyncDB,
  deleteSyncDB,
  getSyncDB,
  sequenceKey,
  SYNC_STORES,
} from '../adapters/local/syncDb';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import type {
  ChangeRecord,
  Connection,
  DataClass,
  PendingKey,
  RecordKey,
  Scope,
} from '../domain/types';
import type { ApplyResult, LocalSource } from '../ports/localSource';
import { ProviderError } from '../ports/storageProvider';
import { CycleLockLostError } from './cycleLock';
import { runConnectionPush } from './pushCycle';
import type { ConnectionPushDeps } from './pushCycle';
import { BLOBS_PREFIX, journalPath, scopeDevicePrefix, snapshotPath } from './remotePaths';
import { createSyncDbStore } from './syncDbStore';
import type { SyncStore } from './syncStore';
import { decodeJournal, decodeSnapshot, encodeJournal } from './wireCodec';

const DEVICE = 'dev-1';
const PROVIDER_ID = 'mem';
const GLOBAL: Scope = 'global';
const PROFILE_EN: Scope = 'profile:en';

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
          value: key.op === 'put' ? this.values.get(key.key) ?? { k: key.key } : undefined,
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

  async applyRemote(): Promise<ApplyResult> {
    return { applied: [], localWon: [], opaque: [] };
  }
}

interface Harness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  store: SyncStore;
  blobs: Map<string, Blob>;
  deps(overrides?: Partial<ConnectionPushDeps>): ConnectionPushDeps;
  remotePaths(prefix?: string): Promise<string[]>;
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
  const blobs = new Map<string, Blob>();
  const deps = (overrides: Partial<ConnectionPushDeps> = {}): ConnectionPushDeps => ({
    provider,
    connection,
    kv,
    store,
    sources: [],
    blobs: { read: async (hash) => blobs.get(hash) ?? null },
    deviceId: DEVICE,
    cycleId: 'cycle-1',
    clock,
    fence: async () => undefined,
    ...overrides,
  });
  return {
    provider,
    connection,
    kv,
    clock,
    store,
    blobs,
    deps,
    remotePaths: async (prefix = 'cell-sync/v1/') =>
      (await provider.list(connection, prefix)).map((e) => e.path).sort(),
  };
}

const pending = (entries: [Scope, PendingKey[]][]): Map<Scope, PendingKey[]> =>
  new Map(entries);

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('runConnectionPush commit protocol', () => {
  it('freezes, writes journal at the spec path, acks and deletes the batch', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/theme', 'put', 'dark');
    const result = await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );

    expect(result.outcomes).toEqual([{ scope: GLOBAL, journalSeq: 1, ackedKeys: 1 }]);
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
    const journal = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 1)),
    );
    expect(journal).toMatchObject({
      formatVersion: 1,
      kind: 'journal',
      scope: GLOBAL,
      deviceId: DEVICE,
      seq: 1,
    });
    expect(journal.records).toHaveLength(1);
    expect(journal.records[0]).toMatchObject({
      scope: GLOBAL,
      dataClass: 'settings',
      key: 'kv:settings/theme',
      op: 'put',
      value: 'dark',
    });
    expect(source.acked.map((k) => k.key)).toEqual(['kv:settings/theme']);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
  });

  it('allocates monotonically increasing seq across pushes', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    await runConnectionPush(t.deps({ sources: [source] }), pending([[GLOBAL, source.keys]]));
    source.pushKey('kv:settings/b', 'put', 2);
    await runConnectionPush(t.deps({ sources: [source] }), pending([[GLOBAL, source.keys]]));
    expect(await t.remotePaths()).toEqual([
      journalPath(GLOBAL, DEVICE, 1),
      journalPath(GLOBAL, DEVICE, 2),
    ]);
  });

  it('re-uploads a durable pending batch before collecting new keys', async () => {
    const t = await harness();
    const oldRecord: ChangeRecord = {
      scope: GLOBAL,
      dataClass: 'settings',
      key: 'kv:settings/old',
      op: 'put',
      value: 'frozen-value',
      hlc: { wall: 5, counter: 0, node: `${DEVICE}:ctx` },
    };
    await t.store.freezeBatch({
      connectionId: t.connection.connectionId,
      scope: GLOBAL,
      records: [oldRecord],
      cycleId: 'crashed-cycle',
      createdAt: 1,
    });

    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/new', 'put', 'fresh');
    const writeSpy = jest.spyOn(t.provider, 'write');
    const result = await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );

    expect(await t.remotePaths()).toEqual([
      journalPath(GLOBAL, DEVICE, 1),
      journalPath(GLOBAL, DEVICE, 2),
    ]);
    const first = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 1)),
    );
    expect(first.records[0]?.value).toBe('frozen-value');
    expect(first.records[0]?.hlc.wall).toBe(5);
    const second = await decodeJournal(
      await t.provider.read(t.connection, journalPath(GLOBAL, DEVICE, 2)),
    );
    expect(second.records[0]?.key).toBe('kv:settings/new');
    expect(writeSpy.mock.invocationCallOrder).toHaveLength(2);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
    expect(source.acked.map((k) => k.key)).toEqual(['kv:settings/old', 'kv:settings/new']);
    expect(result.outcomes.map((o) => o.journalSeq)).toEqual([1, 2]);
  });

  it('acks keys that resolve to nothing without freezing a batch', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:gone', 'put', 1);
    source.resolve = async () => [];
    const result = await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );
    expect(result.outcomes).toEqual([{ scope: GLOBAL, ackedKeys: 1 }]);
    expect(await t.remotePaths()).toEqual([]);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
  });

  it('stamps kv meta only for kv-class records after freeze', async () => {
    const t = await harness();
    const kvSource = new FakeSource('settings', GLOBAL);
    kvSource.pushKey('kv:settings/theme', 'put', 'dark');
    const idbSource = new FakeSource('srsCard', GLOBAL);
    idbSource.pushKey('cards:c1', 'put', { id: 'c1' });
    const stamped: ChangeRecord[][] = [];
    await runConnectionPush(
      t.deps({
        sources: [kvSource, idbSource],
        stampKvMeta: async (records) => {
          stamped.push([...records]);
        },
      }),
      pending([[GLOBAL, [...kvSource.keys, ...idbSource.keys]]]),
    );
    expect(stamped).toHaveLength(1);
    expect(stamped[0]!.map((r) => r.key)).toEqual(['kv:settings/theme']);
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
  });
});

describe('blob upload and verify ordering', () => {
  it('uploads blobs/<hash> and list-verifies it before the journal write', async () => {
    const t = await harness();
    const source = new FakeSource('dictResource', PROFILE_EN);
    source.pushKey('resource:abc123', 'put', { contentHash: 'abc123', name: 'd' });
    t.blobs.set('abc123', new Blob(['blob-bytes']));
    const writeSpy = jest.spyOn(t.provider, 'write');
    const listSpy = jest.spyOn(t.provider, 'list');

    await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[PROFILE_EN, source.keys]]),
    );

    const writes = writeSpy.mock.calls.map(([, path]) => path);
    expect(writes).toEqual([
      `${BLOBS_PREFIX}abc123`,
      journalPath(PROFILE_EN, DEVICE, 1),
    ]);
    const blobWriteOrder = writeSpy.mock.invocationCallOrder[0]!;
    const journalWriteOrder = writeSpy.mock.invocationCallOrder[1]!;
    const blobListOrders = listSpy.mock.calls
      .map(([, prefix], i) => ({ prefix, order: listSpy.mock.invocationCallOrder[i]! }))
      .filter((entry) => entry.prefix === BLOBS_PREFIX)
      .map((entry) => entry.order);
    const verifyListOrder = Math.max(...blobListOrders);
    expect(blobListOrders.length).toBeGreaterThanOrEqual(2);
    expect(blobListOrders[0]).toBeLessThan(blobWriteOrder);
    expect(blobWriteOrder).toBeLessThan(verifyListOrder);
    expect(verifyListOrder).toBeLessThan(journalWriteOrder);
    const blobEntry = (await t.provider.list(t.connection, BLOBS_PREFIX))[0];
    expect(blobEntry?.path).toBe(`${BLOBS_PREFIX}abc123`);
  });

  it('refuses to publish a journal when a referenced blob is unavailable', async () => {
    const t = await harness();
    const source = new FakeSource('dictResource', PROFILE_EN);
    source.pushKey('resource:missing', 'put', { contentHash: 'missing' });
    const result = await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[PROFILE_EN, source.keys]]),
    );
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.error).toContain('missing');
    expect(result.outcomes[0]?.journalSeq).toBeUndefined();
    expect(await t.remotePaths()).toEqual([]);
    const batches = await t.store.pendingBatches(t.connection.connectionId);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.seq).toBe(1);
    expect(source.acked).toEqual([]);
  });

  it('skips uploading a blob the remote already holds', async () => {
    const t = await harness();
    await t.provider.write(t.connection, `${BLOBS_PREFIX}h9`, new Blob(['old']));
    const writeSpy = jest.spyOn(t.provider, 'write');
    const source = new FakeSource('dictResource', PROFILE_EN);
    source.pushKey('resource:h9', 'put', { contentHash: 'h9' });
    await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[PROFILE_EN, source.keys]]),
    );
    expect(writeSpy.mock.calls.map(([, p]) => p)).toEqual([
      journalPath(PROFILE_EN, DEVICE, 1),
    ]);
    expect(await t.remotePaths()).toEqual([
      `${BLOBS_PREFIX}h9`,
      journalPath(PROFILE_EN, DEVICE, 1),
    ]);
  });
});

describe('fencing', () => {
  it('aborts before any remote write when the fence fails at first check', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    await expect(
      runConnectionPush(
        t.deps({
          sources: [source],
          fence: async () => {
            throw new CycleLockLostError();
          },
        }),
        pending([[GLOBAL, source.keys]]),
      ),
    ).rejects.toBeInstanceOf(CycleLockLostError);
    expect(await t.remotePaths()).toEqual([]);
    expect(source.acked).toEqual([]);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toHaveLength(1);
  });

  it('keeps the durable batch and skips the ack when the lock is lost between write and ack', async () => {
    const t = await harness();
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/a', 'put', 1);
    let calls = 0;
    const fence = async () => {
      calls += 1;
      if (calls >= 2) throw new CycleLockLostError();
    };
    await expect(
      runConnectionPush(
        t.deps({ sources: [source], fence }),
        pending([[GLOBAL, source.keys]]),
      ),
    ).rejects.toBeInstanceOf(CycleLockLostError);
    expect(await t.remotePaths()).toEqual([journalPath(GLOBAL, DEVICE, 1)]);
    expect(source.acked).toEqual([]);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toHaveLength(1);

    const rerun = await runConnectionPush(t.deps({ sources: [source] }), new Map());
    expect(rerun.outcomes[0]).toMatchObject({ scope: GLOBAL, journalSeq: 1 });
    expect(t.provider.countCopies(t.connection, journalPath(GLOBAL, DEVICE, 1))).toBe(1);
    expect(source.acked.map((k) => k.key)).toEqual(['kv:settings/a']);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toEqual([]);
  });
});

describe('compaction', () => {
  const rec = (
    key: string,
    wall: number,
    op: 'put' | 'delete' = 'put',
    value?: unknown,
  ): ChangeRecord => ({
    scope: GLOBAL,
    dataClass: 'settings',
    key,
    op,
    value: op === 'put' ? value ?? wall : undefined,
    hlc: { wall, counter: 0, node: `${DEVICE}:ctx` },
  });

  const seedJournals = async (
    t: Harness,
    scope: Scope,
    count: number,
    recordOf: (i: number) => ChangeRecord,
  ): Promise<void> => {
    for (let seq = 1; seq <= count; seq += 1) {
      await t.provider.write(
        t.connection,
        journalPath(scope, DEVICE, seq),
        encodeJournal({ scope, deviceId: DEVICE, seq, records: [recordOf(seq)] }),
      );
    }
    const db = await getSyncDB();
    const tx = db.transaction(SYNC_STORES.SEQUENCES, 'readwrite');
    tx.objectStore(SYNC_STORES.SEQUENCES).put({
      key: sequenceKey(t.connection.connectionId, scope),
      nextSeq: count + 1,
      nextSnapshotN: 1,
    });
    await awaitSyncTx(tx);
  };

  it('leaves journals untouched at exactly the threshold', async () => {
    const t = await harness();
    await seedJournals(t, GLOBAL, 49, (i) => rec(`kv:settings/k${i}`, i));
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/new', 'put', 'x');
    await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );
    const paths = await t.remotePaths(scopeDevicePrefix(GLOBAL, DEVICE));
    expect(paths).toHaveLength(50);
    expect(paths.every((p) => p.includes('journal-'))).toBe(true);
  });

  it('compacts to one snapshot and removes journals at coversSeq', async () => {
    const t = await harness();
    await seedJournals(t, GLOBAL, 51, (i) => rec(`kv:settings/k${i % 3}`, i, 'put', `v${i}`));
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/last', 'put', 'z');
    const result = await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );
    expect(result.outcomes[0]).toMatchObject({
      scope: GLOBAL,
      journalSeq: 52,
      snapshotN: 1,
      coversSeq: 52,
    });
    const paths = await t.remotePaths(scopeDevicePrefix(GLOBAL, DEVICE));
    expect(paths).toEqual([snapshotPath(GLOBAL, DEVICE, 1)]);
    const snap = await decodeSnapshot(
      await t.provider.read(t.connection, snapshotPath(GLOBAL, DEVICE, 1)),
    );
    expect(snap).toMatchObject({
      kind: 'snapshot',
      formatVersion: 1,
      n: 1,
      coversSeq: 52,
      scope: GLOBAL,
      deviceId: DEVICE,
    });
    const byKey = new Map(snap.records.map((r) => [r.key, r]));
    expect(byKey.get('kv:settings/k0')?.value).toBe('v51');
    expect(byKey.get('kv:settings/k1')?.value).toBe('v49');
    expect(byKey.get('kv:settings/last')?.value).toBe('z');
    expect(snap.records).toHaveLength(4);
  });

  it('keeps tombstones in the compacted snapshot', async () => {
    const t = await harness();
    await seedJournals(t, GLOBAL, 51, (i) =>
      i === 51 ? rec('kv:settings/dead', i, 'delete') : rec('kv:settings/dead', i, 'put', i),
    );
    const source = new FakeSource('settings', GLOBAL);
    source.pushKey('kv:settings/x', 'put', 1);
    await runConnectionPush(
      t.deps({ sources: [source] }),
      pending([[GLOBAL, source.keys]]),
    );
    const snap = await decodeSnapshot(
      await t.provider.read(t.connection, snapshotPath(GLOBAL, DEVICE, 1)),
    );
    const dead = snap.records.find((r) => r.key === 'kv:settings/dead');
    expect(dead?.op).toBe('delete');
    expect(dead?.hlc.wall).toBe(51);
  });

  it('keeps a pending batch and publishes no snapshot when its upload fails', async () => {
    const t = await harness();
    await seedJournals(t, GLOBAL, 51, (i) => rec(`kv:settings/k${i}`, i));
    await t.store.freezeBatch({
      connectionId: t.connection.connectionId,
      scope: GLOBAL,
      records: [rec('kv:settings/held', 100)],
      cycleId: 'crashed',
      createdAt: 1,
    });
    t.provider.failNext(1, 'network');
    await expect(
      runConnectionPush(t.deps(), new Map()),
    ).rejects.toBeInstanceOf(ProviderError);
    const paths = await t.remotePaths(scopeDevicePrefix(GLOBAL, DEVICE));
    expect(paths.every((p) => p.includes('journal-'))).toBe(true);
    expect(paths).toHaveLength(51);
    expect(await t.store.pendingBatches(t.connection.connectionId)).toHaveLength(1);
  });
});
