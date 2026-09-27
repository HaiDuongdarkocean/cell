import {
  decodePath,
  diffFlattened,
  encodeElementSegment,
  encodePath,
  escapePathSegment,
  flatten,
  isMaterializablePath,
  kvRecordKey,
  kvRecordPath,
  nextFirstHlc,
  profileRecordKey,
  unescapePathSegment,
  unflatten,
} from './flatten';
import type { FieldRegistry, FlatRecord } from './flatten';
import type { Hlc } from './types';

const h = (wall: number, counter = 0, node = 'a'): Hlc => ({ wall, counter, node });

const put = (path: string, value: unknown, hlc?: Hlc, firstHlc?: Hlc): FlatRecord => ({
  path,
  value,
  op: 'put',
  hlc,
  firstHlc,
});

const syncAll: FieldRegistry = { syncedPaths: [[]] };

const withRules = (rules: Partial<FieldRegistry>): FieldRegistry => ({
  syncedPaths: [[]],
  ...rules,
});

describe('path escaping', () => {
  it('escapes ~ and / per JSON-pointer', () => {
    expect(escapePathSegment('a/b~c')).toBe('a~1b~0c');
    expect(unescapePathSegment('a~1b~0c')).toBe('a/b~c');
    expect(unescapePathSegment('~01')).toBe('~1');
  });

  it('round-trips segments through encodePath/decodePath', () => {
    const segs = ['plain', 'a/b', 't~x', '~0', '@weird'];
    const encoded = encodePath(segs);
    expect(encoded).toBe('plain/a~1b/t~0x/~00/@@weird');
    expect(decodePath(encoded)).toEqual([
      { kind: 'key', key: 'plain' },
      { kind: 'key', key: 'a/b' },
      { kind: 'key', key: 't~x' },
      { kind: 'key', key: '~0' },
      { kind: 'key', key: '@weird' },
    ]);
  });

  it('decodes element segments with escaped ids', () => {
    expect(decodePath('arr/@it~1em')).toEqual([
      { kind: 'key', key: 'arr' },
      { kind: 'element', id: 'it/em' },
    ]);
    expect(decodePath(encodeElementSegment('https://a.com/x'))).toEqual([
      { kind: 'element', id: 'https://a.com/x' },
    ]);
  });
});

describe('flatten', () => {
  it('flattens objects to leaf paths with primitives, null and atomic arrays as leaves', () => {
    const value = {
      s: 'x',
      n: 1,
      b: true,
      nil: null,
      obj: { inner: { deep: 'v' } },
      arr: [1, 'a', null],
      empty: {},
      skipped: undefined,
    };
    const leaves = flatten(value, syncAll);
    expect(leaves).toEqual([
      { path: 'arr', value: [1, 'a', null] },
      { path: 'b', value: true },
      { path: 'n', value: 1 },
      { path: 'nil', value: null },
      { path: 'obj/inner/deep', value: 'v' },
      { path: 's', value: 'x' },
    ]);
  });

  it('escapes map keys containing slashes and tildes', () => {
    const leaves = flatten({ map: { 'https://a.com/x?v=1': 1, 'k~y': 2 } }, syncAll);
    expect(leaves).toEqual([
      { path: 'map/https:~1~1a.com~1x?v=1', value: 1 },
      { path: 'map/k~0y', value: 2 },
    ]);
  });

  it('emits a root leaf for scalar values', () => {
    expect(flatten('dark', syncAll)).toEqual([{ path: '', value: 'dark' }]);
    expect(flatten(null, syncAll)).toEqual([{ path: '', value: null }]);
  });

  it('emits nothing for empty objects', () => {
    expect(flatten({}, syncAll)).toEqual([]);
    expect(flatten({ a: {} }, syncAll)).toEqual([]);
  });

  it('encodes each element of a per-element array as <path>/@<id> with the whole element object', () => {
    const registry = withRules({
      elementArrays: [
        {
          path: ['items'],
          elementId: (el) => (el as { id: string }).id,
          stripFields: ['local'],
        },
      ],
    });
    const el = { id: 'a', v: 1, local: 'x' };
    const leaves = flatten({ items: [el, { id: 'b', v: 2 }] }, registry);
    expect(leaves).toEqual([
      { path: 'items/@a', value: { id: 'a', v: 1 } },
      { path: 'items/@b', value: { id: 'b', v: 2 } },
    ]);
  });

  it('supports a per-element array at the root', () => {
    const registry = withRules({
      elementArrays: [{ path: [], elementId: (el) => (el as { url: string }).url }],
    });
    const leaves = flatten([{ url: 'https://a.com/show' }], registry);
    expect(leaves).toEqual([
      { path: '@https:~1~1a.com~1show', value: { url: 'https://a.com/show' } },
    ]);
  });

  it('skips elements whose id cannot be derived', () => {
    const registry = withRules({
      elementArrays: [{ path: ['items'], elementId: () => null }],
    });
    expect(flatten({ items: [{ id: 'a' }] }, registry)).toEqual([]);
  });

  it('does not emit paths outside the synced set or under exclusions', () => {
    const registry: FieldRegistry = {
      syncedPaths: [['keep'], ['nested', 'ok']],
      excludedPaths: [['keep', 'secret'], ['nested', 'ok', '*']],
    };
    const leaves = flatten(
      {
        keep: { secret: 'x', shown: 1 },
        nested: { ok: { deep: 'no' } },
        other: 'no',
      },
      registry,
    );
    expect(leaves).toEqual([{ path: 'keep/shown', value: 1 }]);
  });
});

