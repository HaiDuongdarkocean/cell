import 'fake-indexeddb/auto';
import type {
  SrsCard,
  SrsCollection,
  SrsDeck,
  SrsFsrsSerializedState,
  SrsMemoryComponent,
  SrsNote,
} from '@/entities/srs/types';
import type { ChangeRecord, Hlc, Scope } from '@/features/sync';
import {
  clearOpaqueRecords,
  configureSyncRuntime,
  deleteSyncDB,
  getAllOpaqueRecords,
  resetSyncRuntime,
} from '@/features/sync';
import { putCollection } from '../repositories/collectionRepository';
import { putDeck, deleteDeck } from '../repositories/deckRepository';
import { putNote } from '../repositories/noteRepository';
import { putCard, getCard, deleteCard } from '../repositories/cardRepository';
import {
  SRS_STORES,
  clearAllSrsStores,
  closeAllSrsDBs,
  deleteSrsDB,
  getSrsDB,
  getSrsDbName,
} from '../repositories/srsDatabase';
import { createSrsLocalSource, type SrsDataClass } from './srsLocalSource';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

interface OutboxRow {
  scope: string;
  dataClass: string;
  key: string;
  op: string;
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allOutbox(): Promise<OutboxRow[]> {
  const db = await getSrsDB();
  const tx = db.transaction(SRS_STORES.SYNC_OUTBOX, 'readonly');
  return (await reqToPromise(tx.objectStore(SRS_STORES.SYNC_OUTBOX).getAll())) as OutboxRow[];
}

async function metaOp(key: string, scope = 'profile:en'): Promise<string | undefined> {
  const db = await getSrsDB();
  const tx = db.transaction(SRS_STORES.SYNC_META, 'readonly');
  const meta = (await reqToPromise(
    tx.objectStore(SRS_STORES.SYNC_META).get(`${scope}|${key}`),
  )) as { op: string } | undefined;
  return meta?.op;
}

const farFuture = (counter = 0): Hlc => ({ wall: Date.now() + 1_000_000 + counter, counter: 0, node: 'devB' });
const farPast = (): Hlc => ({ wall: 1, counter: 0, node: 'devB' });

const makeCollection = (id: string): SrsCollection => ({
  id,
  languageProfileId: null,
  targetLanguage: 'en',
  name: `Collection ${id}`,
  defaultStudyConfigId: `sc-${id}`,
  defaultDeckId: `deck-${id}`,
  defaultNotetypeId: `nt-${id}`,
  createdAt: 1,
});

const makeDeck = (id: string, collectionId: string): SrsDeck => ({
  id,
  collectionId,
  parentId: null,
  name: `Deck ${id}`,
  order: 0,
  studyConfigId: `sc-${collectionId}`,
});

const makeNote = (id: string, deckId: string): SrsNote => ({
  id,
  notetypeId: 'nt-c1',
  deckId,
  targetWord: `word-${id}`,
  fields: {},
  createdAt: 1,
});

const fsrsState = (): SrsFsrsSerializedState => ({
  version: 1,
  due: '2026-01-01T00:00:00.000Z',
  stability: 1,
  difficulty: 1,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  learningSteps: 0,
  state: 0,
});

const component = (type: 'meaning' | 'sound' | 'spelling'): SrsMemoryComponent => ({
  type,
  progress: 0,
  exploreCount: 0,
  fsrsState: fsrsState(),
  reviewCount: 0,
});

const makeCard = (id: string, noteId = 'n1', deckId = 'd1'): SrsCard => ({
  id,
  noteId,
  deckId,
  components: {
    meaning: component('meaning'),
    sound: component('sound'),
    spelling: component('spelling'),
  },
  studyAgainDue: { meaning: null, sound: null, spelling: null },
  createdAt: 1,
  nextDue: '2026-01-01T00:00:00.000Z',
  maintenanceMode: false,
});

async function seedGraph(): Promise<void> {
  await putCollection(makeCollection('c1'));
  await putDeck(makeDeck('d1', 'c1'));
  await putNote(makeNote('n1', 'd1'));
}

async function snapshotKeys(scope: Scope, dataClass: SrsDataClass): Promise<ChangeRecord[]> {
  const out: ChangeRecord[] = [];
  const source = createSrsLocalSource(dataClass);
  for await (const record of source.snapshot(scope)) out.push(record);
  return out;
}

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  resetSyncRuntime();
  closeAllSrsDBs();
  await clearAllSrsStores();
  await clearOpaqueRecords();
});

