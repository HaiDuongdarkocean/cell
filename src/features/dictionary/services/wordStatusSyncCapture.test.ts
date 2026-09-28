import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { setWordStatus, deleteWordStatus, getAllWordStatuses } from './wordStatusStore';
import { trashWordStatus, restoreWordStatus } from './wordTrashStore';
import { getDB, closeAllDBs, clearAllStores, STORES } from '@/features/dictionary/repositories/baseRepository';
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

async function allOutbox(langCode: string): Promise<OutboxRow[]> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.SYNC_OUTBOX, 'readonly');
  return (await reqToPromise(tx.objectStore(STORES.SYNC_OUTBOX).getAll())) as OutboxRow[];
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
  closeAllDBs();
  await clearAllStores('en');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('word status sync capture', () => {
  it('writes nothing when sync is disabled', async () => {
    await setWordStatus('en', 'hello', 'known');
    expect(await allOutbox('en')).toEqual([]);
  });

  it('captures a put when a real status is set', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await setWordStatus('en', 'hello', 'known');
    const rows = await allOutbox('en');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ scope: 'profile:en', dataClass: 'wordStatus', key: 'word:hello', op: 'put' });
  });

  it('captures a tombstone when status returns to unknown', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await setWordStatus('en', 'hello', 'known');
    await setWordStatus('en', 'hello', 'unknown');
    const rows = await allOutbox('en');
    const tombstone = rows.filter((r) => r.key === 'word:hello' && r.op === 'delete');
    expect(tombstone).toHaveLength(1);
  });

  it('captures a tombstone on deleteWordStatus', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await setWordStatus('en', 'hello', 'tracking');
    await deleteWordStatus('en', 'hello');
    const rows = await allOutbox('en');
    expect(rows.filter((r) => r.op === 'delete')).toHaveLength(1);
  });

  it('captures a tombstone when a status row is trashed', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await setWordStatus('en', 'hello', 'known');
    await trashWordStatus('en', 'hello');
    const rows = await allOutbox('en');
    expect(rows.filter((r) => r.key === 'word:hello' && r.op === 'delete')).toHaveLength(1);
  });

  it('captures a put when a trashed word is restored', async () => {
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await setWordStatus('en', 'hello', 'known');
    await trashWordStatus('en', 'hello');
    await restoreWordStatus('en', 'hello');
    const rows = await allOutbox('en');
    const puts = rows.filter((r) => r.key === 'word:hello' && r.op === 'put');
    expect(puts.length).toBeGreaterThanOrEqual(2);
  });

  it('does not capture the legacy unknown-row sweep', async () => {
    const db = await getDB('en');
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.WORD_STATUS, 'readwrite');
      tx.objectStore(STORES.WORD_STATUS).put({ term: 'legacy', status: 'unknown', updatedAt: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
    await getAllWordStatuses('en');
    expect(await allOutbox('en')).toEqual([]);
  });
});
