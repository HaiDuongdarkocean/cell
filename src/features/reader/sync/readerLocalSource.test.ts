import 'fake-indexeddb/auto';
import type { ChangeRecord, Hlc, Scope } from '@/features/sync';
import {
  clearOpaqueRecords,
  configureSyncRuntime,
  deleteSyncDB,
  getAllOpaqueRecords,
  resetSyncRuntime,
} from '@/features/sync';
import {
  closeDB,
  DB_NAME,
  deleteBook,
  getBook,
  getProgress,
  saveBook,
  saveProgress,
  STORES,
  type BookRecord,
} from '../services/readerRepository';
import { createReaderLocalSource } from './readerLocalSource';

const SCOPE = 'profile:en' as const;

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

async function metaOp(key: string): Promise<string | undefined> {
  const meta = await getMeta(key);
  return meta?.op;
}

async function getMeta(
  key: string,
): Promise<{ op: string; hlc: Hlc; firstHlc?: Hlc } | undefined> {
  const db = await openRaw();
  const tx = db.transaction(STORES.SYNC_META, 'readonly');
  const meta = (await reqToPromise(tx.objectStore(STORES.SYNC_META).get(key))) as
    | { op: string; hlc: Hlc; firstHlc?: Hlc }
    | undefined;
  db.close();
  return meta;
}

const farFuture = (): Hlc => ({ wall: Date.now() + 1_000_000, counter: 0, node: 'devB' });
const farPast = (): Hlc => ({ wall: 1, counter: 0, node: 'devB' });

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

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  resetSyncRuntime();
  closeDB();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
  await clearOpaqueRecords();
  configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
});

afterEach(() => {
  closeDB();
  resetSyncRuntime();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  await deleteSyncDB();
});

describe('readerLocalSource — readerBook', () => {
  it('expands a book pending key into entity + leaf records', async () => {
    const source = createReaderLocalSource('readerBook');
    await saveBook(makeBook('b1', 'en'));

    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: SCOPE, dataClass: 'readerBook', key: 'book:b1', op: 'put' },
    ]);
    const records = await source.resolve(pending);
    const keys = records.map((record) => record.key).sort();
    expect(keys).toEqual([
      'book:b1',
      'book:b1/filename',
      'book:b1/languageCode',
      'book:b1/title',
    ]);
    expect(records.find((r) => r.key === 'book:b1')?.value).toMatchObject({
      id: 'b1',
      title: 'Book b1',
    });
    await source.ack(pending);
    expect((await allOutbox()).filter((row) => row.key === 'book:b1')).toEqual([]);
  });

  it('snapshot scopes books by languageCode and tombstones stay visible', async () => {
    const source = createReaderLocalSource('readerBook');
    await saveBook(makeBook('b1', 'en'));
    await saveBook(makeBook('b2', null));
    await deleteBook('b2');

    const en: ChangeRecord[] = [];
    for await (const record of source.snapshot(SCOPE)) en.push(record);
    expect(en.map((r) => r.key)).toEqual(expect.arrayContaining(['book:b1']));
    expect(en.some((r) => r.key.startsWith('book:b2'))).toBe(false);

    const globalScope: ChangeRecord[] = [];
    for await (const record of source.snapshot('global' as Scope)) globalScope.push(record);
    expect(globalScope).toEqual([
      expect.objectContaining({ key: 'book:b2', op: 'delete' }),
    ]);
  });

  it('applies a newer remote book put and cascades its tombstone', async () => {
    const bookSource = createReaderLocalSource('readerBook');
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({
      bookId: 'b1',
      paragraphIndex: 2,
      tokenIndex: 1,
      updatedAt: 't',
      readTimeMs: 100,
    });
    const outboxBefore = (await allOutbox()).length;

    const putResult = await bookSource.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerBook',
        key: 'book:b1',
        op: 'put',
        value: { ...makeBook('b1', 'en'), title: 'Remote Title' },
        hlc: farFuture(),
      },
    ]);
    expect(putResult.applied).toHaveLength(1);
    expect((await getBook('b1'))?.title).toBe('Remote Title');
    expect((await allOutbox()).length).toBe(outboxBefore);

    const delResult = await bookSource.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerBook',
        key: 'book:b1',
        op: 'delete',
        hlc: { wall: Date.now() + 2_000_000, counter: 0, node: 'devB' },
      },
    ]);
    expect(delResult.applied).toHaveLength(1);
    expect(await getBook('b1')).toBeUndefined();
    expect(await getProgress('b1')).toBeUndefined();
    expect(await metaOp('progress:b1/position')).toBe('delete');
    expect(await metaOp('progress:b1/readTime/devA')).toBe('delete');
  });

  it('keeps local book on older remote put', async () => {
    const bookSource = createReaderLocalSource('readerBook');
    await saveBook(makeBook('b1', 'en'));
    const result = await bookSource.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerBook',
        key: 'book:b1',
        op: 'put',
        value: { ...makeBook('b1', 'en'), title: 'Stale' },
        hlc: farPast(),
      },
    ]);
    expect(result.localWon).toHaveLength(1);
    expect((await getBook('b1'))?.title).toBe('Book b1');
  });
});

