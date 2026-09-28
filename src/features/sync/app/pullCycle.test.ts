import 'fake-indexeddb/auto';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import type {
  ChangeRecord,
  Connection,
  ConnectionId,
  DataClass,
  Hlc,
  PendingKey,
  RecordKey,
  Scope,
} from '../domain/types';
import type { ApplyResult, LocalSource } from '../ports/localSource';
import { blobsNeededPath, blobPath, journalPath, snapshotPath } from './remotePaths';
import { DISCONNECT_MARKER_PATH } from './remotePaths';
import {
  DEFERRED_WARNING_CYCLES,
  runConnectionPull,
  type ConnectionPullDeps,
} from './pullCycle';
import { cursorKey, readCursors, SYNC_CURSORS_STORAGE_KEY } from './cursors';
import { getCheckpoint, writeCheckpoint, type SyncCheckpoint } from './checkpoints';
import { stampKvMeta } from '../adapters/local/kv/kvMeta';
import { createSyncDbStore } from './syncDbStore';
import { encodeJournal, encodeSnapshot } from './wireCodec';

const DEVICE = 'dev-1';
const REMOTE_DEVICE = 'dev-2';
const OTHER_DEVICE = 'dev-3';
const PROVIDER_ID = 'mem';
const GLOBAL: Scope = 'global';

class PullSource implements LocalSource {
  applied: ChangeRecord[] = [];
  opaquePolicy: 'none' | 'all' = 'none';
  opaqueKeys = new Set<RecordKey>();
  failNext = 0;

  constructor(
    readonly dataClass: DataClass,
    readonly scope: Scope,
  ) {}

  async pending(): Promise<PendingKey[]> {
    return [];
  }

  async resolve(): Promise<ChangeRecord[]> {
    return [];
  }

  async ack(): Promise<void> {}

  async stampCommitted(): Promise<void> {}

  async *snapshot(): AsyncIterable<ChangeRecord> {}

  async current(
    _scope: Scope,
    keys: RecordKey[],
  ): Promise<Map<RecordKey, ChangeRecord | null>> {
    return new Map(keys.map((k) => [k, null]));
  }

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('applyRemote failed');
    }
    const mine = records.filter(
      (r) => r.scope === this.scope && r.dataClass === this.dataClass,
    );
    const ready = mine.filter((r) => !this.opaqueKeys.has(r.key));
    const held = mine.filter((r) => this.opaqueKeys.has(r.key));
    this.applied.push(...ready);
    return {
      applied: ready,
      localWon: [],
      opaque: this.opaquePolicy === 'all' ? mine : held,
    };
  }
}

interface Harness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  store: ReturnType<typeof createSyncDbStore>;
  blobs: Map<string, Blob>;
  appliedLog: { dataClass: DataClass; key: string }[];
  routingRecords: ChangeRecord[];
  disconnected: ConnectionId[];
  makeDeps(overrides?: Partial<ConnectionPullDeps>): ConnectionPullDeps;
  pull(scopes: Scope[], overrides?: Partial<ConnectionPullDeps>): Promise<ReturnType<typeof runConnectionPull> extends Promise<infer R> ? R : never>;
}

function makeHlc(wall: number, node = `${REMOTE_DEVICE}:ctx`): Hlc {
  return { wall, counter: 0, node };
}

function makeRecord(
  scope: Scope,
  dataClass: DataClass,
  key: string,
  value: unknown,
  wall = 100,
): ChangeRecord {
  return { scope, dataClass, key, op: 'put', value, hlc: makeHlc(wall) };
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
  const routingRecords: ChangeRecord[] = [];
  const disconnected: ConnectionId[] = [];
  const appliedLog: { dataClass: DataClass; key: string }[] = [];

  const makeDeps = (overrides: Partial<ConnectionPullDeps> = {}): ConnectionPullDeps => ({
    provider,
    connection,
    kv,
    store,
    sources: [],
    blobs: { read: async (hash: string) => blobs.get(hash) ?? null },
    deviceId: DEVICE,
    clock,
    fence: async () => undefined,
    onRoutingChange: async (record) => {
      routingRecords.push(record);
    },
    onDisconnect: async (connectionId) => {
      disconnected.push(connectionId);
    },
    ...overrides,
  });

  return {
    provider,
    connection,
    kv,
    clock,
    store,
    blobs,
    appliedLog,
    routingRecords,
    disconnected,
    makeDeps,
    pull: (scopes, overrides) => runConnectionPull(makeDeps(overrides), scopes),
  };
}

