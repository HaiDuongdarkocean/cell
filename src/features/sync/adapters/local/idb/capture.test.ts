import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  captureChange,
  configureSyncRuntime,
  getDeviceId,
  isCaptureEnabled,
  readRecordMeta,
  resetSyncRuntime,
  setOutboxDirtyNotifier,
  stampRemoteMeta,
  SYNC_META,
  SYNC_OUTBOX,
  type StoredRecordMeta,
} from './capture';
import * as runtimeApis from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { Hlc } from '../../../domain/types';

const DB_NAME = 'capture-test';

interface OutboxRow {
  scope: string;
  dataClass: string;
  key: string;
  op: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const outbox = db.createObjectStore(SYNC_OUTBOX, { autoIncrement: true });
      outbox.createIndex('by_key', 'key', { unique: false });
      const meta = db.createObjectStore(SYNC_META, { keyPath: 'key' });
      meta.createIndex('by_recKey', 'recKey', { unique: false });
      db.createObjectStore('entity', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allOutbox(db: IDBDatabase): Promise<OutboxRow[]> {
  const tx = db.transaction(SYNC_OUTBOX, 'readonly');
  return (await reqToPromise(tx.objectStore(SYNC_OUTBOX).getAll())) as OutboxRow[];
}

async function allMeta(db: IDBDatabase): Promise<StoredRecordMeta[]> {
  const tx = db.transaction(SYNC_META, 'readonly');
  return (await reqToPromise(tx.objectStore(SYNC_META).getAll())) as StoredRecordMeta[];
}

async function inWriteTx<T>(db: IDBDatabase, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const tx = db.transaction(['entity', SYNC_OUTBOX, SYNC_META], 'readwrite');
  const store = tx.objectStore('entity');
  const result = await fn(store);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

const hlc = (wall: number, counter = 0, node = 'remote'): Hlc => ({ wall, counter, node });

describe('captureChange', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    resetSyncRuntime();
    db = await openDb();
  });

  afterEach(() => {
    db.close();
    resetSyncRuntime();
    indexedDB.deleteDatabase(DB_NAME);
  });

  it('is a no-op when the runtime is disabled', async () => {
    configureSyncRuntime({ enabled: false, deviceId: 'd1' });
    expect(isCaptureEnabled()).toBe(false);
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:1', op: 'put' }),
    );
    expect(await allOutbox(db)).toEqual([]);
    expect(await allMeta(db)).toEqual([]);
  });

  it('writes outbox + meta in the same transaction', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, async (store) => {
      store.put({ id: 'c1' });
      await captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' });
    });
    const outbox = await allOutbox(db);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' });
    const meta = await allMeta(db);
    expect(meta).toHaveLength(1);
    expect(meta[0]!.key).toBe('profile:en|cards:c1');
    expect(meta[0]!.recKey).toBe('cards:c1');
    expect(meta[0]!.scope).toBe('profile:en');
    expect(meta[0]!.op).toBe('put');
    expect(meta[0]!.hlc.node).toMatch(/^d1:.+/);
    expect(meta[0]!.firstHlc).toEqual(meta[0]!.hlc);
  });

  it('keeps firstHlc across subsequent puts', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1', lastWall: 1 });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' }),
    );
    const first = (await allMeta(db))[0]!.firstHlc!;
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' }),
    );
    const meta = (await allMeta(db))[0]!;
    expect(meta.firstHlc).toEqual(first);
    expect(meta.op).toBe('put');
  });

  it('resets firstHlc on put after delete (new lifetime)', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1', lastWall: 1 });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' }),
    );
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'delete' }),
    );
    const afterDelete = (await allMeta(db))[0]!;
    expect(afterDelete.op).toBe('delete');
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' }),
    );
    const afterReput = (await allMeta(db))[0]!;
    expect(afterReput.op).toBe('put');
    expect(afterReput.firstHlc).toEqual(afterReput.hlc);
    expect(afterReput.firstHlc!.wall).toBeGreaterThanOrEqual(afterDelete.firstHlc!.wall);
  });

  it('keeps separate meta rows per (scope, key) — multi-scope records do not thrash', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'studyConfig', key: 'studyConfigs:s1', op: 'put' }),
    );
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:ja', dataClass: 'studyConfig', key: 'studyConfigs:s1', op: 'put' }),
    );
    const metas = await allMeta(db);
    expect(metas.map((m) => m.key).sort()).toEqual(['profile:en|studyConfigs:s1', 'profile:ja|studyConfigs:s1']);
    const enMeta = await readRecordMeta(
      db.transaction(SYNC_META, 'readonly').objectStore(SYNC_META),
      'studyConfigs:s1',
      'profile:en',
    );
    expect(enMeta?.scope).toBe('profile:en');
  });

  it('captures writes whose scope is unresolved as scope:null orphans', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: null, dataClass: 'srsCard', key: 'cards:orphan', op: 'put' }),
    );
    const outbox = await allOutbox(db);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.scope).toBeNull();
    const meta = await readRecordMeta(
      db.transaction(SYNC_META, 'readonly').objectStore(SYNC_META),
      'cards:orphan',
      null,
    );
    expect(meta?.op).toBe('put');
    expect(meta?.scope).toBeNull();
  });

  it('mints unique node ids per runtime (deviceId:contextId)', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:a', op: 'put' }),
    );
    const firstNode = (await allMeta(db))[0]!.hlc.node;
    resetSyncRuntime();
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:b', op: 'put' }),
    );
    const metas = await allMeta(db);
    const secondNode = metas.find((m) => m.recKey === 'cards:b')!.hlc.node;
    expect(firstNode).not.toBe(secondNode);
    expect(firstNode.startsWith('d1:')).toBe(true);
    expect(secondNode.startsWith('d1:')).toBe(true);
  });
});

