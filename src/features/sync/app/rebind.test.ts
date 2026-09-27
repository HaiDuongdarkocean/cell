import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
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
import {
  cancelScopeRebind,
  deleteScopeCopyOnVacated,
  resumeScopeRebind,
  runScopeRebind,
} from './rebind';
import {
  observeRouteMarker,
  processCheckpoints,
  type ObligationDeps,
} from './obligations';
import {
  completePendingDisconnects,
  DISCONNECT_PENDING_PREFIX,
  runConnectionDisconnect,
  SystemConnectionRequiredError,
  type DisconnectDeps,
} from './disconnect';
import {
  getCheckpoint,
  listCheckpoints,
  writeCheckpoint,
  type SyncCheckpoint,
} from './checkpoints';
import { readRouteMarker } from './routeMarkers';
import {
  DISCONNECT_MARKER_PATH,
  journalPath,
  parseJournalSeq,
  parseSnapshotN,
  scopesPrefix,
  scopeDevicePrefix,
  snapshotPath,
} from './remotePaths';
import { blobToBytes } from '../adapters/contract/blobBytes';
import { decodeSnapshot, encodeJournal, encodeSnapshot } from './wireCodec';
import { readRouting, SYNC_DIRECTORY_STORAGE_KEY } from './routing';
import { createSyncDbStore } from './syncDbStore';
import { closeSyncDB, deleteSyncDB } from '../adapters/local/syncDb';
import { InMemoryStorageProvider } from '../adapters/memory/InMemoryStorageProvider';
import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { SeededClock } from '../adapters/memory/SeededClock';
import { ProviderError } from '../ports/storageProvider';

const PROVIDER_ID = 'in-memory';
const DEVICE = 'device-here';
const REMOTE = 'device-other';
const SCOPE: Scope = 'profile:lang:en';
const DATA: DataClass = 'srsCard';

class FakeSource implements LocalSource {
  readonly dataClass: DataClass;
  pendingKeys: PendingKey[] = [];
  snapshotRecords: ChangeRecord[];
  acked: PendingKey[] = [];
  stamped: ChangeRecord[] = [];

  constructor(dataClass: DataClass, records: ChangeRecord[] = []) {
    this.dataClass = dataClass;
    this.snapshotRecords = records;
  }

  async pending(): Promise<PendingKey[]> {
    return this.pendingKeys;
  }

  async resolve(keys: PendingKey[]): Promise<ChangeRecord[]> {
    return this.snapshotRecords.filter((r) =>
      keys.some((k) => k.scope === r.scope && k.dataClass === r.dataClass && k.key === r.key),
    );
  }

  async ack(keys: PendingKey[]): Promise<void> {
    this.acked.push(...keys);
  }

  async stampCommitted(records: ChangeRecord[]): Promise<void> {
    this.stamped.push(...records);
  }

  async current(): Promise<Map<RecordKey, ChangeRecord | null>> {
    return new Map();
  }

  async applyRemote(records: ChangeRecord[]): Promise<ApplyResult> {
    return { applied: records, localWon: [], opaque: [] };
  }

  async *snapshot(scope: Scope): AsyncGenerator<ChangeRecord> {
    for (const r of this.snapshotRecords.filter((r) => r.scope === scope)) yield r;
  }
}

interface Harness {
  provider: InMemoryStorageProvider;
  connA: Connection;
  connB: Connection;
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  store: ReturnType<typeof createSyncDbStore>;
  blobs: Map<string, Blob>;
  source: FakeSource;
  disconnected: ConnectionId[];
  rebindDeps(overrides?: Partial<ObligationDeps>): ObligationDeps;
  disconnectDeps(overrides?: Partial<DisconnectDeps>): DisconnectDeps;
}

function hlc(wall: number, node = `${DEVICE}:ctx`): Hlc {
  return { wall, counter: 0, node };
}

function rec(key: string, value: unknown = { v: 1 }, wall = 10): ChangeRecord {
  return { scope: SCOPE, dataClass: DATA, key, op: 'put', value, hlc: hlc(wall) };
}