async function writeJournal(
  t: Harness,
  scope: Scope,
  deviceId: string,
  seq: number,
  records: ChangeRecord[],
): Promise<void> {
  await t.provider.write(
    t.connection,
    journalPath(scope, deviceId, seq),
    encodeJournal({ scope, deviceId, seq, records }),
  );
}

async function writeSnapshot(
  t: Harness,
  scope: Scope,
  deviceId: string,
  n: number,
  coversSeq: number,
  records: ChangeRecord[],
): Promise<void> {
  await t.provider.write(
    t.connection,
    snapshotPath(scope, deviceId, n),
    encodeSnapshot({ scope, deviceId, n, coversSeq, records }),
  );
}

async function cursorOf(
  t: Harness,
  scope: Scope,
  deviceId = REMOTE_DEVICE,
): Promise<{ snapshotN: number; seq: number } | undefined> {
  const cursors = await readCursors(t.kv);
  return cursors[cursorKey(t.connection.connectionId, scope, deviceId)];
}

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('runConnectionPull', () => {
  it('consumes journals from other devices in seq order and advances the cursor', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/theme', 'dark', 10),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/theme', 'light', 20),
    ]);

    const result = await t.pull([GLOBAL], { sources: [source] });

    expect(result.disconnected).toBe(false);
    expect(source.applied.map((r) => r.value)).toEqual(['dark', 'light']);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 2 });
    expect(result.appliedScopes).toEqual([GLOBAL]);
    expect(result.appliedDataClasses).toEqual(['settings']);
    expect(result.outcomes[0]!.devices[0]!.filesRead).toBe(2);
  });

  it('skips files written by the local device', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/b', 2),
    ]);

    await t.pull([GLOBAL], { sources: [source] });

    expect(source.applied.map((r) => r.key)).toEqual(['kv:settings/b']);
    expect(await cursorOf(t, GLOBAL, DEVICE)).toBeUndefined();
  });

  it('does not re-consume files already covered by the cursor', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);

    await t.pull([GLOBAL], { sources: [source] });
    await t.pull([GLOBAL], { sources: [source] });

    expect(source.applied).toHaveLength(1);
  });

  it('waits at a journal gap instead of skipping past it', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await t.pull([GLOBAL], { sources: [source] });

    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 3, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/b', 'late', 30),
    ]);
    const gapped = await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual(['kv:settings/a']);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 1 });
    expect(
      gapped.outcomes[0]!.devices[0]!.warnings.some((w) =>
        w.includes('journal gap'),
      ),
    ).toBe(true);

    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/gap', 'filled', 20),
    ]);
    await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual([
      'kv:settings/a',
      'kv:settings/gap',
      'kv:settings/b',
    ]);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 3 });
  });

  it('stops consuming at an interior gap within a single pull', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 3, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/b', 'b', 30),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 5, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/c', 'c', 50),
    ]);

    const first = await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual(['kv:settings/a']);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 1 });
    expect(
      first.outcomes[0]!.devices[0]!.warnings.some((w) => w.includes('journal gap')),
    ).toBe(true);

    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/two', 2),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 4, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/four', 4),
    ]);
    await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual([
      'kv:settings/a',
      'kv:settings/two',
      'kv:settings/b',
      'kv:settings/four',
      'kv:settings/c',
    ]);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 5 });
  });

  it('jumps to the newest snapshot then consumes journals after coversSeq', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/old', 'stale'),
    ]);
    await writeSnapshot(t, GLOBAL, REMOTE_DEVICE, 1, 3, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 'snap', 30),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 4, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/b', 'after', 40),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 5, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/c', 'after2', 50),
    ]);

    const result = await t.pull([GLOBAL], { sources: [source] });

    expect(source.applied.map((r) => r.key)).toEqual([
      'kv:settings/a',
      'kv:settings/b',
      'kv:settings/c',
    ]);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 1, seq: 5 });
    expect(result.outcomes[0]!.devices[0]!.filesRead).toBe(3);
  });

  it('recovers when the cursor predates compaction: old journal gone, snapshot arrives', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await t.pull([GLOBAL], { sources: [source] });

    await t.provider.remove(t.connection, journalPath(GLOBAL, REMOTE_DEVICE, 1));
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 3, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/c', 30),
    ]);

    const gapped = await t.pull([GLOBAL], { sources: [source] });
    expect(
      gapped.outcomes[0]!.devices[0]!.warnings.some((w) => w.includes('journal gap')),
    ).toBe(true);
    expect(source.applied.map((r) => r.key)).toEqual(['kv:settings/a']);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 1 });

    await writeSnapshot(t, GLOBAL, REMOTE_DEVICE, 2, 5, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/full', 'snapshot', 60),
    ]);
    const recovered = await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual([
      'kv:settings/a',
      'kv:settings/full',
    ]);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 2, seq: 5 });
    expect(recovered.outcomes[0]!.devices[0]!.warnings).toEqual([]);
  });

  it('skips corrupt files with a warning and keeps consuming later files', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, REMOTE_DEVICE, 1),
      new Blob(['not gzip at all']),
    );
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/b', 'ok', 20),
    ]);

    const result = await t.pull([GLOBAL], { sources: [source] });

    expect(source.applied.map((r) => r.key)).toEqual(['kv:settings/b']);
    expect(result.outcomes[0]!.devices[0]!.warnings[0]).toContain('corrupt journal');
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 2 });
  });

  it('applies records in dependency order across data classes', async () => {
    const t = await harness();
    const order: string[] = [];
    const tracking = (dataClass: DataClass): PullSource => {
      const source = new PullSource(dataClass, 'profile:en');
      const base = source.applyRemote.bind(source);
      source.applyRemote = async (records) => {
        for (const r of records) order.push(`${r.dataClass}:${r.key}`);
        return base(records);
      };
      return source;
    };
    const sources = [tracking('readerBook'), tracking('srsDeck'), tracking('settings')];
    await writeJournal(t, 'profile:en', REMOTE_DEVICE, 1, [
      makeRecord('profile:en', 'readerBook', 'book:1', { title: 'B' }, 10),
      makeRecord('profile:en', 'settings', 'kv:x', 1, 11),
      makeRecord('profile:en', 'srsDeck', 'deck:d1', { name: 'D' }, 12),
    ]);

    await t.pull(['profile:en'], { sources });

    expect(order).toEqual(['settings:kv:x', 'srsDeck:deck:d1', 'readerBook:book:1']);
  });

  it('defers records whose blobs are missing and writes blobs-needed markers', async () => {
    const t = await harness();
    const source = new PullSource('dictResource', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:abc123', { name: 'JMdict' }, 10),
    ]);

    const result = await t.pull([GLOBAL], { sources: [source] });

    const deferred = await t.store.listDeferred(t.connection.connectionId);
    expect(deferred).toHaveLength(1);
    expect(deferred[0]!.requiredBlobHashes).toEqual(['abc123']);
    expect(deferred[0]!.sourcePath).toContain('journal-1');
    const paths = (await t.provider.list(t.connection, 'cell-sync/v1/meta/blobs-needed/')).map(
      (e) => e.path,
    );
    expect(paths).toEqual([blobsNeededPath('abc123')]);
    expect(source.applied).toHaveLength(0);
    expect(result.outcomes[0]!.devices[0]!.recordsDeferred).toBe(1);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 1 });
  });

  it('keeps applying later records after a blocked one', async () => {
    const t = await harness();
    const dict = new PullSource('dictResource', GLOBAL);
    const settings = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:missing', { name: 'X' }, 10),
      makeRecord(GLOBAL, 'settings', 'kv:settings/ok', 1, 11),
    ]);

    await t.pull([GLOBAL], { sources: [dict, settings] });

    expect(settings.applied).toHaveLength(1);
    expect(await t.store.listDeferred(t.connection.connectionId)).toHaveLength(1);
  });

  it('drains deferred records once the blob lands remotely and clears the marker', async () => {
    const t = await harness();
    const dict = new PullSource('dictResource', GLOBAL);
    const record = makeRecord(GLOBAL, 'dictResource', 'resource:abc', { name: 'JM' }, 10);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [record]);

    await t.pull([GLOBAL], { sources: [dict] });
    expect(await t.store.listDeferred(t.connection.connectionId)).toHaveLength(1);

    await t.provider.write(
      t.connection,
      blobPath('abc'),
      new Blob(['dict-bytes']),
    );
    const second = await t.pull([GLOBAL], { sources: [dict] });

    expect(dict.applied.map((r) => r.key)).toEqual(['resource:abc']);
    expect(await t.store.listDeferred(t.connection.connectionId)).toEqual([]);
    const markers = await t.provider.list(t.connection, 'cell-sync/v1/meta/blobs-needed/');
    expect(markers).toEqual([]);
    expect(second.appliedScopes).toContain(GLOBAL);
  });

  it('warns after a record stays blocked for the threshold number of cycles', async () => {
    const t = await harness();
    const dict = new PullSource('dictResource', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:gone', { name: 'X' }, 10),
    ]);

    await t.pull([GLOBAL], { sources: [dict] });
    for (let i = 0; i < DEFERRED_WARNING_CYCLES; i++) {
      const result = await t.pull([GLOBAL], { sources: [dict] });
      if (i === DEFERRED_WARNING_CYCLES - 1) {
        expect(result.warnings.some((w) => w.includes('resource:gone'))).toBe(true);
      }
    }
  });

  it('answers blobs-needed markers left by other devices and removes them', async () => {
    const t = await harness();
    t.blobs.set('feed0', new Blob(['local-dict']));
    await t.provider.write(
      t.connection,
      blobsNeededPath('feed0'),
      new Blob([JSON.stringify({ hash: 'feed0', deviceId: REMOTE_DEVICE, at: 1 })]),
    );

    await t.pull([], {});

    expect((await t.provider.list(t.connection, 'cell-sync/v1/blobs/')).map((e) => e.path)).toEqual(
      [blobPath('feed0')],
    );
    expect(await t.provider.list(t.connection, 'cell-sync/v1/meta/blobs-needed/')).toEqual([]);
  });

  it('invokes onRoutingChange for directory routing records before applying', async () => {
    const t = await harness();
    const dir = new PullSource('syncDirectory', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'syncDirectory', 'binding:fr', 'mem:acct', 10),
    ]);

    await t.pull([GLOBAL], { sources: [dir] });

    expect(t.routingRecords.map((r) => r.key)).toEqual(['binding:fr']);
    expect(dir.applied).toHaveLength(1);
  });

  it('persists a drain obligation before applying the routing record', async () => {
    const t = await harness();
    const dir = new PullSource('syncDirectory', GLOBAL);
    let seenDuringApply: SyncCheckpoint | null | undefined;
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'syncDirectory', 'binding:fr', 'mem:other-acct', 10),
    ]);

    await t.pull([GLOBAL], {
      sources: [dir],
      onRoutingChange: async () => {
        seenDuringApply = await getCheckpoint(t.kv, 'profile:fr' as Scope);
      },
    });

    expect(seenDuringApply?.kind).toBe('drain');
    expect(seenDuringApply?.to).toBe('mem:other-acct');
  });

  it('defers a routing record when its scope is occupied by a non-drain checkpoint', async () => {
    const t = await harness();
    const dir = new PullSource('syncDirectory', GLOBAL);
    await writeCheckpoint(t.kv, {
      scope: 'profile:fr' as Scope,
      kind: 'rebind',
      phase: 'freeze',
      from: 'mem:a' as ConnectionId,
      to: 'mem:b' as ConnectionId,
      writtenPaths: [],
      markerHlc: null,
      startedAt: 0,
      until: null,
    });
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'syncDirectory', 'binding:fr', 'mem:other-acct', 10),
    ]);

    const result = await t.pull([GLOBAL], { sources: [dir] });

    expect(t.routingRecords).toEqual([]);
    expect(dir.applied).toHaveLength(0);
    expect(result.outcomes[0]!.devices[0]!.recordsDeferred).toBe(1);
    const deferred = await t.store.listDeferred(t.connection.connectionId);
    expect(deferred.map((d) => d.recordKey)).toEqual(['binding:fr']);
    expect((await getCheckpoint(t.kv, 'profile:fr' as Scope))?.kind).toBe('rebind');
    const routing = await t.kv.get<Record<string, unknown>>('local', 'syncState');
    expect(routing?.['binding:fr']).toBeUndefined();

    await t.kv.del('local', 'syncCheckpoints');
    const second = await t.pull([GLOBAL], { sources: [dir] });
    expect((await getCheckpoint(t.kv, 'profile:fr' as Scope))?.kind).toBe('drain');
    expect(second.outcomes[0]!.devices[0]!.recordsDeferred).toBe(0);
  });

  it('handles disconnect markers: newer marker triggers onDisconnect and skips pull', async () => {
    const t = await harness();
    const dir = new PullSource('syncDirectory', GLOBAL);
    const settings = new PullSource('settings', GLOBAL);
    await stampKvMeta(t.kv, [
      {
        scope: GLOBAL,
        dataClass: 'syncDirectory' as DataClass,
        key: `connection:${t.connection.connectionId}`,
        op: 'put' as const,
        value: { connectionId: t.connection.connectionId },
        hlc: makeHlc(1),
      },
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await t.provider.write(
      t.connection,
      DISCONNECT_MARKER_PATH,
      new Blob([
        JSON.stringify({ formatVersion: 1, kind: 'disconnect', hlc: makeHlc(500) }),
      ]),
    );

    const result = await t.pull([GLOBAL], { sources: [dir, settings] });

    expect(result.disconnected).toBe(true);
    expect(t.disconnected).toEqual([t.connection.connectionId]);
    expect(settings.applied).toHaveLength(0);
    expect(await cursorOf(t, GLOBAL)).toBeUndefined();
  });

  it('ignores a disconnect marker older than the local directory record', async () => {
    const t = await harness();
    await stampKvMeta(t.kv, [
      {
        scope: GLOBAL,
        dataClass: 'syncDirectory' as DataClass,
        key: `connection:${t.connection.connectionId}`,
        op: 'put' as const,
        value: { connectionId: t.connection.connectionId },
        hlc: makeHlc(900),
      },
    ]);
    const settings = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await t.provider.write(
      t.connection,
      DISCONNECT_MARKER_PATH,
      new Blob([
        JSON.stringify({ formatVersion: 1, kind: 'disconnect', hlc: makeHlc(500) }),
      ]),
    );

    const result = await t.pull([GLOBAL], { sources: [settings] });

    expect(result.disconnected).toBe(false);
    expect(t.disconnected).toEqual([]);
    expect(settings.applied).toHaveLength(1);
  });

  it('isolates failures per scope', async () => {
    const t = await harness();
    const bad = new PullSource('settings', GLOBAL);
    bad.failNext = 1;
    const good = new PullSource('settings', 'profile:en');
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:settings/a', 1),
    ]);
    await writeJournal(t, 'profile:en', REMOTE_DEVICE, 1, [
      makeRecord('profile:en', 'settings', 'kv:settings/b', 2),
    ]);

    const result = await t.pull([GLOBAL, 'profile:en'], { sources: [bad, good] });

    const byScope = new Map(result.outcomes.map((o) => [o.scope, o]));
    expect(
      byScope.get(GLOBAL)!.devices[0]!.warnings.some((w) => w.includes('applyRemote failed')),
    ).toBe(true);
    expect(good.applied.map((r) => r.key)).toEqual(['kv:settings/b']);
    expect(result.appliedScopes).toEqual(['profile:en']);
  });

  it('stops a device after a failed journal so it is retried next cycle', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    source.failNext = 1;
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:a', 1, 10),
      makeRecord(GLOBAL, 'settings', 'kv:a2', 2, 11),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'settings', 'kv:b', 3, 20),
    ]);

    await t.pull([GLOBAL], { sources: [source] });
    expect(await cursorOf(t, GLOBAL)).toBeUndefined();

    await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied.map((r) => r.key)).toEqual(['kv:a', 'kv:a2', 'kv:b']);
    expect(await cursorOf(t, GLOBAL)).toEqual({ snapshotN: 0, seq: 2 });
  });

  it('pulls from multiple remote devices independently', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:a', 1),
    ]);
    await writeJournal(t, GLOBAL, OTHER_DEVICE, 7, [
      makeRecord(GLOBAL, 'settings', 'kv:b', 2),
    ]);

    await t.pull([GLOBAL], { sources: [source] });

    expect(source.applied.map((r) => r.key)).toEqual(['kv:a', 'kv:b']);
    expect(await cursorOf(t, GLOBAL, REMOTE_DEVICE)).toEqual({ snapshotN: 0, seq: 1 });
    expect(await cursorOf(t, GLOBAL, OTHER_DEVICE)).toEqual({ snapshotN: 0, seq: 7 });
  });

  it('stores opaque outcomes durably', async () => {
    const t = await harness();
    const source = new PullSource('srsCard', 'profile:en');
    source.opaqueKeys.add('card:c1');
    await writeJournal(t, 'profile:en', REMOTE_DEVICE, 1, [
      makeRecord('profile:en', 'srsCard', 'card:c1', { id: 'c1' }, 10),
    ]);

    await t.pull(['profile:en'], { sources: [source] });

    const opaque = await t.store.putOpaque;
    expect(typeof opaque).toBe('function');
    const { getAllOpaqueRecords } = await import('../adapters/local/syncDb');
    const rows = await getAllOpaqueRecords('profile:en');
    expect(rows.map((r) => r.recordKey)).toEqual(['card:c1']);
  });

  it('persists cursors under storage.local.syncCursors', async () => {
    const t = await harness();
    const source = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'settings', 'kv:a', 1),
    ]);

    await t.pull([GLOBAL], { sources: [source] });

    const stored = await t.kv.get<Record<string, unknown>>('local', SYNC_CURSORS_STORAGE_KEY);
    expect(stored).toBeDefined();
    const key = cursorKey(t.connection.connectionId, GLOBAL, REMOTE_DEVICE);
    expect(stored![key]).toEqual({ snapshotN: 0, seq: 1 });
  });
});

