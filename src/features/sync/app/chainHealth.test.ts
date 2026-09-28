import 'fake-indexeddb/auto';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import type {
  ChangeRecord,
  Connection,
  DataClass,
  Hlc,
  PendingKey,
  RecordKey,
  Scope,
} from '../domain/types';
import type { ApplyResult, LocalSource } from '../ports/localSource';
import { ensureChainHealthy, type ChainHealthDeps } from './chainHealth';
import { journalPath, scopeDevicePrefix, snapshotPath } from './remotePaths';
import { createSyncDbStore } from './syncDbStore';
import { decodeSnapshot, encodeJournal, encodeSnapshot } from './wireCodec';

const DEVICE = 'dev-1';
const GLOBAL: Scope = 'global';

class SnapSource implements LocalSource {
  records: ChangeRecord[] = [];
  constructor(readonly dataClass: DataClass) {}
  async pending(): Promise<PendingKey[]> {
    return [];
  }
  async resolve(): Promise<ChangeRecord[]> {
    return [];
  }
  async ack(): Promise<void> {}
  async stampCommitted(): Promise<void> {}
  async *snapshot(scope: Scope): AsyncIterable<ChangeRecord> {
    for (const record of this.records) {
      if (record.scope === scope) yield record;
    }
  }
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
  store: ReturnType<typeof createSyncDbStore>;
  source: SnapSource;
  deps: ChainHealthDeps;
  chainPaths(): Promise<string[]>;
  allocateSeqs(count: number): Promise<void>;
}

const hlc = (): Hlc => ({ wall: 1, counter: 0, node: 'n' });

async function harness(): Promise<Harness> {
  const provider = new InMemoryStorageProvider({ providerId: 'mem' });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `mem:${account.accountKey}` as Connection['connectionId'],
    providerId: 'mem',
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const store = createSyncDbStore();
  const source = new SnapSource('settings');
  const deps: ChainHealthDeps = {
    provider,
    connection,
    store,
    sources: [source],
    blobs: { read: async () => null },
    deviceId: DEVICE,
    fence: async () => undefined,
  };
  return {
    provider,
    connection,
    store,
    source,
    deps,
    chainPaths: async () =>
      (await provider.list(connection, scopeDevicePrefix(GLOBAL, DEVICE))).map(
        (e) => e.path,
      ),
    allocateSeqs: async (count) => {
      for (let i = 0; i < count; i += 1) {
        await store.freezeBatch({
          connectionId: connection.connectionId,
          scope: GLOBAL,
          records: [
            {
              scope: GLOBAL,
              dataClass: 'settings',
              key: `k${i}`,
              op: 'put',
              value: {},
              hlc: hlc(),
            },
          ],
          cycleId: 'c',
          createdAt: 1,
        });
      }
    },
  };
}

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

describe('ensureChainHealthy', () => {
  it('does nothing when no sequence was ever committed locally', async () => {
    const t = await harness();
    await ensureChainHealthy(t.deps, GLOBAL, 1);
    expect(await t.chainPaths()).toEqual([]);
  });

  it('does nothing for a contiguous remote chain', async () => {
    const t = await harness();
    await t.allocateSeqs(2);
    for (const seq of [1, 2]) {
      await t.provider.write(
        t.connection,
        journalPath(GLOBAL, DEVICE, seq),
        encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq, records: [] }),
      );
    }
    await ensureChainHealthy(t.deps, GLOBAL, 3);
    expect(
      (await t.chainPaths()).filter((p) => p.includes('snapshot')),
    ).toHaveLength(0);
  });

  it('republishes a full snapshot when an early journal is missing', async () => {
    const t = await harness();
    t.source.records = [
      {
        scope: GLOBAL,
        dataClass: 'settings',
        key: 'learned',
        op: 'put',
        value: { v: 1 },
        hlc: hlc(),
      },
    ];
    await t.allocateSeqs(3);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 3),
      encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq: 3, records: [] }),
    );
    await ensureChainHealthy(t.deps, GLOBAL, 4);
    const paths = await t.chainPaths();
    const snapshot = paths.find((p) => p.includes('snapshot'));
    expect(snapshot).toBeDefined();
    const decoded = await decodeSnapshot(
      await t.provider.read(t.connection, snapshot!),
    );
    expect(decoded.coversSeq).toBe(3);
    expect(decoded.records.map((r) => r.key)).toEqual(['learned']);
  });

  it('treats remote seq at/above nextSeq as counter-reset damage', async () => {
    const t = await harness();
    await t.allocateSeqs(2);
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 1),
      encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq: 1, records: [] }),
    );
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 2),
      encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq: 2, records: [] }),
    );
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 3),
      encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq: 3, records: [] }),
    );
    await ensureChainHealthy(t.deps, GLOBAL, 3);
    const snapshot = (await t.chainPaths()).find((p) => p.includes('snapshot'));
    expect(snapshot).toBeDefined();
    const decoded = await decodeSnapshot(
      await t.provider.read(t.connection, snapshot!),
    );
    expect(decoded.coversSeq).toBe(3);
  });

  it('heals an empty chain when the local counter expects commits', async () => {
    const t = await harness();
    await t.allocateSeqs(1);
    await ensureChainHealthy(t.deps, GLOBAL, 2);
    const snapshot = (await t.chainPaths()).find((p) => p.includes('snapshot'));
    expect(snapshot).toBeDefined();
    const decoded = await decodeSnapshot(
      await t.provider.read(t.connection, snapshot!),
    );
    expect(decoded.coversSeq).toBe(1);
  });

  it('heals when the newest snapshot fails to decode', async () => {
    const t = await harness();
    await t.allocateSeqs(1);
    await t.provider.write(
      t.connection,
      snapshotPath(GLOBAL, DEVICE, 7),
      new Blob(['corrupt']),
    );
    await ensureChainHealthy(t.deps, GLOBAL, 2);
    const paths = await t.chainPaths();
    expect(paths.filter((p) => p.includes('snapshot')).length).toBeGreaterThan(1);
  });

  it('does not heal a healthy snapshot-backed chain', async () => {
    const t = await harness();
    await t.allocateSeqs(3);
    await t.provider.write(
      t.connection,
      snapshotPath(GLOBAL, DEVICE, 1),
      encodeSnapshot({
        scope: GLOBAL,
        deviceId: DEVICE,
        n: 1,
        coversSeq: 2,
        records: [],
      }),
    );
    await t.provider.write(
      t.connection,
      journalPath(GLOBAL, DEVICE, 3),
      encodeJournal({ scope: GLOBAL, deviceId: DEVICE, seq: 3, records: [] }),
    );
    await ensureChainHealthy(t.deps, GLOBAL, 4);
    expect(
      (await t.chainPaths()).filter((p) => p.includes('snapshot')),
    ).toEqual([snapshotPath(GLOBAL, DEVICE, 1)]);
  });
});