async function harness(): Promise<Harness> {
  const provider = new InMemoryStorageProvider({ providerId: PROVIDER_ID });
  const acctA = await provider.authorize({ interactive: true });
  const acctB = await provider.authorize({ interactive: true });
  const connA: Connection = {
    connectionId: `${PROVIDER_ID}:${acctA.accountKey}` as ConnectionId,
    providerId: PROVIDER_ID,
    accountKey: acctA.accountKey,
    displayName: acctA.displayName,
  };
  const connB: Connection = {
    connectionId: `${PROVIDER_ID}:${acctB.accountKey}` as ConnectionId,
    providerId: PROVIDER_ID,
    accountKey: acctB.accountKey,
    displayName: acctB.displayName,
  };
  const kv = new InMemoryKeyValueStore();
  const clock = new SeededClock(1000);
  const store = createSyncDbStore();
  const blobs = new Map<string, Blob>();
  const source = new FakeSource(DATA, [rec('card:c1', { front: 'a' }), rec('card:c2')]);
  const disconnected: ConnectionId[] = [];
  const connections = [connA, connB];
  const connByIds = new Map(connections.map((c) => [c.connectionId, c] as const));

  await kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, {
    deviceId: DEVICE,
    systemConnection: connA.connectionId,
    [`connection:${connA.connectionId}`]: { providerId: PROVIDER_ID, accountKey: acctA.accountKey },
    [`connection:${connB.connectionId}`]: { providerId: PROVIDER_ID, accountKey: acctB.accountKey },
    [`binding:${SCOPE.slice('profile:'.length)}`]: connA.connectionId,
  });

  const tick = (): Hlc => ({ wall: clock.now(), counter: 0, node: `${DEVICE}:cycle-1` });
  const base = {
    providerFor: () => provider,
    connectionFor: (id: ConnectionId) => connByIds.get(id) ?? null,
    connections: async () => connections,
    kv,
    store,
    sources: [source] as LocalSource[],
    blobs: { read: async (hash: string) => blobs.get(hash) ?? null },
    deviceId: DEVICE,
    cycleId: 'cycle-1',
    clock,
    tick,
    fence: async () => undefined,
    pendingLimit: 50,
  };

  return {
    provider,
    connA,
    connB,
    kv,
    clock,
    store,
    blobs,
    source,
    disconnected,
    rebindDeps: (o = {}) => ({ ...base, ...o }),
    disconnectDeps: (o = {}) => ({
      ...base,
      onDisconnect: async (id: ConnectionId) => {
        disconnected.push(id);
      },
      ...o,
    }),
  };
}

async function snapshotRecordsAt(
  t: Harness,
  conn: Connection,
  scope: Scope,
  deviceId: string,
): Promise<ChangeRecord[]> {
  const entries = await t.provider.list(conn, scopeDevicePrefix(scope, deviceId));
  const snaps = entries.filter((e) => parseSnapshotN(e.path) !== null);
  if (snaps.length === 0) return [];
  const blob = await t.provider.read(conn, snaps[snaps.length - 1].path);
  return (await decodeSnapshot(blob)).records;
}

beforeEach(async () => {
  await deleteSyncDB();
});

afterEach(() => {
  closeSyncDB();
});

function checkpoint(partial: Partial<SyncCheckpoint> & Pick<SyncCheckpoint, 'kind'>): SyncCheckpoint {
  return {
    scope: SCOPE,
    phase: 'open',
    from: null,
    to: 'local',
    writtenPaths: [],
    markerHlc: null,
    startedAt: 1,
    until: null,
    ...partial,
  };
}