afterEach(() => {
  resetSyncRuntime();
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
  await deleteSyncDB();
});

describe('srsLocalSource — pending/resolve/ack', () => {
  beforeEach(() => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
  });

  it('drains captured card keys, resolves them, and ack removes only drained rows', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard(makeCard('card1'));

    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:card1', op: 'put' },
    ]);

    const records = await source.resolve(pending);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      scope: 'profile:en',
      dataClass: 'srsCard',
      key: 'cards:card1',
      op: 'put',
    });
    expect(records[0].value).toMatchObject({ id: 'card1', noteId: 'n1', deckId: 'd1' });
    expect(records[0].hlc.node).toMatch(/^devA:/);

    await source.ack(pending);
    const rows = await allOutbox();
    expect(rows.filter((row) => row.key === 'cards:card1')).toEqual([]);
    expect(rows.some((row) => row.key === 'collections:c1')).toBe(true);
  });

  it('dedupes repeated writes and keeps rows written between drain and ack', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard(makeCard('card1'));
    await putCard({ ...makeCard('card1'), maintenanceMode: true });

    const pending = await source.pending(10);
    expect(pending).toHaveLength(1);

    await putNote(makeNote('n2', 'd1'));
    await putCard(makeCard('card2', 'n2'));
    await source.ack(pending);

    const rows = await allOutbox();
    expect(rows.filter((row) => row.key === 'cards:card1')).toEqual([]);
    expect(rows.filter((row) => row.key === 'cards:card2')).toHaveLength(1);

    const next = await source.pending(10);
    expect(next.map((k) => k.key)).toEqual(['cards:card2']);
  });

  it('resolves deletes as tombstones', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard(makeCard('card1'));
    await deleteCard('card1');

    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:card1', op: 'delete' },
    ]);
    const records = await source.resolve(pending);
    expect(records).toHaveLength(1);
    expect(records[0].op).toBe('delete');
    expect(records[0].value).toBeUndefined();
  });
});

describe('srsLocalSource — snapshot', () => {
  beforeEach(() => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
  });

  it('emits only rows of the requested scope', async () => {
    await seedGraph();
    const en = await snapshotKeys('profile:en', 'srsDeck');
    expect(en.map((r) => r.key)).toEqual(['decks:d1']);
    expect(en[0].op).toBe('put');

    const fr = await snapshotKeys('profile:fr', 'srsDeck');
    expect(fr).toEqual([]);
  });

  it('mints stable meta for rows written while capture was disabled', async () => {
    configureSyncRuntime({ enabled: false, deviceId: 'devA' });
    const db = await getSrsDB();
    const tx = db.transaction(SRS_STORES.COLLECTIONS, 'readwrite');
    tx.objectStore(SRS_STORES.COLLECTIONS).put(makeCollection('c9'));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const first = await snapshotKeys('profile:en', 'srsCollection');
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ key: 'collections:c9', op: 'put' });
    const minted = first[0].hlc;
    expect(await metaOp('collections:c9')).toBeUndefined();

    await createSrsLocalSource('srsCollection').stampCommitted(first);
    expect(await metaOp('collections:c9')).toBe('put');

    const second = await snapshotKeys('profile:en', 'srsCollection');
    expect(second[0].hlc).toEqual(minted);
    expect((await allOutbox()).filter((row) => row.key === 'collections:c9')).toEqual([]);
  });

  it('includes stored tombstones in the scope', async () => {
    await seedGraph();
    await deleteDeck('d1');
    const records = await snapshotKeys('profile:en', 'srsDeck');
    expect(records).toEqual([
      expect.objectContaining({ key: 'decks:d1', op: 'delete' }),
    ]);
  });
});

