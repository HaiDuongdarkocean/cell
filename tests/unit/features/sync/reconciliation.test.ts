import 'fake-indexeddb/auto';
import { InMemoryKeyValueStore } from '@/features/sync/adapters/memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from '@/features/sync/adapters/memory/InMemoryStorageProvider';
import { SeededClock } from '@/features/sync/adapters/memory/SeededClock';
import { closeSyncDB, deleteSyncDB } from '@/features/sync/adapters/local/syncDb';
import type { ChangeRecord, Connection, Scope } from '@/features/sync/domain/types';
import type { StorageProvider } from '@/features/sync/ports/storageProvider';
import { configureSyncRuntime, resetSyncRuntime } from '@/features/sync/adapters/local/idb/capture';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  clearAllSrsStores,
  closeAllSrsDBs,
  deleteSrsDB,
  getSrsDbName,
} from '@/features/srs/repositories/srsDatabase';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { createDefaultNotetype } from '@/features/srs/lib/defaultNotetype';
import { createSrsLocalSource } from '@/features/srs/sync/srsLocalSource';
import { createSrsSyncAccess } from '@/features/srs/sync/srsSyncAccess';
import type { SrsCollection, SrsDeck, SrsNote, SrsStudyConfig } from '@/entities/srs/types';
import { decodeSnapshot } from '@/features/sync/app/wireCodec';
import { journalPath } from '@/features/sync/app/remotePaths';
import { encodeJournal } from '@/features/sync/app/wireCodec';
import {
  runScopeReconciliation,
  setActiveProfileAfterRestore,
  type ReconcileDeps,
} from '@/features/sync/app/reconciliation';
import { createSyncDbStore } from '@/features/sync/app/syncDbStore';
import { stampKvMeta } from '@/features/sync/adapters/local/kv/kvMeta';

const DEVICE = 'dev-me';
const REMOTE = 'dev-remote';
const SCOPE: Scope = 'profile:en';

const store = new Map<string, unknown>();
const storageLocalGetMock = jest.fn(
  async (keys: string | string[] | null): Promise<Record<string, unknown>> => {
    if (keys === null) return Object.fromEntries(store);
    const list = typeof keys === 'string' ? [keys] : keys;
    const out: Record<string, unknown> = {};
    for (const key of list) if (store.has(key)) out[key] = store.get(key);
    return out;
  },
);
const storageLocalSetMock = jest.fn(async (items: Record<string, unknown>): Promise<void> => {
  for (const [key, value] of Object.entries(items)) store.set(key, value);
});

const makeCollection = (id: string, name = `Collection ${id}`): SrsCollection => ({
  id,
  languageProfileId: 'profile-en',
  targetLanguage: 'en',
  name,
  defaultStudyConfigId: `sc-${id}`,
  defaultDeckId: `deck-${id}`,
  defaultNotetypeId: `default-word-${id}`,
  createdAt: 1,
});

const makeDeck = (id: string, collectionId: string): SrsDeck =>
  ({
    id,
    collectionId,
    parentId: null,
    name: 'Default',
    order: 0,
    studyConfigId: `sc-${collectionId}`,
  }) as SrsDeck;

const makeNote = (id: string, deckId: string, notetypeId: string): SrsNote =>
  ({
    id,
    deckId,
    notetypeId,
    targetWord: `word-${id}`,
    fields: { target: { kind: 'text', value: `word-${id}` } },
    createdAt: 1,
  }) as unknown as SrsNote;

async function seedLocalCollection(id: string, notes = 0): Promise<void> {
  await putStudyConfig({ id: `sc-${id}` } as unknown as SrsStudyConfig);
  await putNotetype(createDefaultNotetype(id));
  await putCollection(makeCollection(id));
  await putDeck(makeDeck(`deck-${id}`, id));
  for (let i = 0; i < notes; i++) {
    await putNote(makeNote(`note-${id}-${i}`, `deck-${id}`, `default-word-${id}`));
  }
}

