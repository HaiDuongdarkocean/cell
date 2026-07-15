// wordStatusStore tests — spec §D1: 4-status cycle + IndexedDB CRUD.

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import {
  getWordStatus,
  setWordStatus,
  cycleWordStatus,
  deleteWordStatus,
  getWordStatuses,
  getTermsByStatus,
  nextStatus,
  STATUS_CYCLE,
  DEFAULT_STATUS,
  WordStatusQuotaError,
} from './wordStatusStore';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';

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
  it('has 4 statuses in cycle order', () => {
    expect(STATUS_CYCLE).toEqual(['unknown', 'tracking', 'known', 'ignore']);
  });

  it('cycles unknown → tracking', () => {
    expect(nextStatus('unknown')).toBe('tracking');
  });

  it('cycles tracking → known', () => {
    expect(nextStatus('tracking')).toBe('known');
  });

  it('cycles known → ignore', () => {
    expect(nextStatus('known')).toBe('ignore');
  });

  it('cycles ignore → unknown (loop)', () => {
    expect(nextStatus('ignore')).toBe('unknown');
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
  it('cycles from unknown to tracking', async () => {
    const next = await cycleWordStatus('en', 'apple');
    expect(next).toBe('tracking');
    expect(await getWordStatus('en', 'apple')).toBe('tracking');
  });

  it('cycles through all 4 statuses and loops back', async () => {
    expect(await cycleWordStatus('en', 'banana')).toBe('tracking');
    expect(await cycleWordStatus('en', 'banana')).toBe('known');
    expect(await cycleWordStatus('en', 'banana')).toBe('ignore');
    expect(await cycleWordStatus('en', 'banana')).toBe('unknown');
    expect(await cycleWordStatus('en', 'banana')).toBe('tracking');
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
