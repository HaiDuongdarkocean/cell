import 'fake-indexeddb/auto';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '../adapters/memory/SeededClock';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import type { ChangeRecord, Connection, Hlc, Scope } from '../domain/types';
import {
  blobPath,
  blobsNeededPath,
  DISCONNECT_MARKER_PATH,
  journalPath,
  snapshotPath,
} from './remotePaths';
import {
  ORPHAN_BLOB_GRACE_MS,
  runRemoteSweep,
  runRemoteSweepIfDue,
  STALE_CHAIN_MS,
  sweepDisconnectedFootprint,
  type RemoteSweepDeps,
} from './remoteSweep';
import { createSyncDbStore } from './syncDbStore';
import { encodeJournal, encodeSnapshot } from './wireCodec';

const DEVICE = 'dev-own';
const FOREIGN = 'dev-dead';
const GLOBAL: Scope = 'global';

const makeHlc = (wall = 1): Hlc => ({ wall, counter: 0, node: 'n' });
const rec = (key: string, value: unknown = {}): ChangeRecord => ({
  scope: GLOBAL,
  dataClass: 'settings',
  key,
  op: 'put',
  value,
  hlc: makeHlc(),
});

interface Harness {
  provider: InMemoryStorageProvider;
  connection: Connection;
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  store: ReturnType<typeof createSyncDbStore>;
  deps: RemoteSweepDeps;
  paths(): Promise<string[]>;
}

async function harness(): Promise<Harness> {
  const clock = new SeededClock(1_000_000);
  const provider = new InMemoryStorageProvider({ providerId: 'mem', clock });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `mem:${account.accountKey}` as Connection['connectionId'],
    providerId: 'mem',
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const kv = new InMemoryKeyValueStore();
  const store = createSyncDbStore();
  const deps: RemoteSweepDeps = {
    provider,
    connection,
    kv,
    store,
    deviceId: DEVICE,
    clock,
    fence: async () => undefined,
  };
  return {
    provider,
    connection,
    kv,
    clock,
    store,
    deps,
    paths: async () => (await provider.list(connection, '')).map((e) => e.path),
  };
}

async function writeJournal(
  t: Harness,
  scope: Scope,
  deviceId: string,
  seq: number,
  records: ChangeRecord[] = [],
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
  records: ChangeRecord[] = [],
): Promise<void> {
  await t.provider.write(
    t.connection,
    snapshotPath(scope, deviceId, n),
    encodeSnapshot({ scope, deviceId, n, coversSeq, records }),
  );
}

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('REQ-4 superseded-file GC', () => {
  it('deletes journals at/below coversSeq and older snapshots', async () => {
    const t = await harness();
    for (const seq of [1, 2, 3, 4]) await writeJournal(t, GLOBAL, DEVICE, seq);
    await writeSnapshot(t, GLOBAL, DEVICE, 1, 2);
    await writeSnapshot(t, GLOBAL, DEVICE, 2, 3);
    await runRemoteSweep(t.deps, t.clock.now());
    const paths = await t.paths();
    expect(paths).toEqual(
      expect.arrayContaining([
        journalPath(GLOBAL, DEVICE, 4),
        snapshotPath(GLOBAL, DEVICE, 2),
      ]),
    );
    expect(paths).not.toContain(journalPath(GLOBAL, DEVICE, 1));
    expect(paths).not.toContain(journalPath(GLOBAL, DEVICE, 3));
    expect(paths).not.toContain(snapshotPath(GLOBAL, DEVICE, 1));
  });

  it('cleans foreign device chains without deviceId validation', async () => {
    const t = await harness();
    for (const seq of [1, 2]) await writeJournal(t, GLOBAL, FOREIGN, seq);
    await writeSnapshot(t, GLOBAL, FOREIGN, 1, 2);
    t.clock.advance(1000);
    await writeJournal(t, GLOBAL, FOREIGN, 3);
    await runRemoteSweep(t.deps, t.clock.now());
    const paths = await t.paths();
    expect(paths).toEqual(
      expect.arrayContaining([
        journalPath(GLOBAL, FOREIGN, 3),
        snapshotPath(GLOBAL, FOREIGN, 1),
      ]),
    );
    expect(paths).toHaveLength(2);
  });

  it('skips the chain when the newest snapshot fails to decode', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, DEVICE, 1);
    await t.provider.write(
      t.connection,
      snapshotPath(GLOBAL, DEVICE, 1),
      new Blob(['not-a-snapshot']),
    );
    await runRemoteSweep(t.deps, t.clock.now());
    const paths = await t.paths();
    expect(paths).toContain(journalPath(GLOBAL, DEVICE, 1));
    expect(paths).toContain(snapshotPath(GLOBAL, DEVICE, 1));
  });
});