async function harness(): Promise<{ deps: ReconcileDeps; provider: InMemoryStorageProvider }> {
  const provider = new InMemoryStorageProvider({ providerId: 'mem' });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: `mem:${account.accountKey}` as Connection['connectionId'],
    providerId: 'mem',
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  const blobStore = new Map<string, Blob>();
  const deps: ReconcileDeps = {
    provider,
    connection,
    kv: new InMemoryKeyValueStore(),
    store: createSyncDbStore(),
    sources: [
      createSrsLocalSource('srsCollection'),
      createSrsLocalSource('srsDeck'),
      createSrsLocalSource('srsNotetype'),
      createSrsLocalSource('studyConfig'),
      createSrsLocalSource('srsNote'),
    ],
    blobs: { read: async (hash: string) => blobStore.get(hash) ?? null },
    srs: createSrsSyncAccess(),
    deviceId: DEVICE,
    clock: new SeededClock(1000),
    fence: async () => undefined,
  };
  return { deps, provider };
}

async function remoteJournal(
  provider: StorageProvider,
  connection: Connection,
  records: ChangeRecord[],
): Promise<void> {
  await provider.write(
    connection,
    journalPath(SCOPE, REMOTE, 1),
    encodeJournal({ scope: SCOPE, deviceId: REMOTE, seq: 1, records }),
  );
}

async function ownSnapshotRecords(
  provider: StorageProvider,
  connection: Connection,
): Promise<ChangeRecord[]> {
  const entries = await provider.list(
    connection,
    `cell-sync/v1/scopes/${SCOPE}/devices/${DEVICE}/`,
  );
  const snap = entries.find((e) => e.path.includes('snapshot-'));
  expect(snap).toBeDefined();
  const blob = await provider.read(connection, snap!.path);
  return (await decodeSnapshot(blob)).records;
}

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(async () => {
  store.clear();
  resetSyncRuntime();
  closeAllSrsDBs();
  await clearAllSrsStores();
  configureSyncRuntime({ enabled: true, deviceId: DEVICE, lastWall: 1 });
});

afterEach(() => {
  resetSyncRuntime();
  closeAllSrsDBs();
  closeSyncDB();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  await deleteSrsDB(await getSrsDbName());
  await deleteSyncDB();
});

