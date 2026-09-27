import 'fake-indexeddb/auto';
import type { SrsCollection, SrsDeck } from '@/entities/srs/types';
import { putCollection, deleteCollection } from './collectionRepository';
import { putDeck, deleteDeck } from './deckRepository';
import { closeAllSrsDBs, deleteSrsDB, getSrsDB, getSrsDbName, clearAllSrsStores, SRS_STORES } from './srsDatabase';
import { configureSyncRuntime, resetSyncRuntime, type StoredRecordMeta } from '@/features/sync';

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

async function metaFor(key: string): Promise<StoredRecordMeta | undefined> {
  const db = await getSrsDB();
  const tx = db.transaction(SRS_STORES.SYNC_META, 'readonly');
  return (await reqToPromise(tx.objectStore(SRS_STORES.SYNC_META).get(key))) as StoredRecordMeta | undefined;
}

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
});

afterEach(() => {
  resetSyncRuntime();
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

describe('sync capture — disabled runtime', () => {
  it('writes no outbox/meta when sync is not configured', async () => {
    await putCollection(makeCollection('c1'));
    await putDeck(makeDeck('d1', 'c1'));
    expect(await allOutbox()).toEqual([]);
  });
});

describe('sync capture — enabled runtime', () => {
  beforeEach(() => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
  });

  it('putCollection emits the collection record plus its studyConfig in the profile scope', async () => {
    await putCollection(makeCollection('c1'));
    const rows = await allOutbox();
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: 'profile:en', dataClass: 'srsCollection', key: 'collections:c1', op: 'put' }),
        expect.objectContaining({ scope: 'profile:en', dataClass: 'studyConfig', key: 'studyConfigs:sc-c1', op: 'put' }),
      ]),
    );
    const meta = await metaFor('collections:c1');
    expect(meta?.scope).toBe('profile:en');
    expect(meta?.hlc.node).toBe('devA');
  });

  it('putDeck resolves scope through the parent collection chain', async () => {
    await putCollection(makeCollection('c1'));
    await putDeck(makeDeck('d1', 'c1'));
    const rows = await allOutbox();
    const deckRow = rows.find((r) => r.key === 'decks:d1');
    expect(deckRow).toMatchObject({ scope: 'profile:en', dataClass: 'srsDeck', op: 'put' });
    expect(rows.find((r) => r.key === 'studyConfigs:sc-c1')).toBeDefined();
  });

  it('deleteDeck emits a tombstone', async () => {
    await putCollection(makeCollection('c1'));
    await putDeck(makeDeck('d1', 'c1'));
    await deleteDeck('d1');
    const rows = await allOutbox();
    const tombstone = rows.filter((r) => r.key === 'decks:d1' && r.op === 'delete');
    expect(tombstone).toHaveLength(1);
    const meta = await metaFor('decks:d1');
    expect(meta?.op).toBe('delete');
  });

  it('deleteCollection emits a tombstone even after the row is gone from scope reads', async () => {
    await putCollection(makeCollection('c1'));
    await deleteCollection('c1');
    const rows = await allOutbox();
    expect(rows.find((r) => r.key === 'collections:c1' && r.op === 'delete')).toBeDefined();
  });
});