describe('REQ-5 stale-chain TTL', () => {
  it('deletes a foreign chain whose files are all older than TTL', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, FOREIGN, 1);
    await writeJournal(t, GLOBAL, DEVICE, 1);
    t.clock.advance(STALE_CHAIN_MS + 1000);
    await runRemoteSweep(t.deps, t.clock.now());
    const paths = await t.paths();
    expect(paths).not.toContain(journalPath(GLOBAL, FOREIGN, 1));
    expect(paths).toContain(journalPath(GLOBAL, DEVICE, 1));
  });

  it('keeps a chain that has any file newer than TTL', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, FOREIGN, 1);
    t.clock.advance(STALE_CHAIN_MS + 1000);
    await writeJournal(t, GLOBAL, FOREIGN, 2);
    const now = t.clock.now();
    await runRemoteSweep(t.deps, now);
    const paths = await t.paths();
    expect(paths).toContain(journalPath(GLOBAL, FOREIGN, 2));
  });
});

describe('REQ-7 orphan blob GC', () => {
  it('deletes unreferenced blobs older than grace, keeps the rest', async () => {
    const t = await harness();
    const referenced = rec('resource:aaa111', { contentHash: 'aaa111' });
    await writeJournal(t, GLOBAL, DEVICE, 1, [referenced]);
    await t.provider.write(t.connection, blobPath('aaa111'), new Blob(['x']));
    await t.provider.write(t.connection, blobPath('dead99'), new Blob(['x']));
    await t.provider.write(
      t.connection,
      blobsNeededPath('need55'),
      new Blob(['{}']),
    );
    await t.provider.write(t.connection, blobPath('need55'), new Blob(['x']));
    t.clock.advance(ORPHAN_BLOB_GRACE_MS + 1000);
    await t.provider.write(t.connection, blobPath('fresh00'), new Blob(['x']));
    await runRemoteSweep(t.deps, t.clock.now());
    const paths = await t.paths();
    expect(paths).toContain(blobPath('aaa111'));
    expect(paths).toContain(blobPath('need55'));
    expect(paths).toContain(blobPath('fresh00'));
    expect(paths).not.toContain(blobPath('dead99'));
  });

  it('protects blobs referenced only by deferred records', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, DEVICE, 1);
    await t.provider.write(t.connection, blobPath('def456'), new Blob(['x']));
    t.clock.advance(ORPHAN_BLOB_GRACE_MS + 1000);
    await t.store.deferRecord({
      connectionId: t.connection.connectionId,
      record: rec('k1'),
      requiredBlobHashes: ['def456'],
      firstDeferredAt: t.clock.now(),
      attempts: 0,
    });
    await runRemoteSweep(t.deps, t.clock.now());
    expect(await t.paths()).toContain(blobPath('def456'));
  });

  it('deletes zero blobs when a live file fails to decode', async () => {
    const t = await harness();
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 1),
      new Blob(['corrupt']),
    );
    await t.provider.write(t.connection, blobPath('dead99'), new Blob(['x']));
    t.clock.advance(ORPHAN_BLOB_GRACE_MS + 1000);
    await runRemoteSweep(t.deps, t.clock.now());
    expect(await t.paths()).toContain(blobPath('dead99'));
  });
});

describe('throttle', () => {
  it('runRemoteSweepIfDue skips inside the interval and runs after it', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, FOREIGN, 1);
    await t.kv.set(
      'local',
      `syncSweepAt:${t.connection.connectionId}`,
      t.clock.now(),
    );
    t.clock.advance(STALE_CHAIN_MS + 1000);
    await t.kv.set(
      'local',
      `syncSweepAt:${t.connection.connectionId}`,
      t.clock.now() - 60 * 1000,
    );
    await runRemoteSweepIfDue(t.deps);
    expect(await t.paths()).toContain(journalPath(GLOBAL, FOREIGN, 1));
    await t.kv.set(
      'local',
      `syncSweepAt:${t.connection.connectionId}`,
      t.clock.now() - 25 * 60 * 60 * 1000,
    );
    await runRemoteSweepIfDue(t.deps);
    expect(await t.paths()).not.toContain(journalPath(GLOBAL, FOREIGN, 1));
  });
});

describe('sweepDisconnectedFootprint', () => {
  it('removes every remote file except the disconnect marker', async () => {
    const t = await harness();
    await writeJournal(t, GLOBAL, DEVICE, 1);
    await writeJournal(t, GLOBAL, FOREIGN, 2);
    await t.provider.write(t.connection, blobPath('aaa'), new Blob(['x']));
    await t.provider.write(t.connection, DISCONNECT_MARKER_PATH, new Blob(['{}']));
    await sweepDisconnectedFootprint({
      provider: t.provider,
      connection: t.connection,
      fence: async () => undefined,
    });
    const paths = await t.paths();
    expect(paths).toEqual([DISCONNECT_MARKER_PATH]);
  });
});
