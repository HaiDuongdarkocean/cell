import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import {
  appendRunRecord,
  listRunHistory,
  SYNC_RUN_HISTORY_CAP,
  SYNC_RUN_HISTORY_KEY,
  type SyncRunRecord,
} from './runHistory';

function record(at: number): SyncRunRecord {
  return {
    id: `run-${at}`,
    at,
    kind: 'full',
    ok: true,
    pushed: [],
    pulled: [],
    appliedDataClasses: [],
    ackedKeys: 0,
    failed: [],
    errors: [],
  };
}

describe('runHistory', () => {
  it('returns empty list when nothing is stored', async () => {
    expect(await listRunHistory(new InMemoryKeyValueStore())).toEqual([]);
  });

  it('prepends newest first and caps at the ring size', async () => {
    const kv = new InMemoryKeyValueStore();
    for (let i = 0; i < SYNC_RUN_HISTORY_CAP + 3; i++) {
      await appendRunRecord(kv, record(i));
    }
    const rows = await listRunHistory(kv);
    expect(rows).toHaveLength(SYNC_RUN_HISTORY_CAP);
    expect(rows[0].id).toBe(`run-${SYNC_RUN_HISTORY_CAP + 2}`);
    expect(rows.at(-1)!.id).toBe('run-3');
  });

  it('treats a corrupted stored value as empty history', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('local', SYNC_RUN_HISTORY_KEY, { not: 'an-array' });
    expect(await listRunHistory(kv)).toEqual([]);
  });
});
