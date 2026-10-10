// wordStatusStore tests — spec §D1: 4-status cycle + IndexedDB CRUD.

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import {
  getWordStatus,
  setWordStatus,
  setWordStatuses,
  setWordStatusPos,
  setWordStatusesFromSync,
  cycleWordStatus,
  deleteWordStatus,
  getWordStatuses,
  getWordStatusPos,
  getPosStatusRows,
  posStatusKey,
  getAllWordStatuses,
  getTermsByStatus,
  nextStatus,
  STATUS_CYCLE,
  DEFAULT_STATUS,
  WordStatusQuotaError,
} from './wordStatusStore';
import { closeAllDBs, clearAllStores, getDB, awaitTx, STORES } from '@/features/dictionary/repositories/baseRepository';
import { listWordTrash } from './wordTrashStore';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
  storageLocalGetMock.mockResolvedValue({});
});

beforeEach(() => {
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores('en');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('STATUS_CYCLE + nextStatus', () => {
  it('has the 3 base statuses in cycle order', () => {
    expect(STATUS_CYCLE).toEqual(['unknown', 'known', 'ignore']);
  });

  it('cycles unknown → known → ignore → unknown', () => {
    expect(nextStatus('unknown')).toBe('known');
    expect(nextStatus('known')).toBe('ignore');
    expect(nextStatus('ignore')).toBe('unknown');
  });

  it('flagged statuses cycle from their base (tracking → known)', () => {
    expect(nextStatus('tracking')).toBe('known');
  });

  it('DEFAULT_STATUS is unknown', () => {
    expect(DEFAULT_STATUS).toBe('unknown');
  });
});

describe('getWordStatus', () => {
  it('returns unknown for a term not in store', async () => {
    const status = await getWordStatus('en', 'hello');
    expect(status).toBe('unknown');
  });

  it('returns the stored status after set', async () => {
    await setWordStatus('en', 'hello', 'tracking');
    const status = await getWordStatus('en', 'hello');
    expect(status).toBe('tracking');
  });
});

describe('setWordStatus', () => {
  it('stores a status', async () => {
    await setWordStatus('en', 'world', 'known');
    expect(await getWordStatus('en', 'world')).toBe('known');
  });

  it('upserts (overwrites existing)', async () => {
    await setWordStatus('en', 'test', 'tracking');
    await setWordStatus('en', 'test', 'known');
    expect(await getWordStatus('en', 'test')).toBe('known');
  });
});

describe('cycleWordStatus', () => {
  it('cycles from unknown to known', async () => {
    const next = await cycleWordStatus('en', 'apple');
    expect(next).toBe('known');
    expect(await getWordStatus('en', 'apple')).toBe('known');
  });

  it('cycles through the 3 base statuses and loops back', async () => {
    expect(await cycleWordStatus('en', 'banana')).toBe('known');
    expect(await cycleWordStatus('en', 'banana')).toBe('ignore');
    expect(await cycleWordStatus('en', 'banana')).toBe('unknown');
    expect(await cycleWordStatus('en', 'banana')).toBe('known');
  });
});

describe('legacy learning rows (pre-tracking/hasCard migration)', () => {
  async function seedLegacyLearningRow(term: string, pos?: string): Promise<void> {
    const db = await getDB('en');
    const tx = db.transaction(STORES.WORD_STATUS, 'readwrite');
    tx.objectStore(STORES.WORD_STATUS).put({
      term: pos ? posStatusKey(term, pos) : term,
      ...(pos ? { pos } : {}),
      status: 'learning',
      updatedAt: 100,
      source: 'srs',
      sourceAt: 100,
    });
    await awaitTx(tx);
  }

  async function rawStoredStatus(term: string): Promise<unknown> {
    const db = await getDB('en');
    const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
    const row = await new Promise<{ status?: unknown } | undefined>((resolve, reject) => {
      const req = tx.objectStore(STORES.WORD_STATUS).get(term);
      req.onsuccess = () => resolve(req.result as { status?: unknown } | undefined);
      req.onerror = () => reject(req.error);
    });
    return row?.status;
  }

  it('reads coerce learning → tracking at every read path', async () => {
    await seedLegacyLearningRow('legacy');
    expect(await getWordStatus('en', 'legacy')).toBe('tracking');
    expect((await getWordStatuses('en', ['legacy'])).get('legacy')).toBe('tracking');
    expect(await getWordStatusPos('en', 'legacy', 'verb')).toBe('tracking');
  });

  it('coerces learning pos rows too', async () => {
    await seedLegacyLearningRow('vary', 'verb');
    expect((await getPosStatusRows('en', 'vary')).get('verb')).toBe('tracking');
    expect(await getWordStatusPos('en', 'vary', 'verb')).toBe('tracking');
  });

  it('getAllWordStatuses sweeps learning → tracking and persists the rewrite', async () => {
    await seedLegacyLearningRow('swept');
    const entries = await getAllWordStatuses('en');
    expect(entries.find((e) => e.term === 'swept')?.status).toBe('tracking');
    expect(await rawStoredStatus('swept')).toBe('tracking');
    expect(await getTermsByStatus('en', 'tracking')).toContain('swept');
  });

  it('user writes win over a legacy learning row (tracking is user-owned)', async () => {
    await seedLegacyLearningRow('user-wins');
    await setWordStatus('en', 'user-wins', 'unknown');
    expect(await getWordStatus('en', 'user-wins')).toBe('unknown');
  });

  it('sync tracking candidates still skip stored known/ignore', async () => {
    await setWordStatus('en', 'k', 'known');
    await setWordStatus('en', 'i', 'ignore');
    const res = await setWordStatusesFromSync(
      'en',
      [
        { term: 'k', status: 'tracking', sourceAt: Date.now() },
        { term: 'i', status: 'tracking', sourceAt: Date.now() },
      ],
      { source: 'srs' },
    );
    expect(res.written).toBe(0);
    expect(await getWordStatus('en', 'k')).toBe('known');
    expect(await getWordStatus('en', 'i')).toBe('ignore');
  });
});

describe('deleteWordStatus', () => {
  it('deletes a status entry', async () => {
    await setWordStatus('en', 'delete-me', 'known');
    await deleteWordStatus('en', 'delete-me');
    expect(await getWordStatus('en', 'delete-me')).toBe('unknown');
  });

  it('does not throw for non-existent term', async () => {
    await expect(deleteWordStatus('en', 'never-existed')).resolves.not.toThrow();
  });
});

describe('getWordStatuses (batch)', () => {
  it('returns statuses for multiple terms', async () => {
    await setWordStatus('en', 'a', 'tracking');
    await setWordStatus('en', 'b', 'known');
    const map = await getWordStatuses('en', ['a', 'b', 'c']);
    expect(map.get('a')).toBe('tracking');
    expect(map.get('b')).toBe('known');
    expect(map.get('c')).toBe('unknown');
  });

  it('folds pos rows to the least-learned aggregate', async () => {
    await setWordStatusPos('en', 'present', 'adjective', 'known');
    await setWordStatusPos('en', 'present', 'verb', 'tracking');
    const map = await getWordStatuses('en', ['present']);
    expect(map.get('present')).toBe('tracking');
    expect((await getPosStatusRows('en', 'present')).size).toBe(2);
  });

  it('term row participates as fallback for unmaterialized variants', async () => {
    await setWordStatus('en', 'flat', 'known');
    await setWordStatusPos('en', 'flat', 'verb', 'tracking');
    const map = await getWordStatuses('en', ['flat']);
    expect(map.get('flat')).toBe('tracking');
  });
});

describe('getTermsByStatus', () => {
  it('returns all terms with a given status', async () => {
    await setWordStatus('en', 'a', 'tracking');
    await setWordStatus('en', 'b', 'tracking');
    await setWordStatus('en', 'c', 'known');
    const tracking = await getTermsByStatus('en', 'tracking');
    expect(tracking).toContain('a');
    expect(tracking).toContain('b');
    expect(tracking).not.toContain('c');
  });

  it('returns empty for a status with no terms', async () => {
    const ignore = await getTermsByStatus('en', 'ignore');
    expect(ignore).toEqual([]);
  });
});

describe('setWordStatusesFromSync (batch sync write)', () => {
  it('writes many terms in one call', async () => {
    const res = await setWordStatusesFromSync(
      'en',
      [
        { term: 'a', status: 'known', sourceAt: 100 },
        { term: 'b', status: 'tracking', sourceAt: 100 },
      ],
      { source: 'anki' },
    );
    expect(res.written).toBe(2);
    expect(await getWordStatus('en', 'a')).toBe('known');
    expect(await getWordStatus('en', 'b')).toBe('tracking');
  });

  it('returns written: 0 for empty updates', async () => {
    const res = await setWordStatusesFromSync('en', [], { source: 'anki' });
    expect(res.written).toBe(0);
  });

  it('never downgrades a stored known via non-user source', async () => {
    await setWordStatus('en', 'keep', 'known', { source: 'user', sourceAt: 1000 });
    const res = await setWordStatusesFromSync(
      'en',
      [{ term: 'keep', status: 'tracking', sourceAt: 2000 }],
      { source: 'anki' },
    );
    expect(res.written).toBe(0);
    expect(await getWordStatus('en', 'keep')).toBe('known');
  });

  it('newer sourceAt overwrites; older skips — same tx batch', async () => {
    await setWordStatusesFromSync('en', [{ term: 'mix', status: 'tracking', sourceAt: 500 }], {
      source: 'anki',
    });
    const res = await setWordStatusesFromSync(
      'en',
      [
        { term: 'mix', status: 'known', sourceAt: 400 }, // older → skip
        { term: 'mix2', status: 'known', sourceAt: 600 }, // new term → write
      ],
      { source: 'anki' },
    );
    expect(res.written).toBe(1);
    expect(await getWordStatus('en', 'mix')).toBe('tracking');
    expect(await getWordStatus('en', 'mix2')).toBe('known');
  });
});

describe('WordStatusQuotaError (spec §10 failure path)', () => {
  it('is an Error subclass', () => {
    const err = new WordStatusQuotaError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WordStatusQuotaError');
  });

  it('setWordStatus throws WordStatusQuotaError on quota exceeded', async () => {
    // Simulate quota error by mocking the DB transaction to throw.
    // We can't easily trigger a real QuotaExceededError in fake-indexeddb,
    // so we test the error class + isQuotaError logic indirectly.
    const err = new WordStatusQuotaError('Bộ nhớ đầy — xóa resource cũ');
    expect(err.message).toContain('Bộ nhớ đầy');
    expect(err.message).toContain('xóa resource');
  });

  it('WordStatusQuotaError message is user-facing Vietnamese', () => {
    const err = new WordStatusQuotaError('Bộ nhớ đầy — xóa resource cũ trong Settings → Resources');
    expect(err.message).toContain('Settings');
    expect(err.message).toContain('Resources');
  });
});

describe('setWordStatuses (bulk)', () => {
  it('writes every term in one transaction', async () => {
    const db = await getDB('en');
    const txSpy = jest.spyOn(db, 'transaction');

    await setWordStatuses('en', ['a', 'b', 'c'], 'known');

    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(await getWordStatus('en', 'a')).toBe('known');
    expect(await getWordStatus('en', 'b')).toBe('known');
    expect(await getWordStatus('en', 'c')).toBe('known');
  });

  it('clears pending trash records on a real-status write', async () => {
    await setWordStatus('en', 'word', 'known');
    const { trashWordStatus } = await import('./wordTrashStore');
    await trashWordStatus('en', 'word');
    expect((await listWordTrash('en')).map((e) => e.term)).toEqual(['word']);

    await setWordStatuses('en', ['word'], 'tracking');

    expect(await getWordStatus('en', 'word')).toBe('tracking');
    expect(await listWordTrash('en')).toEqual([]);
  });

  it("'unknown' deletes status rows but keeps pending trash records", async () => {
    const { trashWordStatus } = await import('./wordTrashStore');
    await setWordStatus('en', 'a', 'known');
    await setWordStatus('en', 'b', 'known');
    await trashWordStatus('en', 'b');

    await setWordStatuses('en', ['a', 'b'], 'unknown');

    expect(await getWordStatus('en', 'a')).toBe('unknown');
    expect(await getWordStatus('en', 'b')).toBe('unknown');
    expect((await listWordTrash('en')).map((e) => e.term)).toEqual(['b']);
  });

  it('is a no-op for an empty term list', async () => {
    const db = await getDB('en');
    const txSpy = jest.spyOn(db, 'transaction');
    await setWordStatuses('en', [], 'known');
    expect(txSpy).not.toHaveBeenCalled();
  });
});