describe('readerLocalSource — readerProgress', () => {
  it('round-trips position + own-device readTime through pending/resolve/ack', async () => {
    const source = createReaderLocalSource('readerProgress');
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({
      bookId: 'b1',
      paragraphIndex: 3,
      tokenIndex: 4,
      updatedAt: 't1',
      readTimeMs: 100,
    });

    const pending = await source.pending(10);
    expect(pending.map((p) => p.key).sort()).toEqual([
      'progress:b1/position',
      'progress:b1/readTime/devA',
    ]);
    const records = await source.resolve(pending);
    const position = records.find((r) => r.key === 'progress:b1/position');
    const readTime = records.find((r) => r.key === 'progress:b1/readTime/devA');
    expect(position?.value).toMatchObject({ paragraphIndex: 3, tokenIndex: 4, updatedAt: 't1' });
    expect(readTime?.value).toBe(100);
    await source.ack(pending);
    expect((await allOutbox()).filter((row) => row.key.startsWith('progress:'))).toEqual([]);
  });

  it('merges remote readTime buckets per device without echo', async () => {
    const source = createReaderLocalSource('readerProgress');
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({
      bookId: 'b1',
      paragraphIndex: 1,
      tokenIndex: 0,
      updatedAt: 't',
      readTimeMs: 100,
    });
    const outboxBefore = (await allOutbox()).length;

    const result = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/readTime/devB',
        op: 'put',
        value: 250,
        hlc: farFuture(),
      },
    ]);
    expect(result.applied).toHaveLength(1);
    const stored = await getProgress('b1');
    expect(stored?.readTimeByDevice).toEqual({ devA: 100, devB: 250 });
    expect(stored?.readTimeMs).toBe(350);
    expect((await allOutbox()).length).toBe(outboxBefore);
  });

  it('keeps the larger local readTime bucket and reports localWon', async () => {
    const source = createReaderLocalSource('readerProgress');
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({
      bookId: 'b1',
      paragraphIndex: 1,
      tokenIndex: 0,
      updatedAt: 't',
      readTimeMs: 500,
    });
    const meta = await getMeta('progress:b1/readTime/devA');

    const result = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/readTime/devA',
        op: 'put',
        value: 100,
        hlc: farFuture(),
        firstHlc: meta?.firstHlc ?? meta?.hlc,
      },
    ]);
    expect(result.localWon).toHaveLength(1);
    expect((await getProgress('b1'))?.readTimeByDevice).toEqual({ devA: 500 });
  });

  it('removes only the targeted bucket on remote readTime delete', async () => {
    const source = createReaderLocalSource('readerProgress');
    await saveBook(makeBook('b1', 'en'));
    await saveProgress({
      bookId: 'b1',
      paragraphIndex: 1,
      tokenIndex: 0,
      updatedAt: 't',
      readTimeMs: 100,
    });
    await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/readTime/devB',
        op: 'put',
        value: 250,
        hlc: farFuture(),
      },
    ]);
    const del = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/readTime/devB',
        op: 'delete',
        hlc: { wall: Date.now() + 3_000_000, counter: 0, node: 'devB' },
      },
    ]);
    expect(del.applied).toHaveLength(1);
    const stored = await getProgress('b1');
    expect(stored?.readTimeByDevice).toEqual({ devA: 100 });
    expect(stored?.readTimeMs).toBe(100);
    expect(stored?.paragraphIndex).toBe(1);
  });

  it('stashes unmaterializable progress records as opaque', async () => {
    const source = createReaderLocalSource('readerProgress');
    const result = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/bogus',
        op: 'put',
        value: 1,
        hlc: farFuture(),
      },
      {
        scope: SCOPE,
        dataClass: 'readerProgress',
        key: 'progress:b1/readTime/devC',
        op: 'put',
        value: 'not-a-number',
        hlc: farFuture(),
      },
    ]);
    expect(result.opaque).toHaveLength(2);
    expect((await getAllOpaqueRecords(SCOPE)).map((row) => row.recordKey).sort()).toEqual([
      'progress:b1/bogus',
      'progress:b1/readTime/devC',
    ]);
  });
});