describe('opaque release', () => {
  it('retains opaque records and applies them once the source accepts them', async () => {
    const t = await harness();
    const source = new PullSource('dictResource', GLOBAL);
    source.opaqueKeys.add('resource:h1/name');
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:h1/name', 'name-value', 5),
    ]);

    const first = await t.pull([GLOBAL], { sources: [source] });
    expect(source.applied).toHaveLength(0);
    expect((await t.store.listOpaque(GLOBAL)).map((r) => r.recordKey)).toEqual([
      'resource:h1/name',
    ]);
    expect(first.outcomes[0]?.releasedApplied).toBe(0);

    source.opaqueKeys.clear();
    const second = await t.pull([GLOBAL], { sources: [source] });
    expect(second.outcomes[0]?.releasedApplied).toBe(1);
    expect(source.applied.map((r) => r.key)).toEqual(['resource:h1/name']);
    expect(await t.store.listOpaque(GLOBAL)).toEqual([]);
    expect(second.appliedScopes).toEqual([GLOBAL]);
  });

  it('retains records whose dataClass has no registered source as opaque', async () => {
    const t = await harness();
    const settings = new PullSource('settings', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'readerBook', 'book:b1', { title: 'B' }, 3),
      makeRecord(GLOBAL, 'settings', 'kv:x', 1, 4),
    ]);

    const result = await t.pull([GLOBAL], { sources: [settings] });

    expect(settings.applied.map((r) => r.key)).toEqual(['kv:x']);
    expect((await t.store.listOpaque(GLOBAL)).map((r) => r.recordKey)).toEqual([
      'book:b1',
    ]);
    const key = cursorKey(t.connection.connectionId, GLOBAL, REMOTE_DEVICE);
    expect((await readCursors(t.kv))[key]).toEqual({ snapshotN: 0, seq: 1 });
    expect(result.appliedScopes).toEqual([GLOBAL]);
  });
});

