import { InMemoryKeyValueStore } from '../../memory/InMemoryKeyValueStore';
import type { ChangeRecord, Hlc, RecordMeta } from '../../../domain/types';
import type { FieldRegistry } from '../../../domain/flatten';
import { SETTINGS_FIELD_REGISTRY } from '../../../domain/settingsRegistry';
import { KvLocalSource } from './kvLocalSource';
import { directoryKvShape, flattenedKvShape } from './kvShapes';
import { stampKvMeta } from './kvMeta';
import { SYNC_CONFLICT_LOG_STORAGE_KEY, SYNC_META_KV_STORAGE_KEY } from './keys';
import type { ConflictLogEntry } from './conflictLog';

const h = (wall: number, counter = 0, node = 'remote'): Hlc => ({ wall, counter, node });

const SYNC_ALL: FieldRegistry = { syncedPaths: [[]] };

const SMALL_REGISTRY: FieldRegistry = {
  syncedPaths: [['a'], ['nested'], ['items']],
  excludedPaths: [['nested', 'local']],
  elementArrays: [
    { path: ['items'], elementId: (el) => (el as { id?: string }).id ?? null },
  ],
};

interface Harness {
  kv: InMemoryKeyValueStore;
  source: KvLocalSource;
  conflicts(): Promise<ConflictLogEntry[]>;
  stored(key: string): Promise<unknown>;
  metas(): Promise<Record<string, RecordMeta>>;
  wall: () => number;
}

function harness(
  shape: ReturnType<typeof flattenedKvShape> | ReturnType<typeof directoryKvShape>,
  dataClass: 'settings' | 'secondaryKey' | 'syncDirectory' = 'settings',
  startWall = 1000,
): Harness {
  const kv = new InMemoryKeyValueStore();
  let wall = startWall;
  const writeValue = async (value: unknown) => {
    if (value === undefined) {
      await kv.del('local', shape.storageKey);
    } else {
      await kv.set('local', shape.storageKey, value);
    }
  };
  const source = new KvLocalSource(dataClass, shape, {
    kv,
    tick: () => ({ wall: ++wall, counter: 0, node: 'local' }),
    writeValue,
    now: () => 4242,
  });
  return {
    kv,
    source,
    wall: () => wall,
    stored: (key: string) => kv.get('local', key),
    metas: async () => (await kv.get<Record<string, RecordMeta>>('local', SYNC_META_KV_STORAGE_KEY)) ?? {},
    conflicts: async () =>
      (await kv.get<ConflictLogEntry[]>('local', SYNC_CONFLICT_LOG_STORAGE_KEY)) ?? [],
  };
}

function put(
  key: string,
  value: unknown,
  hlc: Hlc,
  dataClass: ChangeRecord['dataClass'] = 'settings',
): ChangeRecord {
  return { scope: 'global', dataClass, key, op: 'put', value, hlc, firstHlc: hlc };
}

function tombstone(
  key: string,
  hlc: Hlc,
  dataClass: ChangeRecord['dataClass'] = 'settings',
): ChangeRecord {
  return { scope: 'global', dataClass, key, op: 'delete', hlc, firstHlc: hlc };
}

async function collect(source: KvLocalSource): Promise<ChangeRecord[]> {
  const out: ChangeRecord[] = [];
  for await (const record of source.snapshot('global')) out.push(record);
  return out;
}

describe('KvLocalSource.pending', () => {
  it('emits every leaf when meta is empty', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: { c: 'x' } });
    const pending = await t.source.pending(100);
    expect(pending.map((p) => p.key)).toEqual(['kv:k/a', 'kv:k/b/c']);
    expect(pending.every((p) => p.op === 'put' && p.scope === 'global' && p.dataClass === 'secondaryKey')).toBe(true);
  });

  it('is clean after stampKvMeta of resolved records', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: 2 });
    const pending = await t.source.pending(100);
    const records = await t.source.resolve(pending);
    await stampKvMeta(t.kv, records);
    expect(await t.source.pending(100)).toEqual([]);
  });

  it('emits a put only for changed leaves and a delete for locally removed leaves', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: 2 });
    const records = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, records);

    await t.kv.set('local', 'k', { a: 9, c: 3 });
    const pending = await t.source.pending(100);
    expect(pending).toEqual([
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/a', op: 'put' },
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/b', op: 'delete' },
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/c', op: 'put' },
    ]);
  });

  it('respects the limit', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: 2, c: 3 });
    expect((await t.source.pending(2)).length).toBe(2);
    expect(await t.source.pending(0)).toEqual([]);
  });
});