describe('runScopeRebind', () => {
  test('happy path A→B: snapshot on B verified, route markers on both, binding updated, checkpoint cleared', async () => {
    const t = await harness();
    await t.provider.write(
      t.connA,
      journalPath(SCOPE, REMOTE, 1),
      encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 1, records: [] }),
    );
    const result = await runScopeRebind(t.rebindDeps(), SCOPE, t.connB.connectionId);

    expect(result.done).toBe(true);
    expect(result.phase).toBe('done');

    const onB = await snapshotRecordsAt(t, t.connB, SCOPE, DEVICE);
    expect(onB.map((r) => r.key).sort()).toEqual(['card:c1', 'card:c2']);

    const markerB = await readRouteMarker(t.provider, t.connB, SCOPE);
    expect(markerB?.destination).toBe(t.connB.connectionId);
    const markerA = await readRouteMarker(t.provider, t.connA, SCOPE);
    expect(markerA?.destination).toBe(t.connB.connectionId);

    const routing = await readRouting(t.kv);
    expect(routing.bindings.get(SCOPE.slice('profile:'.length))).toBe(t.connB.connectionId);
    expect(routing.frozenScopes.has(SCOPE)).toBe(false);
    expect(await getCheckpoint(t.kv, SCOPE)).toBeNull();

    const oldFiles = await t.provider.list(t.connA, `${scopesPrefix()}${SCOPE}/`);
    expect(oldFiles.length).toBeGreaterThan(0);
  });

  test('pending keys for the scope are pushed to B before final snapshot', async () => {
    const t = await harness();
    t.source.pendingKeys = [{ scope: SCOPE, dataClass: DATA, key: 'card:c1', op: 'put' }];
    t.source.snapshotRecords.push(rec('card:c3', { front: 'late' }));
    const result = await runScopeRebind(t.rebindDeps(), SCOPE, t.connB.connectionId);
    expect(result.done).toBe(true);
    const onB = await snapshotRecordsAt(t, t.connB, SCOPE, DEVICE);
    expect(onB.map((r) => r.key).sort()).toEqual(['card:c1', 'card:c2', 'card:c3']);
    expect(t.source.acked.map((k) => k.key)).toEqual(['card:c1']);
  });

  test('scope stays frozen while checkpoint is in freeze/copied phase', async () => {
    const t = await harness();
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'rebind', phase: 'copied', from: t.connA.connectionId, to: t.connB.connectionId }),
    );
    const routing = await readRouting(t.kv);
    expect(routing.frozenScopes.has(SCOPE)).toBe(true);
    const result = await resumeScopeRebind(
      t.rebindDeps(),
      (await getCheckpoint(t.kv, SCOPE))!,
    );
    expect(result.done).toBe(true);
    const routingAfter = await readRouting(t.kv);
    expect(routingAfter.frozenScopes.has(SCOPE)).toBe(false);
  });

  test('resume from routed phase: drains and clears without republishing markers', async () => {
    const t = await harness();
    const cp = checkpoint({
      kind: 'rebind',
      phase: 'routed',
      from: t.connA.connectionId,
      to: t.connB.connectionId,
    });
    const result = await resumeScopeRebind(t.rebindDeps(), cp);
    expect(result.done).toBe(true);
    expect(await getCheckpoint(t.kv, SCOPE)).toBeNull();
    expect(await readRouteMarker(t.provider, t.connB, SCOPE)).toBeNull();
  });

  test('destination not connected → waits with waitingFor, checkpoint kept', async () => {
    const t = await harness();
    const deps = t.rebindDeps({
      connectionFor: (id) => (id === t.connA.connectionId ? t.connA : null),
    });
    const result = await runScopeRebind(deps, SCOPE, t.connB.connectionId);
    expect(result.done).toBe(false);
    expect(result.waitingFor).toBe(t.connB.connectionId);
    expect(await getCheckpoint(t.kv, SCOPE)).not.toBeNull();
  });

  test('incompatible existing checkpoint → throws, checkpoint untouched', async () => {
    const t = await harness();
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'rebind', phase: 'copied', from: t.connA.connectionId, to: `${PROVIDER_ID}:other` as ConnectionId }),
    );
    await expect(
      runScopeRebind(t.rebindDeps(), SCOPE, t.connB.connectionId),
    ).rejects.toThrow();
    expect((await getCheckpoint(t.kv, SCOPE))?.to).toBe(`${PROVIDER_ID}:other`);
  });

  test('rebind to local: binding becomes local, pending keys acked, no B writes', async () => {
    const t = await harness();
    t.source.pendingKeys = [{ scope: SCOPE, dataClass: DATA, key: 'card:c1', op: 'put' }];
    const result = await runScopeRebind(t.rebindDeps(), SCOPE, 'local');
    expect(result.done).toBe(true);
    const routing = await readRouting(t.kv);
    expect(routing.bindings.get(SCOPE.slice('profile:'.length))).toBe('local');
    expect(t.source.acked).toHaveLength(1);
    expect(await readRouteMarker(t.provider, t.connB, SCOPE)).toBeNull();
    const markerA = await readRouteMarker(t.provider, t.connA, SCOPE);
    expect(markerA?.destination).toBe('local');
  });

  test('cancelScopeRebind clears checkpoint and unfreezes', async () => {
    const t = await harness();
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'rebind', phase: 'freeze', from: t.connA.connectionId, to: t.connB.connectionId }),
    );
    await cancelScopeRebind(t.rebindDeps(), SCOPE);
    expect(await getCheckpoint(t.kv, SCOPE)).toBeNull();
    expect((await readRouting(t.kv)).frozenScopes.has(SCOPE)).toBe(false);
  });
});

