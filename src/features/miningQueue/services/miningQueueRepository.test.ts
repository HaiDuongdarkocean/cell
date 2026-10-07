// miningQueueRepository tests — durability surface of spec mining-queue.md
// (dedupe, cap eviction, lean list projection, hard delete).

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  addQueueItem,
  listQueueRows,
  getQueueItem,
  removeQueueItem,
  countQueueItems,
  closeQueueDB,
} from './miningQueueRepository';
import { MINING_QUEUE_DB } from './miningQueueRepository';
import { MINING_QUEUE_CAP } from '@/entities/miningQueue';
import type { MiningQueueInput } from '@/entities/miningQueue';

const INPUT = (over: Partial<MiningQueueInput> = {}): MiningQueueInput => ({
  kind: 'term',
  term: 'contender',
  langCode: 'en',
  sentence: 'I could have been a contender.',
  ...over,
});

async function resetDb(): Promise<void> {
  closeQueueDB();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(MINING_QUEUE_DB);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(resetDb);
afterEach(resetDb);

describe('addQueueItem', () => {
  it('persists a new item retrievable by list + get', async () => {
    const { item } = await addQueueItem(INPUT(), 1000);
    const rows = await listQueueRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.term).toBe('contender');
    const full = await getQueueItem(item.id);
    expect(full?.sentence).toBe('I could have been a contender.');
  });

  it('dedupes same normalized term+sentence — refreshes createdAt, keeps one row', async () => {
    const first = await addQueueItem(INPUT(), 1000);
    expect(first.deduped).toBe(false);
    const second = await addQueueItem(
      INPUT({ term: '  CONTENDER ', sentence: 'I could have been  a contender.' }),
      2000,
    );
    expect(second.deduped).toBe(true);
    expect(second.item.id).toBe(first.item.id);
    expect(second.item.createdAt).toBe(2000);
    expect(await countQueueItems()).toBe(1);
  });

  it('sentence items dedupe only within the same videoId', async () => {
    const cue = (videoId?: string): MiningQueueInput => ({
      kind: 'sentence',
      langCode: 'en',
      sentence: 'same line',
      videoId,
    });
    await addQueueItem(cue('a'), 1);
    const dup = await addQueueItem(cue('a'), 2);
    expect(dup.deduped).toBe(true);
    const other = await addQueueItem(cue('b'), 3);
    expect(other.deduped).toBe(false);
    expect(await countQueueItems()).toBe(2);
  });

  it('survives a reconnect (fresh connection reads prior rows)', async () => {
    const { item } = await addQueueItem(INPUT(), 5);
    closeQueueDB();
    const rows = await listQueueRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(item.id);
  });
});

describe('cap eviction', () => {
  it('evicts oldest queued rows beyond the cap', async () => {
    for (let i = 0; i < MINING_QUEUE_CAP + 3; i++) {
      await addQueueItem(INPUT({ term: `t${i}`, sentence: `s${i}` }), i);
    }
    const rows = await listQueueRows();
    expect(rows.length).toBe(MINING_QUEUE_CAP);
    expect(rows.find((r) => r.term === 't0')).toBeUndefined();
    expect(rows.find((r) => r.term === 't1')).toBeUndefined();
    expect(rows.find((r) => r.term === 't2')).toBeUndefined();
    expect(rows.find((r) => r.term === `t${MINING_QUEUE_CAP + 2}`)).toBeDefined();
  }, 30_000);
});

describe('listQueueRows', () => {
  it('returns newest-first lean projections (no snapshot)', async () => {
    await addQueueItem(INPUT({ term: 'old' }), 1);
    await addQueueItem(INPUT({ term: 'new' }), 2);
    const rows = await listQueueRows();
    expect(rows.map((r) => r.term)).toEqual(['new', 'old']);
    expect('snapshot' in rows[0]!).toBe(false);
  });
});

describe('removeQueueItem', () => {
  it('hard-deletes and reports whether a row existed', async () => {
    const { item } = await addQueueItem(INPUT(), 1);
    expect(await removeQueueItem(item.id)).toBe(true);
    expect(await removeQueueItem(item.id)).toBe(false);
    expect(await countQueueItems()).toBe(0);
  });
});