describe('KvLocalSource.resolve', () => {
  it('mints hlcs without stamping meta', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    const [record] = await t.source.resolve(await t.source.pending(100));
    expect(record).toMatchObject({
      scope: 'global',
      dataClass: 'secondaryKey',
      key: 'kv:k/a',
      op: 'put',
      value: 1,
    });
    expect(record.hlc.node).toBe('local');
    expect(record.firstHlc).toEqual(record.hlc);
    expect(await t.metas()).toEqual({});
  });

  it('carries firstHlc across puts and resets it after a tombstone', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    const [first] = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, [first]);

    await t.kv.set('local', 'k', { a: 2 });
    const [second] = await t.source.resolve(await t.source.pending(100));
    expect(second.firstHlc).toEqual(first.hlc);
    await stampKvMeta(t.kv, [second]);

    await t.kv.set('local', 'k', {});
    const [del] = await t.source.resolve(await t.source.pending(100));
    expect(del.op).toBe('delete');
    await stampKvMeta(t.kv, [del]);

    await t.kv.set('local', 'k', { a: 3 });
    const [recreated] = await t.source.resolve(await t.source.pending(100));
    expect(recreated.op).toBe('put');
    expect(recreated.firstHlc).toEqual(recreated.hlc);
    expect(recreated.firstHlc).not.toEqual(first.hlc);
  });

  it('skips keys whose current hash already matches meta', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    const records = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, records);
    const again = await t.source.resolve([
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/a', op: 'put' },
    ]);
    expect(again).toEqual([]);
  });
});

describe('KvLocalSource.snapshot', () => {
  it('emits live leaves with stored meta hlcs and tombstone records for meta deletes', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, gone: 'x' });
    const records = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, records);
    await t.kv.set('local', 'k', { a: 1 });
    const [del] = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, [del]);

    const snapshot = await collect(t.source);
    const putA = snapshot.find((r) => r.key === 'kv:k/a');
    const tomb = snapshot.find((r) => r.key === 'kv:k/gone');
    expect(putA?.hlc).toEqual(records.find((r) => r.key === 'kv:k/a')?.hlc);
    expect(putA?.op).toBe('put');
    expect(tomb).toMatchObject({ op: 'delete', hlc: del.hlc });
    expect(snapshot.length).toBe(2);
  });

  it('mints hlcs for leaves lacking meta and for meta-put rows whose leaf is absent', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { fresh: true });
    const records = await collect(t.source);
    expect(records).toHaveLength(1);
    expect(records[0].hlc.node).toBe('local');

    await stampKvMeta(t.kv, records);
    await t.kv.set('local', 'k', {});
    const next = await collect(t.source);
    expect(next[0].op).toBe('delete');
    expect(next[0].hlc.node).toBe('local');
  });

  it('is empty for non-global scopes', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    const out: ChangeRecord[] = [];
    for await (const record of t.source.snapshot('profile:en')) out.push(record);
    expect(out).toEqual([]);
  });
});

describe('KvLocalSource.current', () => {
  it('returns meta-derived records including tombstones and null for unknown keys', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: 2 });
    const records = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, records);
    await t.kv.set('local', 'k', { a: 1 });
    const [del] = await t.source.resolve(await t.source.pending(100));
    await stampKvMeta(t.kv, [del]);

    const current = await t.source.current(['kv:k/a', 'kv:k/b', 'kv:k/missing', 'foreign:x']);
    expect(current.get('kv:k/a')).toMatchObject({ op: 'put', value: 1 });
    expect(current.get('kv:k/b')).toMatchObject({ op: 'delete', hlc: del.hlc });
    expect(current.get('kv:k/missing')).toBeNull();
    expect(current.get('foreign:x')).toBeNull();
  });
});

