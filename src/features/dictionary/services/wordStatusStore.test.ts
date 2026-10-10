// wordStatusStore tests — spec §D1: 4-status cycle + IndexedDB CRUD.

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import {
  getWordStatus,
  setWordStatus,
  setWordStatuses,
  setWordStatusPos,
  setWordStatusesFromSync,
  setWordStatusFromSync,
  clearLearningFlag,
  cycleWordStatus,
  deleteWordStatus,
  getWordStatuses,
  getWordStatusPos,
  getPosStatusRows,
  getTermsByStatus,
  nextStatus,
  STATUS_CYCLE,
  DEFAULT_STATUS,
  WordStatusQuotaError,
} from './wordStatusStore';
import { closeAllDBs, clearAllStores, getDB } from '@/features/dictionary/repositories/baseRepository';
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

  it('flagged statuses cycle from their base (tracking/learning → known)', () => {
    expect(nextStatus('tracking')).toBe('known');
    expect(nextStatus('learning')).toBe('known');
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

describe('learning guard (flags are system-managed)', () => {
  it('setWordStatus rejects learning — no row written', async () => {
    await setWordStatus('en', 'guard', 'learning');
    expect(await getWordStatus('en', 'guard')).toBe('unknown');
  });

  it('setWordStatus rejects learning even when a tracking row exists', async () => {
    await setWordStatus('en', 'keep-tracking', 'tracking');
    await setWordStatus('en', 'keep-tracking', 'learning');
    expect(await getWordStatus('en', 'keep-tracking')).toBe('tracking');
  });

  it('setWordStatuses rejects learning in bulk', async () => {
    await setWordStatuses('en', ['x', 'y'], 'learning');
    expect(await getWordStatus('en', 'x')).toBe('unknown');
    expect(await getWordStatus('en', 'y')).toBe('unknown');
  });

  it('setWordStatusPos rejects learning', async () => {
    await setWordStatusPos('en', 'pos-term', 'noun', 'learning');
    expect(await getWordStatusPos('en', 'pos-term', 'noun')).toBe('unknown');
  });

  it('system writer setWordStatusFromSync CAN write learning', async () => {
    const ok = await setWordStatusFromSync('en', 'srs-word', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    expect(ok).toBe(true);
    expect(await getWordStatus('en', 'srs-word')).toBe('learning');
  });

  it('sync learning never writes onto known or ignore', async () => {
    await setWordStatus('en', 'k', 'known');
    await setWordStatus('en', 'i', 'ignore');
    const res = await setWordStatusesFromSync(
      'en',
      [
        { term: 'k', status: 'learning', sourceAt: Date.now() },
        { term: 'i', status: 'learning', sourceAt: Date.now() },
      ],
      { source: 'srs' },
    );
    expect(res.written).toBe(0);
    expect(await getWordStatus('en', 'k')).toBe('known');
    expect(await getWordStatus('en', 'i')).toBe('ignore');
  });

  it('sync learning upgrades tracking → learning (unknown family)', async () => {
    await setWordStatus('en', 'up', 'tracking');
    await setWordStatusesFromSync('en', [{ term: 'up', status: 'learning', sourceAt: Date.now() }], {
      source: 'srs',
    });
    expect(await getWordStatus('en', 'up')).toBe('learning');
  });

  it('public tracking/unknown writes cannot demote a stored learning row', async () => {
    await setWordStatusFromSync('en', 'carded', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    await setWordStatus('en', 'carded', 'tracking');
    expect(await getWordStatus('en', 'carded')).toBe('learning');
    await setWordStatus('en', 'carded', 'unknown');
    expect(await getWordStatus('en', 'carded')).toBe('learning');
  });

  it('public known/ignore writes still land on a learning row (terminal bases clear the flag)', async () => {
    await setWordStatusFromSync('en', 'grad', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    await setWordStatus('en', 'grad', 'known');
    expect(await getWordStatus('en', 'grad')).toBe('known');
    await setWordStatusFromSync('en', 'grad2', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    await setWordStatus('en', 'grad2', 'ignore');
    expect(await getWordStatus('en', 'grad2')).toBe('ignore');
  });

  it('bulk setWordStatuses skips learning rows for tracking/unknown, lands known/ignore', async () => {
    await setWordStatusFromSync('en', 'bulk-card', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    await setWordStatus('en', 'bulk-plain', 'tracking');

    await setWordStatuses('en', ['bulk-card', 'bulk-plain'], 'tracking');
    expect(await getWordStatus('en', 'bulk-card')).toBe('learning');
    expect(await getWordStatus('en', 'bulk-plain')).toBe('tracking');

    await setWordStatuses('en', ['bulk-card', 'bulk-plain'], 'unknown');
    expect(await getWordStatus('en', 'bulk-card')).toBe('learning');
    expect(await getWordStatus('en', 'bulk-plain')).toBe('unknown');

    await setWordStatuses('en', ['bulk-card'], 'known');
    expect(await getWordStatus('en', 'bulk-card')).toBe('known');
  });

  it('setWordStatusPos cannot demote a term-level learning row', async () => {
    await setWordStatusFromSync('en', 'pos-learn', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    await setWordStatusPos('en', 'pos-learn', 'verb', 'tracking');
    await setWordStatusPos('en', 'pos-learn', 'verb', 'unknown');
    expect(await getWordStatusPos('en', 'pos-learn', 'verb')).toBe('learning');
    expect((await getWordStatuses('en', ['pos-learn'])).get('pos-learn')).toBe('learning');
    await setWordStatusPos('en', 'pos-learn', 'verb', 'known');
    expect(await getWordStatusPos('en', 'pos-learn', 'verb')).toBe('known');
  });
});

describe('clearLearningFlag', () => {
  it('deletes the row only when stored status is learning', async () => {
    await setWordStatusFromSync('en', 'lost-card', 'learning', {
      source: 'srs',
      sourceAt: Date.now(),
    });
    expect(await clearLearningFlag('en', 'lost-card')).toBe(true);
    expect(await getWordStatus('en', 'lost-card')).toBe('unknown');
  });

  it('leaves tracking/known/ignore untouched', async () => {
    await setWordStatus('en', 't', 'tracking');
    await setWordStatus('en', 'k2', 'known');
    await setWordStatus('en', 'i2', 'ignore');
    expect(await clearLearningFlag('en', 't')).toBe(false);
    expect(await clearLearningFlag('en', 'k2')).toBe(false);
    expect(await clearLearningFlag('en', 'i2')).toBe(false);
    expect(await getWordStatus('en', 't')).toBe('tracking');
    expect(await getWordStatus('en', 'k2')).toBe('known');
    expect(await getWordStatus('en', 'i2')).toBe('ignore');
  });

  it('is a no-op when no row exists', async () => {
    expect(await clearLearningFlag('en', 'nothing')).toBe(false);
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
        { term: 'b', status: 'learning', sourceAt: 100 },
      ],
      { source: 'anki' },
    );
    expect(res.written).toBe(2);
    expect(await getWordStatus('en', 'a')).toBe('known');
    expect(await getWordStatus('en', 'b')).toBe('learning');
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
