// lruCache unit tests — spec §9.5: hard cap + deterministic eviction.

import { describe, expect, it } from '@jest/globals';
import { LruCache } from './lruCache';

describe('LruCache — construction', () => {
  it('rejects non-positive cap', () => {
    expect(() => new LruCache<string, number>(0)).toThrow();
    expect(() => new LruCache<string, number>(-1)).toThrow();
    expect(() => new LruCache<string, number>(1.5)).toThrow();
  });

  it('starts empty', () => {
    const cache = new LruCache<string, number>(10);
    expect(cache.size).toBe(0);
    expect(cache.capacity).toBe(10);
  });
});

describe('LruCache — basic get/set/has', () => {
  it('stores and retrieves a value', () => {
    const cache = new LruCache<string, number>(10);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.has('a')).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('returns undefined on miss', () => {
    const cache = new LruCache<string, number>(10);
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  it('peek does not update recency', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.peek('a'); // no recency update
    cache.set('c', 3); // should evict 'a' (least recent)
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('set on existing key updates value + moves to end', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10); // update + move to end
    cache.set('c', 3); // evict 'b' (now least recent)
    expect(cache.get('a')).toBe(10);
    expect(cache.has('b')).toBe(false);
    expect(cache.get('c')).toBe(3);
  });
});

describe('LruCache — hard cap + eviction', () => {
  it('evicts the least-recently-used when cap is exceeded', () => {
    const cache = new LruCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);

    const evicted = cache.set('d', 4);
    expect(evicted).toBe('a');
    expect(cache.size).toBe(3);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('get marks an entry most-recently-used, saving it from eviction', () => {
    const cache = new LruCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // 'a' is now most recent
    cache.set('d', 4); // evicts 'b' (least recent), not 'a'
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('enforces exactly the cap (10k)', () => {
    const cache = new LruCache<number, number>(10000);
    for (let i = 0; i < 15000; i++) {
      cache.set(i, i * 2);
    }
    expect(cache.size).toBe(10000);
    // First 5000 evicted; 5000-14999 resident.
    expect(cache.has(0)).toBe(false);
    expect(cache.has(4999)).toBe(false);
    expect(cache.has(5000)).toBe(true);
    expect(cache.has(14999)).toBe(true);
    expect(cache.get(14999)).toBe(29998);
  });

  it('eviction order is deterministic across repeated runs', () => {
    function run(): string[] {
      const cache = new LruCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a');
      cache.set('d', 4);
      cache.get('b'); // miss, no effect
      cache.set('e', 5);
      return [...cache.keys()];
    }
    expect(run()).toEqual(run());
  });
});

describe('LruCache — delete + clear', () => {
  it('delete removes an entry', () => {
    const cache = new LruCache<string, number>(10);
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('delete returns false for missing key', () => {
    const cache = new LruCache<string, number>(10);
    expect(cache.delete('missing')).toBe(false);
  });

  it('clear removes all entries', () => {
    const cache = new LruCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
  });
});

describe('LruCache — iteration', () => {
  it('entries yields in most-recently-used-last order', () => {
    const cache = new LruCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // order: b, c, a
    expect([...cache.keys()]).toEqual(['b', 'c', 'a']);
    expect([...cache.entries()]).toEqual([
      ['b', 2],
      ['c', 3],
      ['a', 1],
    ]);
  });
});
