import { DeterministicIdSource } from './DeterministicIdSource';
import { InMemoryKeyValueStore } from './InMemoryKeyValueStore';
import { SeededClock } from './SeededClock';

describe('InMemoryKeyValueStore', () => {
  it('gets, sets, deletes and lists per area', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('local', 'b', 2);
    await kv.set('local', 'a', 1);
    await kv.set('session', 'a', 'session-only');

    expect(await kv.get<number>('local', 'a')).toBe(1);
    expect(await kv.get('local', 'missing')).toBeUndefined();
    expect(await kv.get('local', 'a')).not.toBe(await kv.get('session', 'a'));

    expect(await kv.list('local', '')).toEqual(['a', 'b']);
    expect(await kv.list('session', '')).toEqual(['a']);

    await kv.del('local', 'a');
    expect(await kv.get('local', 'a')).toBeUndefined();
    expect(await kv.list('local', '')).toEqual(['b']);
  });

  it('lists keys by prefix only', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('local', 'syncCursors:x', 1);
    await kv.set('local', 'syncCursors:y', 2);
    await kv.set('local', 'syncMetaKV', 3);
    expect(await kv.list('local', 'syncCursors:')).toEqual(['syncCursors:x', 'syncCursors:y']);
    expect(await kv.list('local', 'nope')).toEqual([]);
  });
});

describe('SeededClock', () => {
  it('returns the seed and advances deterministically', () => {
    const clock = new SeededClock(100);
    expect(clock.now()).toBe(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
    clock.set(7);
    expect(clock.now()).toBe(7);
  });

  it('defaults to zero', () => {
    expect(new SeededClock().now()).toBe(0);
  });
});

describe('DeterministicIdSource', () => {
  it('produces sequential uuid-shaped ids', () => {
    const ids = new DeterministicIdSource();
    const first = ids.uuid();
    const second = ids.uuid();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe('00000000-0000-4000-8000-000000000002');
  });
});