describe('srsLocalSource — applyRemote', () => {
  beforeEach(() => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
  });

  it('applies a newer remote put and writes no outbox rows', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard(makeCard('card1'));
    const before = (await allOutbox()).length;

    const remote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsCard',
      key: 'cards:card1',
      op: 'put',
      value: { ...makeCard('card1'), maintenanceMode: true, nextDue: '2030-01-01T00:00:00.000Z' },
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);
    expect(result.localWon).toHaveLength(0);

    const stored = await getCard('card1');
    expect(stored.maintenanceMode).toBe(true);
    expect((await allOutbox()).length).toBe(before);
    expect(await metaOp('cards:card1')).toBe('put');
  });

  it('keeps the local row and reports localWon for an older remote put', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard({ ...makeCard('card1'), maintenanceMode: true });

    const remote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsCard',
      key: 'cards:card1',
      op: 'put',
      value: { ...makeCard('card1'), maintenanceMode: false },
      hlc: farPast(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(0);
    expect(result.localWon).toHaveLength(1);
    expect((await getCard('card1')).maintenanceMode).toBe(true);
  });

  it('cascades a remote deck tombstone through notes and cards', async () => {
    const source = createSrsLocalSource('srsDeck');
    await seedGraph();
    await putCard(makeCard('card1'));
    const outboxBefore = await allOutbox();

    const remote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsDeck',
      key: 'decks:d1',
      op: 'delete',
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);

    const db = await getSrsDB();
    const tx = db.transaction(
      [SRS_STORES.DECKS, SRS_STORES.NOTES, SRS_STORES.CARDS],
      'readonly',
    );
    expect(
      await reqToPromise(tx.objectStore(SRS_STORES.DECKS).get('d1')),
    ).toBeUndefined();
    expect(
      await reqToPromise(tx.objectStore(SRS_STORES.NOTES).get('n1')),
    ).toBeUndefined();
    expect(
      await reqToPromise(tx.objectStore(SRS_STORES.CARDS).get('card1')),
    ).toBeUndefined();

    expect(await metaOp('notes:n1')).toBe('delete');
    expect(await metaOp('cards:card1')).toBe('delete');
    expect((await allOutbox()).length).toBe(outboxBefore.length);
  });

  it('suppresses child puts under a tombstoned parent into opaque', async () => {
    const deckSource = createSrsLocalSource('srsDeck');
    const noteSource = createSrsLocalSource('srsNote');
    await seedGraph();
    const remoteDelete: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsDeck',
      key: 'decks:d1',
      op: 'delete',
      hlc: farFuture(),
    };
    await deckSource.applyRemote([remoteDelete]);

    const remoteNote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsNote',
      key: 'notes:n2',
      op: 'put',
      value: makeNote('n2', 'd1'),
      hlc: farFuture(1),
    };
    const result = await noteSource.applyRemote([remoteNote]);
    expect(result.opaque).toHaveLength(1);
    expect(result.applied).toHaveLength(0);
    expect(await getAllOpaqueRecords('profile:en')).toEqual([
      expect.objectContaining({ recordKey: 'notes:n2' }),
    ]);

    const db = await getSrsDB();
    const tx = db.transaction(SRS_STORES.NOTES, 'readonly');
    expect(await reqToPromise(tx.objectStore(SRS_STORES.NOTES).get('n2'))).toBeUndefined();
  });

  it('stashes records with malformed keys as opaque', async () => {
    const source = createSrsLocalSource('srsCard');
    const remote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'srsCard',
      key: 'cards:',
      op: 'put',
      value: {},
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.opaque).toHaveLength(1);
  });

  it('marks foreign data classes ignored', async () => {
    const source = createSrsLocalSource('srsCard');
    const remote: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'readerBook',
      key: 'book:b1',
      op: 'put',
      value: {},
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(0);
    expect(result.opaque).toHaveLength(0);
  });

  it('current returns live records and null for missing keys', async () => {
    const source = createSrsLocalSource('srsCard');
    await seedGraph();
    await putCard(makeCard('card1'));
    const map = await source.current('profile:en', ['cards:card1', 'cards:gone']);
    expect(map.get('cards:card1')).toMatchObject({ op: 'put', key: 'cards:card1' });
    expect(map.get('cards:gone')).toBeNull();
  });
});
