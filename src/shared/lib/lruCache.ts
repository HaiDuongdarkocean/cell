// lruCache — bounded LRU for the lookup worker (spec §9.5).
//
// O(1) get/set/eviction using Map insertion order. Hard cap is enforced on
// every set: when size exceeds cap, the least-recently-used entry is evicted.
// The worker holds one LRU for definitions (key = term, value = entries).
//
// Pure data structure — no IndexedDB, no worker deps. Tested in isolation.

/** Bounded LRU cache. K must be a string or number (Map key). */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly cap: number;

  constructor(cap: number) {
    if (!Number.isInteger(cap) || cap <= 0) {
      throw new Error(`LruCache cap must be a positive integer, got ${cap}`);
    }
    this.cap = cap;
  }

  /** Current number of resident entries. */
  get size(): number {
    return this.map.size;
  }

  /** Hard cap (max resident entries). */
  get capacity(): number {
    return this.cap;
  }

  /** Get a value and mark it most-recently-used. Returns undefined on miss. */
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    // Move to end (most recent) by delete + re-insert.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** Check membership without updating recency. */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Get a value without updating recency. Returns undefined on miss. */
  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  /**
   * Insert/replace a value. If size exceeds cap, evict the least-recently-used
   * entry. Returns the evicted key (or undefined if no eviction) so callers
   * can track evictions.
   */
  set(key: K, value: V): K | undefined {
    let evicted: K | undefined;
    if (this.map.has(key)) {
      // Update in place + move to end.
      this.map.delete(key);
    } else if (this.map.size >= this.cap) {
      // Evict the oldest (first) key.
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
        evicted = firstKey;
      }
    }
    this.map.set(key, value);
    return evicted;
  }

  /** Remove an entry. Returns true if it was present. */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** Remove all entries. */
  clear(): void {
    this.map.clear();
  }

  /** Iterate over entries in most-recently-used-last order. */
  *entries(): IterableIterator<[K, V]> {
    yield* this.map.entries();
  }

  /** Iterate over keys in most-recently-used-last order. */
  *keys(): IterableIterator<K> {
    yield* this.map.keys();
  }
}
