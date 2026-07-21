import { LruCache } from '@/features/dictionaryPopup/logic/lruCache';
import type { TokenBlock } from '@/features/tokenize/types';

export interface TokenizeCacheOptions {
  readonly capacity: number;
  readonly onEvict?: (block: TokenBlock) => void;
}

/** Bounded LRU cache for tokenized blocks with DOM-to-block WeakMap. */
export class TokenizeCache {
  private readonly cache: LruCache<string, TokenBlock>;
  private readonly domMap = new WeakMap<Element, Set<TokenBlock>>();
  private readonly onEvict?: (block: TokenBlock) => void;

  constructor({ capacity, onEvict }: TokenizeCacheOptions) {
    this.cache = new LruCache<string, TokenBlock>(capacity);
    this.onEvict = onEvict;
  }

  /** Current resident block count. */
  get size(): number {
    return this.cache.size;
  }

  /** Hard cap. */
  get capacity(): number {
    return this.cache.capacity;
  }

  /** Retrieve a block and mark it most-recently-used. */
  get(id: string): TokenBlock | undefined {
    return this.cache.get(id);
  }

  /** Check membership without updating recency. */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /** Store a block; evict LRU if over capacity. */
  set(block: TokenBlock): void {
    let evicted: TokenBlock | undefined;
    if (!this.cache.has(block.id) && this.cache.size >= this.cache.capacity) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        evicted = this.cache.peek(oldestKey);
      }
    }
    this.cache.set(block.id, block);
    if (evicted) this.onEvict?.(evicted);
    let set = this.domMap.get(block.element);
    if (!set) {
      set = new Set();
      this.domMap.set(block.element, set);
    }
    set.add(block);
  }

  /** Remove a block by id. */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /** Mark a resident block as recently used (prevents visible blocks from being evicted). */
  touch(block: TokenBlock): void {
    this.cache.get(block.id);
  }

  /** Look up all blocks sharing a DOM element. */
  getByElement(element: Element): TokenBlock[] {
    const set = this.domMap.get(element);
    return set ? [...set] : [];
  }

  /** Remove all blocks. */
  clear(): void {
    this.cache.clear();
  }
}