describe('deferred records across devices', () => {
  it('keeps one deferred row per source device and rewrites blobs-needed markers', async () => {
    const t = await harness();
    const source = new PullSource('dictResource', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:blob-1', { name: 'old' }, 5),
    ]);
    await writeJournal(t, GLOBAL, OTHER_DEVICE, 1, [
      {
        ...makeRecord(GLOBAL, 'dictResource', 'resource:blob-1', { name: 'newer' }, 9),
        hlc: makeHlc(9, `${OTHER_DEVICE}:ctx`),
      },
    ]);

    const result = await t.pull([GLOBAL], { sources: [source] });

    const rows = await t.store.listDeferred(t.connection.connectionId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.record.hlc.node).sort()).toEqual([
      `${REMOTE_DEVICE}:ctx`,
      `${OTHER_DEVICE}:ctx`,
    ]);
    const markers = (
      await t.provider.list(t.connection, 'cell-sync/v1/meta/blobs-needed/')
    ).map((e) => e.path);
    expect(markers).toEqual([blobsNeededPath('blob-1')]);
    expect(result.warnings).toEqual([]);
  });

  it('re-deferring a newer record for the same key keeps the newer value', async () => {
    const t = await harness();
    const source = new PullSource('dictResource', GLOBAL);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 1, [
      makeRecord(GLOBAL, 'dictResource', 'resource:blob-1', { name: 'old' }, 5),
    ]);
    await writeJournal(t, GLOBAL, REMOTE_DEVICE, 2, [
      makeRecord(GLOBAL, 'dictResource', 'resource:blob-1', { name: 'new' }, 20),
    ]);

    await t.pull([GLOBAL], { sources: [source] });

    const rows = await t.store.listDeferred(t.connection.connectionId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.record.value).toEqual({ name: 'new' });
  });
});