describe('route-marker obligations', () => {
  test('marker pointing elsewhere creates drain checkpoint; processCheckpoints publishes to destination and clears', async () => {
    const t = await harness();
    const created = await observeRouteMarker(
      t.kv,
      SCOPE,
      { hlc: hlc(50, `${REMOTE}:ctx`), destination: t.connB.connectionId },
      t.connA.connectionId,
      100,
    );
    expect(created).toBe(true);
    const cp = await getCheckpoint(t.kv, SCOPE);
    expect(cp?.kind).toBe('drain');
    expect(cp?.to).toBe(t.connB.connectionId);

    const result = await processCheckpoints(t.rebindDeps());
    expect(result.errors).toHaveLength(0);
    expect(result.completed).toEqual([SCOPE]);

    const onB = await snapshotRecordsAt(t, t.connB, SCOPE, DEVICE);
    expect(onB.map((r) => r.key).sort()).toEqual(['card:c1', 'card:c2']);
    expect(await getCheckpoint(t.kv, SCOPE)).toBeNull();
  });

  test('marker matching current route does not create an obligation', async () => {
    const t = await harness();
    const created = await observeRouteMarker(
      t.kv,
      SCOPE,
      { hlc: hlc(50), destination: t.connA.connectionId },
      t.connA.connectionId,
      100,
    );
    expect(created).toBe(false);
    expect(await listCheckpoints(t.kv)).toHaveLength(0);
  });

  test('older marker does not replace a newer drain obligation', async () => {
    const t = await harness();
    const newer = hlc(50);
    await observeRouteMarker(t.kv, SCOPE, { hlc: newer, destination: t.connB.connectionId }, t.connA.connectionId, 100);
    const again = await observeRouteMarker(t.kv, SCOPE, { hlc: hlc(10), destination: 'local' }, t.connA.connectionId, 101);
    expect(again).toBe(false);
    expect((await getCheckpoint(t.kv, SCOPE))?.to).toBe(t.connB.connectionId);
  });

  test('drain to unconnected destination reports waiting and keeps checkpoint', async () => {
    const t = await harness();
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'drain', from: t.connA.connectionId, to: `${PROVIDER_ID}:ghost` as ConnectionId }),
    );
    const result = await processCheckpoints(t.rebindDeps());
    expect(result.waiting).toEqual([SCOPE]);
    expect(await getCheckpoint(t.kv, SCOPE)).not.toBeNull();
  });

  test('drain to local clears without remote writes', async () => {
    const t = await harness();
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'drain', from: t.connA.connectionId, to: 'local' }),
    );
    const result = await processCheckpoints(t.rebindDeps());
    expect(result.completed).toEqual([SCOPE]);
    expect(await t.provider.list(t.connB, scopesPrefix())).toHaveLength(0);
  });
});

describe('old-source sweep', () => {
  test('deleteScopeCopyOnVacated removes remote scope files and registers a sweep checkpoint', async () => {
    const t = await harness();
    await t.provider.write(
      t.connA,
      journalPath(SCOPE, REMOTE, 1),
      encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 1, records: [rec('card:c9')] }),
    );
    await t.provider.write(
      t.connA,
      snapshotPath(SCOPE, REMOTE, 1),
      encodeSnapshot({ scope: SCOPE, deviceId: REMOTE, n: 1, coversSeq: 1, records: [rec('card:c9')] }),
    );
    await t.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, {
      deviceId: DEVICE,
      systemConnection: t.connA.connectionId,
      [`connection:${t.connA.connectionId}`]: { providerId: PROVIDER_ID },
      [`connection:${t.connB.connectionId}`]: { providerId: PROVIDER_ID },
      [`binding:${SCOPE.slice('profile:'.length)}`]: 'local',
    });
    await deleteScopeCopyOnVacated(
      t.rebindDeps(),
      SCOPE,
      t.connA.connectionId,
      60_000,
    );
    expect(await t.provider.list(t.connA, `${scopesPrefix()}${SCOPE}/`)).toHaveLength(0);
    const cp = await getCheckpoint(t.kv, SCOPE);
    expect(cp?.kind).toBe('sweep');
    expect(cp?.from).toBe(t.connA.connectionId);
  });

  test('processCheckpoints sweeps leftover remote files and clears when empty', async () => {
    const t = await harness();
    await t.provider.write(
      t.connA,
      journalPath(SCOPE, REMOTE, 7),
      encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 7, records: [] }),
    );
    await t.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, {
      deviceId: DEVICE,
      systemConnection: t.connA.connectionId,
      [`connection:${t.connA.connectionId}`]: { providerId: PROVIDER_ID },
      [`connection:${t.connB.connectionId}`]: { providerId: PROVIDER_ID },
      [`binding:${SCOPE.slice('profile:'.length)}`]: 'local',
    });
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'sweep', from: t.connA.connectionId, until: t.clock.now() + 60_000 }),
    );
    const result = await processCheckpoints(t.rebindDeps());
    expect(result.completed).toEqual([SCOPE]);
    expect(await t.provider.list(t.connA, `${scopesPrefix()}${SCOPE}/`)).toHaveLength(0);
  });

  test('sweep keeps remote files while the scope is still routed there', async () => {
    const t = await harness();
    await t.provider.write(
      t.connA,
      journalPath(SCOPE, REMOTE, 7),
      encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 7, records: [] }),
    );
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'sweep', from: t.connA.connectionId, until: t.clock.now() + 60_000 }),
    );
    const result = await processCheckpoints(t.rebindDeps());
    expect(result.completed).toEqual([]);
    expect(await t.provider.list(t.connA, `${scopesPrefix()}${SCOPE}/`)).toHaveLength(1);
    expect(await getCheckpoint(t.kv, SCOPE)).not.toBeNull();
  });

  test('sweep checkpoint past its until clears without touching remote', async () => {
    const t = await harness();
    await t.provider.write(
      t.connA,
      journalPath(SCOPE, REMOTE, 7),
      encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 7, records: [] }),
    );
    await writeCheckpoint(
      t.kv,
      checkpoint({ kind: 'sweep', from: t.connA.connectionId, until: 1 }),
    );
    const result = await processCheckpoints(t.rebindDeps());
    expect(result.completed).toEqual([SCOPE]);
    expect(await t.provider.list(t.connA, `${scopesPrefix()}${SCOPE}/`)).toHaveLength(1);
  });
});

