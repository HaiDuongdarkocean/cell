import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterAll } from '@jest/globals';
import {
  trashWordStatus,
  listWordTrash,
  purgeExpiredTrash,
  restoreWordStatus,
  deleteWordTrash,
  TRASH_TTL_MS,
  type TrashedWordEntry,
} from './wordTrashStore';
import {
  getWordStatus,
  setWordStatus,
  deleteWordStatus,
  getAllWordStatuses,
} from './wordStatusStore';
import { getDB, awaitTx, closeAllDBs, clearAllStores, STORES } from '@/features/dictionary/repositories/baseRepository';

async function putTrashRecord(record: TrashedWordEntry): Promise<void> {
  const db = await getDB('en');
  const tx = db.transaction(STORES.WORD_TRASH, 'readwrite');
  tx.objectStore(STORES.WORD_TRASH).put(record);
  await awaitTx(tx);
}

async function putStatusRow(term: string, status: string): Promise<void> {
  const db = await getDB('en');
  const tx = db.transaction(STORES.WORD_STATUS, 'readwrite');
  tx.objectStore(STORES.WORD_STATUS).put({ term, status, updatedAt: Date.now() });
  await awaitTx(tx);
}

async function readTrashRaw(term: string): Promise<TrashedWordEntry | undefined> {
  const db = await getDB('en');
  const tx = db.transaction(STORES.WORD_TRASH, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORES.WORD_TRASH).get(term);
    req.onsuccess = () => resolve(req.result as TrashedWordEntry | undefined);
    req.onerror = () => reject(req.error);
  });
}

beforeEach(() => {
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores('en');
});

afterAll(() => {
  closeAllDBs();
});

describe('trashWordStatus', () => {
  it('moves a status row into trash atomically (REQ-7)', async () => {
    await setWordStatus('en', 'apple', 'known');
    await trashWordStatus('en', 'apple');

    expect(await getWordStatus('en', 'apple')).toBe('unknown');
    const record = await readTrashRaw('apple');
    expect(record?.previousStatus).toBe('known');
    expect(record?.trashedAt).toBeGreaterThan(0);
  });

  it('is a no-op when no status row exists (idempotent)', async () => {
    await trashWordStatus('en', 'ghost');
    expect(await readTrashRaw('ghost')).toBeUndefined();
    expect(await listWordTrash('en')).toEqual([]);
  });
});

describe('listWordTrash', () => {
  it('returns entries ordered trashedAt desc', async () => {
    const now = Date.now();
    await putTrashRecord({ term: 'old', previousStatus: 'known', trashedAt: now - 3000 });
    await putTrashRecord({ term: 'new', previousStatus: 'ignore', trashedAt: now - 1000 });
    await putTrashRecord({ term: 'mid', previousStatus: 'tracking', trashedAt: now - 2000 });

    const entries = await listWordTrash('en');
    expect(entries.map((e) => e.term)).toEqual(['new', 'mid', 'old']);
  });

  it('purges records older than TRASH_TTL_MS on read (REQ-12)', async () => {
    const expired = Date.now() - TRASH_TTL_MS - 1000;
    await putTrashRecord({ term: 'expired', previousStatus: 'known', trashedAt: expired });
    await putTrashRecord({ term: 'fresh', previousStatus: 'known', trashedAt: Date.now() });

    const entries = await listWordTrash('en');
    expect(entries.map((e) => e.term)).toEqual(['fresh']);
    expect(await readTrashRaw('expired')).toBeUndefined();
  });

  it('drops trash records whose term has a status row (status wins)', async () => {
    await putTrashRecord({ term: 'both', previousStatus: 'known', trashedAt: Date.now() });
    await putStatusRow('both', 'tracking');

    const entries = await listWordTrash('en');
    expect(entries).toEqual([]);
    expect(await readTrashRaw('both')).toBeUndefined();
    expect(await getWordStatus('en', 'both')).toBe('tracking');
  });
});

describe('purgeExpiredTrash', () => {
  it('removes expired records without touching status rows', async () => {
    await putTrashRecord({ term: 'gone', previousStatus: 'known', trashedAt: Date.now() - TRASH_TTL_MS - 1 });
    await setWordStatus('en', 'stay', 'ignore');

    await purgeExpiredTrash('en');
    expect(await readTrashRaw('gone')).toBeUndefined();
    expect(await getWordStatus('en', 'stay')).toBe('ignore');
  });
});

describe('restoreWordStatus', () => {
  it('writes previousStatus back and removes the trash record (REQ-10)', async () => {
    await setWordStatus('en', 'apple', 'ignore');
    await trashWordStatus('en', 'apple');
    const restored = await restoreWordStatus('en', 'apple');

    expect(restored).toBe('ignore');
    expect(await getWordStatus('en', 'apple')).toBe('ignore');
    expect(await readTrashRaw('apple')).toBeUndefined();
  });

  it('reports success for a missing trash record (idempotent)', async () => {
    const status = await restoreWordStatus('en', 'never-trashed');
    expect(status).toBe('tracking');
    expect(await readTrashRaw('never-trashed')).toBeUndefined();
  });

  it('falls back to tracking when previousStatus is missing', async () => {
    await putTrashRecord({ term: 'corrupt', previousStatus: undefined as never, trashedAt: Date.now() });
    const status = await restoreWordStatus('en', 'corrupt');
    expect(status).toBe('tracking');
    expect(await getWordStatus('en', 'corrupt')).toBe('tracking');
  });
});

describe('deleteWordTrash', () => {
  it('removes only the trash record (REQ-11)', async () => {
    await putTrashRecord({ term: 'x', previousStatus: 'known', trashedAt: Date.now() });
    await deleteWordTrash('en', 'x');
    expect(await readTrashRaw('x')).toBeUndefined();
  });
});

describe('status-store invariants (REQ-8/REQ-12)', () => {
  it('setWordStatus(unknown) deletes the row but keeps the trash record', async () => {
    await setWordStatus('en', 'word', 'known');
    await trashWordStatus('en', 'word');
    await setWordStatus('en', 'word', 'unknown');

    expect(await getWordStatus('en', 'word')).toBe('unknown');
    expect(await readTrashRaw('word')).toBeDefined();
  });

  it('a real-status write clears a pending trash record', async () => {
    await setWordStatus('en', 'word', 'known');
    await trashWordStatus('en', 'word');
    await setWordStatus('en', 'word', 'tracking');

    expect(await getWordStatus('en', 'word')).toBe('tracking');
    expect(await readTrashRaw('word')).toBeUndefined();
  });

  it('cycle landing on unknown deletes the row, not persist it', async () => {
    await setWordStatus('en', 'loop', 'ignore');
    const { cycleWordStatus } = await import('./wordStatusStore');
    const next = await cycleWordStatus('en', 'loop');

    expect(next).toBe('unknown');
    const all = await getAllWordStatuses('en');
    expect(all.find((e) => e.term === 'loop')).toBeUndefined();
  });

  it('deleteWordStatus clears any pending trash record', async () => {
    await setWordStatus('en', 'word', 'known');
    await trashWordStatus('en', 'word');
    await deleteWordStatus('en', 'word');

    expect(await readTrashRaw('word')).toBeUndefined();
    expect(await getWordStatus('en', 'word')).toBe('unknown');
  });

  it('getAllWordStatuses sweeps legacy unknown rows on read', async () => {
    await putStatusRow('legacy', 'unknown');
    await putStatusRow('live', 'known');

    const entries = await getAllWordStatuses('en');
    expect(entries.map((e) => e.term)).toEqual(['live']);
    expect(await getWordStatus('en', 'legacy')).toBe('unknown');
  });
});