describe('KvLocalSource.applyRemote', () => {
  it('applies a remote put, writes the value and stamps meta so pending stays clean', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    const result = await t.source.applyRemote([
      put('kv:k/b', 2, h(10), 'secondaryKey'),
    ]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:k/b']);
    expect(await t.stored('k')).toEqual({ a: 1, b: 2 });
    const metas = await t.metas();
    expect(metas['kv:k/b']).toMatchObject({ op: 'put', hlc: h(10) });
    expect(await t.source.pending(100)).toEqual([
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/a', op: 'put' },
    ]);
  });

  it('skips a stale remote record silently when local is in sync', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const result = await t.source.applyRemote([put('kv:k/a', 9, h(5), 'secondaryKey')]);
    expect(result.applied).toEqual([]);
    expect(result.localWon).toEqual([]);
    expect(await t.stored('k')).toEqual({ a: 1 });
    expect(await t.conflicts()).toEqual([]);
  });

  it('keeps a drifted local value when it wins the merge and logs the conflict', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    await t.kv.set('local', 'k', { a: 2 });
    const remote = put('kv:k/a', 9, h(5), 'secondaryKey');
    const result = await t.source.applyRemote([remote]);
    expect(result.applied).toEqual([]);
    expect(result.localWon.map((r) => r.key)).toEqual(['kv:k/a']);
    expect(await t.stored('k')).toEqual({ a: 2 });
    const conflicts = await t.conflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      at: 4242,
      scope: 'global',
      dataClass: 'secondaryKey',
      key: 'kv:k/a',
      remoteHlc: h(5),
      winner: 'local',
    });
    expect(conflicts[0].localHlc.node).toBe('local');
    const pending = await t.source.pending(100);
    expect(pending.map((p) => p.key)).toEqual(['kv:k/a']);
  });

  it('writes the remote value and logs the conflict when remote wins a drifted merge', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey', 10);
    await t.kv.set('local', 'k', { a: 1 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    await t.kv.set('local', 'k', { a: 2 });
    const remote = put('kv:k/a', 9, h(99999), 'secondaryKey');
    const result = await t.source.applyRemote([remote]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:k/a']);
    expect(await t.stored('k')).toEqual({ a: 9 });
    expect((await t.conflicts())[0]).toMatchObject({ key: 'kv:k/a', winner: 'remote' });
    const metas = await t.metas();
    expect(metas['kv:k/a']).toMatchObject({ op: 'put', hlc: h(99999) });
    expect(await t.source.pending(100)).toEqual([]);
  });

  it('applies a remote tombstone and keeps it out of pending', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1, b: 2 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const result = await t.source.applyRemote([tombstone('kv:k/b', h(5000), 'secondaryKey')]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:k/b']);
    expect(await t.stored('k')).toEqual({ a: 1 });
    expect(await t.source.pending(100)).toEqual([]);
    const current = await t.source.current(['kv:k/b']);
    expect(current.get('kv:k/b')).toMatchObject({ op: 'delete' });
  });

  it('retains unmaterializable and parent-tombstoned records as opaque without writing', async () => {
    const registry: FieldRegistry = { syncedPaths: [['a']] };
    const t = harness(flattenedKvShape('k', registry), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const unknown = put('kv:k/elsewhere/x', 1, h(9), 'secondaryKey');
    const result = await t.source.applyRemote([unknown]);
    expect(result.applied).toEqual([]);
    expect(result.opaque.map((r) => r.key)).toEqual(['kv:k/elsewhere/x']);
    expect(await t.stored('k')).toEqual({ a: 1 });

    const parentTomb = tombstone('kv:k/a', h(5000), 'secondaryKey');
    await t.source.applyRemote([parentTomb]);
    const child = put('kv:k/a/b', 5, h(6000), 'secondaryKey');
    const result2 = await t.source.applyRemote([child]);
    expect(result2.opaque.map((r) => r.key)).toEqual(['kv:k/a/b']);
    expect(result2.applied).toEqual([]);
    expect(await t.stored('k')).toEqual({});
    const metas = await t.metas();
    expect(metas['kv:k/a/b']).toBeUndefined();
  });

  it('materializes the higher-hlc side of a leaf-vs-subtree shape conflict', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 5 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const child = put('kv:k/a/b', 7, h(5000), 'secondaryKey');
    const result = await t.source.applyRemote([child]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:k/a/b']);
    expect(await t.stored('k')).toEqual({ a: { b: 7 } });
    const pending = await t.source.pending(100);
    expect(pending).toEqual([
      { scope: 'global', dataClass: 'secondaryKey', key: 'kv:k/a', op: 'delete' },
    ]);
  });

  it('suppresses a lower-hlc remote child put against a local leaf', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 5 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const child = put('kv:k/a/b', 7, h(1), 'secondaryKey');
    const result = await t.source.applyRemote([child]);
    expect(result.opaque.map((r) => r.key)).toEqual(['kv:k/a/b']);
    expect(await t.stored('k')).toEqual({ a: 5 });
  });

  it('preserves device-local fields inside synced subtrees', async () => {
    const t = harness(flattenedKvShape('k', SMALL_REGISTRY), 'secondaryKey');
    await t.kv.set('local', 'k', {
      a: 1,
      nested: { ok: 'yes', local: 'device' },
      unsynced: 'keep',
    });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    await t.source.applyRemote([
      put('kv:k/a', 2, h(5000), 'secondaryKey'),
      tombstone('kv:k/nested/ok', h(5100), 'secondaryKey'),
    ]);
    expect(await t.stored('k')).toEqual({
      a: 2,
      nested: { local: 'device' },
      unsynced: 'keep',
    });
  });

  it('merges element arrays by id and restores stripped fields from the local element', async () => {
    const t = harness(flattenedKvShape('settings', SETTINGS_FIELD_REGISTRY), 'settings');
    await t.kv.set('local', 'settings', {
      subtitleApiKeys: [
        { id: 'k1', apiKey: 'a', status: 'ok' },
        { id: 'k2', apiKey: 'b', rateLimitedUntil: 123 },
      ],
      activeProfileId: 'p-local',
      srs: { activeDeckId: 'deck-device', dataLifecycle: { x: 1 } },
    });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const result = await t.source.applyRemote([
      put('kv:settings/subtitleApiKeys/@k1', { id: 'k1', apiKey: 'a2' }, h(5000)),
      put('kv:settings/subtitleApiKeys/@k3', { id: 'k3', apiKey: 'c' }, h(5100)),
      tombstone('kv:settings/subtitleApiKeys/@k2', h(5200)),
    ]);
    expect(result.applied).toHaveLength(3);
    const stored = (await t.stored('settings')) as {
      subtitleApiKeys: Record<string, unknown>[];
      activeProfileId: string;
      srs: Record<string, unknown>;
    };
    expect(stored.subtitleApiKeys).toEqual([
      { id: 'k1', apiKey: 'a2', status: 'ok' },
      { id: 'k3', apiKey: 'c' },
    ]);
    expect(stored.activeProfileId).toBe('p-local');
    expect(stored.srs).toEqual({ activeDeckId: 'deck-device', dataLifecycle: { x: 1 } });
    expect(await t.source.pending(100)).toEqual([]);
  });

  it('orders applied elements by the order field / firstHlc', async () => {
    const registry: FieldRegistry = {
      syncedPaths: [[]],
      elementArrays: [
        { path: ['items'], elementId: (el) => (el as { id?: string }).id ?? null },
      ],
    };
    const t = harness(flattenedKvShape('k', registry), 'secondaryKey');
    await t.kv.set('local', 'k', { items: [] });
    await t.source.applyRemote([
      put('kv:k/items/@b', { id: 'b', order: 2 }, h(10), 'secondaryKey'),
      put('kv:k/items/@a', { id: 'a', order: 1 }, h(11), 'secondaryKey'),
    ]);
    const stored = (await t.stored('k')) as { items: { id: string }[] };
    expect(stored.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('does not write or log when every remote record is stale', async () => {
    const t = harness(flattenedKvShape('k', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'k', { a: 1 });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));
    const writes: unknown[] = [];
    const spy = new KvLocalSource('secondaryKey', flattenedKvShape('k', SYNC_ALL), {
      kv: t.kv,
      tick: () => h(0),
      writeValue: async (v) => {
        writes.push(v);
      },
    });
    const result = await spy.applyRemote([put('kv:k/a', 5, h(1), 'secondaryKey')]);
    expect(writes).toEqual([]);
    expect(result.applied).toEqual([]);
  });
});

describe('KvLocalSource for the sync directory', () => {
  it('diffs top-level entries and resolves puts/deletes', async () => {
    const t = harness(directoryKvShape('syncState'), 'syncDirectory');
    await t.kv.set('local', 'syncState', {
      'connection:google-drive:acc1': { providerId: 'google-drive', accountKey: 'acc1' },
      'binding:en': 'google-drive:acc1',
      systemConnection: 'google-drive:acc1',
    });
    const pending = await t.source.pending(100);
    expect(pending.map((p) => p.key).sort()).toEqual([
      'binding:en',
      'connection:google-drive:acc1',
      'systemConnection',
    ]);
    const records = await t.source.resolve(pending);
    await stampKvMeta(t.kv, records);
    expect(await t.source.pending(100)).toEqual([]);

    const state = (await t.stored('syncState')) as Record<string, unknown>;
    delete state['connection:google-drive:acc1'];
    await t.kv.set('local', 'syncState', state);
    const next = await t.source.pending(100);
    expect(next).toEqual([
      { scope: 'global', dataClass: 'syncDirectory', key: 'connection:google-drive:acc1', op: 'delete' },
    ]);
  });

  it('applies remote directory records and tombstones', async () => {
    const t = harness(directoryKvShape('syncState'), 'syncDirectory');
    await t.kv.set('local', 'syncState', { 'binding:en': 'local' });
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    const result = await t.source.applyRemote([
      put('connection:google-drive:a', { providerId: 'google-drive' }, h(5000), 'syncDirectory'),
      put('binding:en', 'google-drive:a', h(5100), 'syncDirectory'),
      tombstone('binding:vi', h(5200), 'syncDirectory'),
    ]);
    expect(result.applied).toHaveLength(3);
    const state = await t.stored('syncState');
    expect(state).toEqual({
      'connection:google-drive:a': { providerId: 'google-drive' },
      'binding:en': 'google-drive:a',
    });
    expect(await t.source.pending(100)).toEqual([]);
  });

  it('treats foreign keys as non-materializable opaque records', async () => {
    const t = harness(directoryKvShape('syncState'), 'syncDirectory');
    const result = await t.source.applyRemote([
      put('kv:settings/a', 1, h(5), 'syncDirectory'),
      put('routeMeta:x', 1, h(6), 'syncDirectory'),
    ]);
    expect(result.applied).toEqual([]);
    expect(result.opaque.map((r) => r.key)).toEqual(['routeMeta:x']);
  });
});

describe('scalar secondary key', () => {
  it('flattens a scalar root to the bare kv key and applies remote puts', async () => {
    const t = harness(flattenedKvShape('themeMode', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'themeMode', 'dark');
    const pending = await t.source.pending(100);
    expect(pending.map((p) => p.key)).toEqual(['kv:themeMode']);
    const [record] = await t.source.resolve(pending);
    expect(record).toMatchObject({ key: 'kv:themeMode', value: 'dark', op: 'put' });
    await stampKvMeta(t.kv, [record]);

    await t.source.applyRemote([put('kv:themeMode', 'light', h(5000), 'secondaryKey')]);
    expect(await t.stored('themeMode')).toBe('light');
    expect(await t.source.pending(100)).toEqual([]);
  });

  it('removes the key when the root value is tombstoned remotely', async () => {
    const t = harness(flattenedKvShape('themeMode', SYNC_ALL), 'secondaryKey');
    await t.kv.set('local', 'themeMode', 'dark');
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    await t.source.applyRemote([tombstone('kv:themeMode', h(5000), 'secondaryKey')]);
    expect(await t.stored('themeMode')).toBeUndefined();
  });
});

describe('root element array (auto_download_whitelist)', () => {
  it('emits per-element record keys and strips tabId', async () => {
    const registry: FieldRegistry = {
      syncedPaths: [[]],
      elementArrays: [
        {
          path: [],
          elementId: (el) => (el as { url?: string }).url ?? null,
          stripFields: ['tabId'],
        },
      ],
    };
    const t = harness(flattenedKvShape('w', registry), 'secondaryKey');
    await t.kv.set('local', 'w', [
      { url: 'https://a.com/show', tabId: 7 },
      { url: 'https://b.com/x' },
    ]);
    const pending = await t.source.pending(100);
    const keys = pending.map((p) => p.key);
    expect(keys).toEqual(['kv:w/@https:~1~1a.com~1show', 'kv:w/@https:~1~1b.com~1x']);
    const records = await t.source.resolve(pending);
    expect(records[0].value).toEqual({ url: 'https://a.com/show' });
  });

  it('restores tabId from the matching local element on apply', async () => {
    const registry: FieldRegistry = {
      syncedPaths: [[]],
      elementArrays: [
        {
          path: [],
          elementId: (el) => (el as { url?: string }).url ?? null,
          stripFields: ['tabId'],
        },
      ],
    };
    const t = harness(flattenedKvShape('w', registry), 'secondaryKey');
    await t.kv.set('local', 'w', [{ url: 'https://a.com/show', tabId: 7 }]);
    await stampKvMeta(t.kv, await t.source.resolve(await t.source.pending(100)));

    await t.source.applyRemote([
      put('kv:w/@https:~1~1a.com~1show', { url: 'https://a.com/show', added: true }, h(5000), 'secondaryKey'),
      put('kv:w/@https:~1~1c.com~1y', { url: 'https://c.com/y' }, h(5100), 'secondaryKey'),
    ]);
    const stored = (await t.stored('w')) as Record<string, unknown>[];
    expect(stored).toContainEqual({ url: 'https://a.com/show', added: true, tabId: 7 });
    expect(stored).toContainEqual({ url: 'https://c.com/y' });
  });
});