describe('stampRemoteMeta', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    resetSyncRuntime();
    db = await openDb();
  });

  afterEach(() => {
    db.close();
    resetSyncRuntime();
    indexedDB.deleteDatabase(DB_NAME);
  });

  it('stamps remote hlc without writing outbox', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    await inWriteTx(db, (store) =>
      stampRemoteMeta(store, 'cards:c1', { scope: 'profile:en', hlc: hlc(10), op: 'put' }),
    );
    expect(await allOutbox(db)).toEqual([]);
    const meta = await readRecordMeta(
      db.transaction(SYNC_META, 'readonly').objectStore(SYNC_META),
      'cards:c1',
      'profile:en',
    );
    expect(meta?.hlc).toEqual(hlc(10));
    expect(meta?.firstHlc).toEqual(hlc(10));
  });

  it('keeps the local firstHlc when the remote record omits one', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1', lastWall: 1 });
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c1', op: 'put' }),
    );
    const localFirst = (await allMeta(db))[0]!.firstHlc!;
    await inWriteTx(db, (store) =>
      stampRemoteMeta(store, 'cards:c1', { scope: 'profile:en', hlc: hlc(50), op: 'put' }),
    );
    const meta = await readRecordMeta(
      db.transaction(SYNC_META, 'readonly').objectStore(SYNC_META),
      'cards:c1',
      'profile:en',
    );
    expect(meta?.firstHlc).toEqual(localFirst);
  });

  it('observes the remote hlc so the next local tick exceeds it', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1', lastWall: 1 });
    await inWriteTx(db, (store) =>
      stampRemoteMeta(store, 'cards:c1', { scope: 'profile:en', hlc: hlc(10, 3, 'other'), op: 'put' }),
    );
    await inWriteTx(db, (store) =>
      captureChange(store, { scope: 'profile:en', dataClass: 'srsCard', key: 'cards:c2', op: 'put' }),
    );
    const meta = (await allMeta(db)).find((m) => m.recKey === 'cards:c2')!;
    expect(meta.hlc.wall).toBeGreaterThanOrEqual(10);
    if (meta.hlc.wall === 10) expect(meta.hlc.counter).toBeGreaterThan(3);
  });
});

describe('outbox dirty notifier (SC-1)', () => {
  let db: IDBDatabase;
  const sendSpy = jest.spyOn(runtimeApis, 'sendMessage');

  beforeEach(async () => {
    resetSyncRuntime();
    sendSpy.mockClear().mockResolvedValue(undefined);
    setOutboxDirtyNotifier();
    db = await openDb();
  });

  afterEach(() => {
    db.close();
    resetSyncRuntime();
    setOutboxDirtyNotifier();
    indexedDB.deleteDatabase(DB_NAME);
  });

  it('fires the registered notifier once per committing transaction', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    const notify = jest.fn();
    setOutboxDirtyNotifier(notify);
    await inWriteTx(db, async (store) => {
      await captureChange(store, {
        scope: 'profile:en',
        dataClass: 'srsCard',
        key: 'cards:a',
        op: 'put',
      });
      await captureChange(store, {
        scope: 'profile:en',
        dataClass: 'srsCard',
        key: 'cards:b',
        op: 'put',
      });
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the transaction aborts', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    const notify = jest.fn();
    setOutboxDirtyNotifier(notify);
    const tx = db.transaction([SYNC_OUTBOX, SYNC_META], 'readwrite');
    const pending = captureChange(tx.objectStore(SYNC_META), {
      scope: 'profile:en',
      dataClass: 'srsCard',
      key: 'cards:x',
      op: 'put',
    }).catch(() => undefined);
    const aborted = new Promise<void>((resolve) => {
      tx.onabort = () => resolve();
    });
    tx.abort();
    await Promise.all([pending, aborted]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does nothing when capture is disabled', async () => {
    configureSyncRuntime({ enabled: false, deviceId: 'd1' });
    const notify = jest.fn();
    setOutboxDirtyNotifier(notify);
    await inWriteTx(db, (store) =>
      captureChange(store, {
        scope: 'profile:en',
        dataClass: 'srsCard',
        key: 'cards:a',
        op: 'put',
      }),
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('the default notifier sends SYNC_OUTBOX_DIRTY and swallows rejection', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'd1' });
    sendSpy.mockRejectedValue(new Error('no receiver'));
    await inWriteTx(db, (store) =>
      captureChange(store, {
        scope: 'profile:en',
        dataClass: 'srsCard',
        key: 'cards:a',
        op: 'put',
      }),
    );
    expect(sendSpy).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.SYNC_OUTBOX_DIRTY,
      payload: {},
    });
  });
});

describe('sync runtime', () => {
  it('exposes the configured device id', () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devX' });
    expect(getDeviceId()).toBe('devX');
    resetSyncRuntime();
    expect(getDeviceId()).toBeNull();
  });
});