describe('runScopeReconciliation', () => {
  it('pulls remote, skips the empty auto-created collection, and publishes a snapshot', async () => {
    const { deps, provider } = await harness();
    await seedLocalCollection('c-local');
    const remoteCollection = makeCollection('c-remote', 'Remote SRS');
    await remoteJournal(deps.provider, deps.connection, [
      { scope: SCOPE, dataClass: 'srsCollection', key: 'collections:c-remote', op: 'put', value: remoteCollection, hlc: { wall: 50, counter: 0, node: `${REMOTE}:ctx` } },
    ]);

    const result = await runScopeReconciliation(deps, SCOPE);
    expect(result.recordsPublished).toBeGreaterThan(0);
    expect(result.skippedCollections).toEqual(
      expect.arrayContaining(['collections:c-local', 'decks:deck-c-local', 'studyConfigs:sc-c-local', 'notetypes:default-word-c-local']),
    );
    expect(result.snapshotN).toBe(1);

    const records = await ownSnapshotRecords(provider, deps.connection);
    const keys = records.map((r) => r.key);
    expect(keys).toContain('collections:c-remote');
    expect(keys).not.toContain('collections:c-local');
    expect(keys).not.toContain('decks:deck-c-local');
    expect(keys).not.toContain('studyConfigs:sc-c-local');
    expect(keys).not.toContain('notetypes:nt-c-local');
  });

  it('publishes a non-empty local collection even when remote has one', async () => {
    const { deps, provider } = await harness();
    await seedLocalCollection('c-local', 2);
    await remoteJournal(deps.provider, deps.connection, [
      { scope: SCOPE, dataClass: 'srsCollection', key: 'collections:c-remote', op: 'put', value: makeCollection('c-remote'), hlc: { wall: 50, counter: 0, node: `${REMOTE}:ctx` } },
    ]);

    await runScopeReconciliation(deps, SCOPE);
    const keys = (await ownSnapshotRecords(provider, deps.connection)).map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['collections:c-local', 'collections:c-remote']));
  });

  it('publishes the empty local collection when remote has no collection', async () => {
    const { deps, provider } = await harness();
    await seedLocalCollection('c-local');
    await runScopeReconciliation(deps, SCOPE);
    const keys = (await ownSnapshotRecords(provider, deps.connection)).map((r) => r.key);
    expect(keys).toContain('collections:c-local');
  });

  it('publishes nothing when the connection was disconnected remotely', async () => {
    const { deps, provider } = await harness();
    await seedLocalCollection('c-local', 1);
    await stampKvMeta(deps.kv, [
      {
        scope: 'global',
        dataClass: 'syncDirectory',
        key: `connection:${deps.connection.connectionId}`,
        op: 'put',
        value: { connectionId: deps.connection.connectionId },
        hlc: { wall: 1, counter: 0, node: `${DEVICE}:ctx` },
      },
    ]);
    await provider.write(
      deps.connection,
      'cell-sync/v1/meta/disconnect.json',
      new Blob([
        JSON.stringify({
          formatVersion: 1,
          kind: 'disconnect',
          hlc: { wall: 5000, counter: 0, node: `${REMOTE}:ctx` },
        }),
      ]),
    );

    const result = await runScopeReconciliation(deps, SCOPE);

    expect(result.recordsPublished).toBe(0);
    const entries = await provider.list(
      deps.connection,
      `cell-sync/v1/scopes/${SCOPE}/devices/${DEVICE}/`,
    );
    expect(entries).toEqual([]);
  });

  it('acks pending keys subsumed by the snapshot', async () => {
    const { deps } = await harness();
    await seedLocalCollection('c-nonempty', 1);
    await remoteJournal(deps.provider, deps.connection, [
      { scope: SCOPE, dataClass: 'srsCollection', key: 'collections:c-remote', op: 'put', value: makeCollection('c-remote'), hlc: { wall: 50, counter: 0, node: `${REMOTE}:ctx` } },
    ]);
    const before = await collectAllPending(deps);
    expect(before.length).toBeGreaterThan(0);
    const result = await runScopeReconciliation(deps, SCOPE);
    expect(result.ackedKeys).toBe(before.length);
    expect(await collectAllPending(deps)).toEqual([]);
  });
});

async function collectAllPending(deps: ReconcileDeps) {
  const { collectPendingKeys } = await import('@/features/sync/app/pushCycle');
  return collectPendingKeys(deps.sources, 1000);
}

describe('setActiveProfileAfterRestore', () => {
  it('sets the active profile to the first restored profile when none was active', async () => {
    store.set(STORAGE_KEYS.SETTINGS, {
      ...DEFAULT_SETTINGS,
      schemaVersion: 32,
      activeProfileId: null,
      languageProfiles: [
        { id: 'profile-ja', target: 'ja', order: 2, name: 'ja' },
        { id: 'profile-en', target: 'en', order: 1, name: 'en' },
      ],
    });
    await setActiveProfileAfterRestore();
    expect((await loadSettings()).activeProfileId).toBe('profile-en');
  });

  it('keeps an existing activeProfileId', async () => {
    store.set(STORAGE_KEYS.SETTINGS, {
      ...DEFAULT_SETTINGS,
      schemaVersion: 32,
      activeProfileId: 'profile-ja',
      languageProfiles: [{ id: 'profile-ja', target: 'ja', order: 1, name: 'ja' }],
    });
    await setActiveProfileAfterRestore();
    expect((await loadSettings()).activeProfileId).toBe('profile-ja');
  });
});
