import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, beforeAll, afterAll, afterEach } from '@jest/globals';
import {
  saveBook,
  deleteBook,
  getBook,
  saveProgress,
  getProgress,
  closeDB,
  DB_NAME,
  STORES,
  type BookRecord,
} from './readerRepository';
import { configureSyncRuntime, resetSyncRuntime } from '@/features/sync';

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

function openRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allOutbox(): Promise<OutboxRow[]> {
  const db = await openRaw();
  const tx = db.transaction(STORES.SYNC_OUTBOX, 'readonly');
  const rows = (await reqToPromise(tx.objectStore(STORES.SYNC_OUTBOX).getAll())) as OutboxRow[];
  db.close();
  return rows;
}

const makeBook = (id: string, languageCode: string | null): BookRecord => ({
  id,
  filename: `${id}.txt`,
  title: `Book ${id}`,
  languageCode,
  paragraphs: ['one', 'two'],
  addedAt: '2025-01-01T00:00:00.000Z',
  lastReadAt: '2025-01-01T00:00:00.000Z',
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

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  resetSyncRuntime();
  closeDB();
});

afterEach(async () => {
  closeDB();
  resetSyncRuntime();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('reader sync capture', () => {
  it('writes nothing when sync is disabled', async () => {
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({ bookId: 'b1', paragraphIndex: 1, tokenIndex: 2, updatedAt: 't' });
    expect(await allOutbox()).toEqual([]);
  });

  it('captures book put in the profile scope', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await saveBook(makeBook('b1', 'en'));
    expect(await allOutbox()).toEqual([
      expect.objectContaining({ scope: 'profile:en', dataClass: 'readerBook', key: 'book:b1', op: 'put' }),
    ]);
  });

  it('captures book with no language into the global scope', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await saveBook(makeBook('b1', null));
    expect(await allOutbox()).toEqual([
      expect.objectContaining({ scope: 'global', key: 'book:b1' }),
    ]);
  });

  it('captures position + per-device readTime records', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({ bookId: 'b1', paragraphIndex: 3, tokenIndex: 0, updatedAt: 't', readTimeMs: 100 });
    const rows = await allOutbox();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'progress:b1/position', dataClass: 'readerProgress', op: 'put' }),
        expect.objectContaining({ key: 'progress:b1/readTime/devA', dataClass: 'readerProgress', op: 'put' }),
      ]),
    );
    const stored = await getProgress('b1');
    expect(stored?.readTimeByDevice).toEqual({ devA: 100 });
  });

  it('merges this-device readTime into readTimeByDevice on subsequent saves', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({ bookId: 'b1', paragraphIndex: 1, tokenIndex: 0, updatedAt: 't', readTimeMs: 100 });
    await saveProgress({ bookId: 'b1', paragraphIndex: 2, tokenIndex: 0, updatedAt: 't2', readTimeMs: 250 });
    const stored = await getProgress('b1');
    expect(stored?.readTimeByDevice).toEqual({ devA: 250 });
  });

  it('deleteBook emits tombstones for book + progress records', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({ bookId: 'b1', paragraphIndex: 1, tokenIndex: 0, updatedAt: 't', readTimeMs: 10 });
    await deleteBook('b1');
    const rows = await allOutbox();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'book:b1', op: 'delete' }),
        expect.objectContaining({ key: 'progress:b1/position', op: 'delete' }),
        expect.objectContaining({ key: 'progress:b1/readTime/devA', op: 'delete' }),
      ]),
    );
    expect(await getBook('b1')).toBeUndefined();
    expect(await getProgress('b1')).toBeUndefined();
  });
});