describe('runConnectionDisconnect', () => {
  test('writes fenced marker, removes local connection state, rebinds scopes to local, fires onDisconnect', async () => {
    const t = await harness();
    t.source.pendingKeys = [{ scope: SCOPE, dataClass: DATA, key: 'card:c1', op: 'put' }];
    const state = await t.kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY);
    await t.kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, {
      ...state,
      [`binding:${SCOPE.slice('profile:'.length)}`]: t.connB.connectionId,
    });

    const result = await runConnectionDisconnect(t.disconnectDeps(), t.connB);
    expect(result.status).toBe('disconnected');

    const markerBlob = await t.provider.read(t.connB, DISCONNECT_MARKER_PATH);
    const parsed = JSON.parse(new TextDecoder().decode(await blobToBytes(markerBlob))) as {
      kind: string;
      deviceId: string;
    };
    expect(parsed.kind).toBe('disconnect');
    expect(parsed.deviceId).toBe(DEVICE);

    const journals = (await t.provider.list(t.connB, scopeDevicePrefix(SCOPE, DEVICE))).filter(
      (e) => parseJournalSeq(e.path) !== null,
    );
    expect(journals).toHaveLength(1);

    const routing = await readRouting(t.kv);
    expect(routing.connections.map((c) => c.connectionId)).toEqual([t.connA.connectionId]);
    expect(routing.bindings.get(SCOPE.slice('profile:'.length))).toBe('local');
    expect(t.disconnected).toEqual([t.connB.connectionId]);
    expect(
      await t.kv.get('local', `${DISCONNECT_PENDING_PREFIX}${t.connB.connectionId}`),
    ).toBeUndefined();
  });

  test('system connection cannot disconnect while other connections remain', async () => {
    const t = await harness();
    await expect(runConnectionDisconnect(t.disconnectDeps(), t.connA)).rejects.toThrow(
      SystemConnectionRequiredError,
    );
    expect(await t.provider.list(t.connA, DISCONNECT_MARKER_PATH)).toHaveLength(0);
  });

  test('unreachable provider → pending flag; completePendingDisconnects finishes it later', async () => {
    const t = await harness();
    const failing = t.disconnectDeps({
      providerFor: () => {
        throw new ProviderError('network', 'offline');
      },
    });
    const result = await runConnectionDisconnect(failing, t.connB);
    expect(result.status).toBe('pending');
    expect(
      await t.kv.get('local', `${DISCONNECT_PENDING_PREFIX}${t.connB.connectionId}`),
    ).toBeDefined();
    expect(t.disconnected).toHaveLength(0);

    const done = await completePendingDisconnects(t.disconnectDeps());
    expect(done).toEqual([t.connB.connectionId]);
    expect(await t.provider.list(t.connB, DISCONNECT_MARKER_PATH)).toHaveLength(1);
    expect(t.disconnected).toEqual([t.connB.connectionId]);
  });

  test('quota error on marker write is fatal, not pending', async () => {
    const t = await harness();
    t.provider.failNext(1, 'quota');
    await expect(
      runConnectionDisconnect(t.disconnectDeps(), t.connB),
    ).rejects.toThrow();
    expect(
      await t.kv.get('local', `${DISCONNECT_PENDING_PREFIX}${t.connB.connectionId}`),
    ).toBeUndefined();
  });
});

export {};
