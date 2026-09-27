import { InMemoryKeyValueStore } from '../../memory/InMemoryKeyValueStore';
import type { ChangeRecord, Hlc } from '../../../domain/types';
import { appendConflictLog, SYNC_CONFLICT_LOG_LIMIT } from './conflictLog';
import type { ConflictLogEntry } from './conflictLog';
import { kvMetaKey, readSyncMetaKV, stampKvMeta } from './kvMeta';
import { kvValueHash } from './valueHash';
import {
  SYNC_CONFLICT_LOG_STORAGE_KEY,
  SYNC_DIRECTORY_STORAGE_KEY,
  SYNC_META_KV_STORAGE_KEY,
  SYNCED_STORAGE_KEYS,
} from './keys';

const h = (wall: number): Hlc => ({ wall, counter: 0, node: 'n' });

const rec = (key: string, op: 'put' | 'delete', value: unknown, wall: number): ChangeRecord => ({
  scope: 'global',
  dataClass: 'settings',
  key,
  op,
  value: op === 'put' ? value : undefined,
  hlc: h(wall),
  firstHlc: h(wall),
});

describe('stampKvMeta', () => {
  it('stamps hlc/firstHlc/op/valueHash per record into syncMetaKV', async () => {
    const kv = new InMemoryKeyValueStore();
    await stampKvMeta(kv, [rec('kv:settings/a', 'put', 1, 5), rec('kv:settings/b', 'delete', undefined, 6)]);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/a')]).toMatchObject({ op: 'put', hlc: h(5), firstHlc: h(5) });
    expect(meta[kvMetaKey('global', 'kv:settings/a')].valueHash).toBe(await kvValueHash(1));
    expect(meta[kvMetaKey('global', 'kv:settings/b')]).toMatchObject({ op: 'delete', hlc: h(6) });
    expect(meta[kvMetaKey('global', 'kv:settings/b')].valueHash).toBeUndefined();
  });

  it('merges into existing meta without touching other keys and no-ops on empty batches', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('local', SYNC_META_KV_STORAGE_KEY, { 'kv:other/x': { hlc: h(1), op: 'put' } });
    await stampKvMeta(kv, []);
    expect(await readSyncMetaKV(kv)).toEqual({ 'kv:other/x': { hlc: h(1), op: 'put' } });
    await stampKvMeta(kv, [rec('kv:settings/a', 'put', 2, 9)]);
    const meta = await readSyncMetaKV(kv);
    expect(meta['kv:other/x']).toBeDefined();
    expect(meta[kvMetaKey('global', 'kv:settings/a')].hlc).toEqual(h(9));
  });

  it('tolerates malformed meta rows on read', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('local', SYNC_META_KV_STORAGE_KEY, { good: { hlc: h(1), op: 'put' }, bad: 7 });
    const meta = await readSyncMetaKV(kv);
    expect(Object.keys(meta)).toEqual(['good']);
  });
});

describe('appendConflictLog', () => {
  const entry = (i: number): ConflictLogEntry => ({
    at: i,
    scope: 'global',
    dataClass: 'settings',
    key: `kv:settings/f${i}`,
    localHlc: h(i),
    remoteHlc: h(i + 1),
    winner: 'remote',
  });

  it('appends entries and keeps the newest SYNC_CONFLICT_LOG_LIMIT', async () => {
    const kv = new InMemoryKeyValueStore();
    await appendConflictLog(kv, [entry(1), entry(2)]);
    await appendConflictLog(kv, [entry(3)]);
    const log = (await kv.get<ConflictLogEntry[]>('local', SYNC_CONFLICT_LOG_STORAGE_KEY)) ?? [];
    expect(log.map((e) => e.at)).toEqual([1, 2, 3]);

    await appendConflictLog(kv, Array.from({ length: 600 }, (_, i) => entry(100 + i)));
    const trimmed = (await kv.get<ConflictLogEntry[]>('local', SYNC_CONFLICT_LOG_STORAGE_KEY)) ?? [];
    expect(trimmed.length).toBe(SYNC_CONFLICT_LOG_LIMIT);
    expect(trimmed[0].at).toBe(200);
    expect(trimmed[trimmed.length - 1].at).toBe(699);
  });
});

describe('synced key constants', () => {
  it('covers all registry keys and excludes engine-internal directory writes', () => {
    expect(SYNCED_STORAGE_KEYS).toEqual(
      expect.arrayContaining([
        'settings',
        'themeMode',
        'themeConfig',
        'tokenizeSettings',
        'ocrSettings',
        'studyModes',
        'auto_download_whitelist',
      ]),
    );
    expect(SYNCED_STORAGE_KEYS).not.toContain(SYNC_DIRECTORY_STORAGE_KEY);
  });
});