describe('unflatten', () => {
  it('rebuilds the object from live records (round-trip)', () => {
    const value = {
      a: 1,
      nested: { x: 'y', list: ['z', 2] },
      map: { 'k/~1': false },
    };
    const records = flatten(value, syncAll).map((l) => put(l.path, l.value));
    const { value: rebuilt, rejected } = unflatten(records, syncAll);
    expect(rejected).toEqual([]);
    expect(rebuilt).toEqual(value);
  });

  it('skips tombstone records', () => {
    const records: FlatRecord[] = [
      put('a', 1),
      { path: 'b', op: 'delete', hlc: h(2) },
    ];
    const { value } = unflatten(records, syncAll);
    expect(value).toEqual({ a: 1 });
  });

  it('orders elements by their order field when present', () => {
    const registry = withRules({
      elementArrays: [{ path: ['items'], elementId: (el) => (el as { id: string }).id }],
    });
    const records: FlatRecord[] = [
      put('items/@a', { id: 'a', order: 2 }, h(1), h(1)),
      put('items/@b', { id: 'b', order: 1 }, h(2), h(2)),
      put('items/@c', { id: 'c', order: 3 }, h(3), h(3)),
    ];
    const { value } = unflatten(records, registry);
    expect((value as { items: { id: string }[] }).items.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('orders elements by record firstHlc when no order field exists', () => {
    const registry = withRules({
      elementArrays: [{ path: ['items'], elementId: (el) => (el as { id: string }).id }],
    });
    const records: FlatRecord[] = [
      put('items/@b', { id: 'b' }, h(5), h(3)),
      put('items/@a', { id: 'a' }, h(9), h(1)),
      put('items/@c', { id: 'c' }, h(1), h(2)),
    ];
    const { value } = unflatten(records, registry);
    expect((value as { items: { id: string }[] }).items.map((e) => e.id)).toEqual(['a', 'c', 'b']);
  });

  it('falls back to the record hlc when firstHlc is absent', () => {
    const registry = withRules({
      elementArrays: [{ path: [], elementId: (el) => (el as { id: string }).id }],
    });
    const records: FlatRecord[] = [
      put('@b', { id: 'b' }, h(2)),
      put('@a', { id: 'a' }, h(1)),
    ];
    const { value } = unflatten(records, registry);
    expect((value as { id: string }[]).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('rejects unsynced, excluded, malformed element and leaf-conflicting paths', () => {
    const registry: FieldRegistry = {
      syncedPaths: [['a'], ['arr'], ['obj']],
      excludedPaths: [['a', 'local']],
      elementArrays: [{ path: ['arr'], elementId: (el) => (el as { id: string }).id }],
    };
    const records: FlatRecord[] = [
      put('nope/x', 1, h(1)),
      put('a/local', 'x', h(1)),
      put('obj/@x', 1, h(1)),
      put('arr/@x/inner', 1, h(1)),
      put('arr/@x', { id: 'x', ok: true }, h(1)),
      put('a/b', 2, h(1)),
    ];
    const { value, rejected } = unflatten(records, registry);
    expect(value).toEqual({ a: { b: 2 }, arr: [{ id: 'x', ok: true }] });
    expect(rejected.map((r) => r.path).sort()).toEqual([
      'a/local',
      'arr/@x/inner',
      'nope/x',
      'obj/@x',
    ]);
  });

  it('resolves leaf-vs-subtree shape conflicts by record hlc', () => {
    const high = unflatten([put('a', 'leaf', h(5)), put('a/b', 1, h(2))], syncAll);
    expect(high.value).toEqual({ a: 'leaf' });
    expect(high.rejected.map((r) => r.path)).toEqual(['a/b']);
    const low = unflatten([put('a', 'leaf', h(1)), put('a/b', 1, h(5))], syncAll);
    expect(low.value).toEqual({ a: { b: 1 } });
    expect(low.rejected.map((r) => r.path)).toEqual(['a']);
  });
});

describe('diffFlattened', () => {
  it('emits puts for new/changed leaves and tombstones for absent keys', () => {
    const prev = flatten({ a: 1, gone: 'x', items: 1 }, syncAll);
    const next = flatten({ a: 1, b: true }, syncAll);
    const diff = diffFlattened(prev, next);
    expect(diff.puts).toEqual([{ path: 'b', value: true }]);
    expect([...diff.tombstones].sort()).toEqual(['gone', 'items']);
  });

  it('treats removed elements as tombstones on their element key', () => {
    const registry = withRules({
      elementArrays: [{ path: ['items'], elementId: (el) => (el as { id: string }).id }],
    });
    const prev = flatten({ items: [{ id: 'a' }, { id: 'b' }] }, registry);
    const next = flatten({ items: [{ id: 'b', v: 9 }] }, registry);
    const diff = diffFlattened(prev, next);
    expect(diff.tombstones).toEqual(['items/@a']);
    expect(diff.puts).toEqual([{ path: 'items/@b', value: { id: 'b', v: 9 } }]);
  });
});

describe('firstHlc lifetimes', () => {
  it('resets firstHlc on a put after a tombstone', () => {
    expect(nextFirstHlc({ hlc: h(1), firstHlc: h(1), op: 'delete' }, h(5))).toEqual(h(5));
    expect(nextFirstHlc(undefined, h(5))).toEqual(h(5));
  });

  it('carries firstHlc across puts in the same lifetime', () => {
    expect(nextFirstHlc({ hlc: h(3), firstHlc: h(1), op: 'put' }, h(9))).toEqual(h(1));
    expect(nextFirstHlc({ hlc: h(3), op: 'put' }, h(9))).toEqual(h(3));
  });
});

describe('record key helpers', () => {
  it('builds and parses kv record keys', () => {
    expect(kvRecordKey('settings', 'a/b')).toBe('kv:settings/a/b');
    expect(kvRecordKey('themeMode', '')).toBe('kv:themeMode');
    expect(kvRecordPath('settings', 'kv:settings/a/b')).toBe('a/b');
    expect(kvRecordPath('settings', 'kv:settings')).toBe('');
    expect(kvRecordPath('settings', 'kv:settingsX/a')).toBeNull();
    expect(kvRecordPath('settings', 'profile/x')).toBeNull();
  });

  it('builds profile record keys', () => {
    expect(profileRecordKey('')).toBe('profile');
    expect(profileRecordKey('dictionaryPopup/enabled')).toBe('profile/dictionaryPopup/enabled');
  });

  it('classifies materializable kv paths', () => {
    expect(isMaterializablePath('a/b', syncAll)).toBe(true);
    expect(
      isMaterializablePath('x', { syncedPaths: [['a']] }),
    ).toBe(false);
  });
});
