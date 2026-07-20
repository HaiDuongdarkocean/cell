import { LruCache } from '@/features/dictionaryPopup/logic/lruCache';
import type { TokenBlock } from '@/features/tokenize/types';

export interface TokenizeCacheOptions {
  readonly capacity: number;
  readonly onEvict?: (block: TokenBlock) => void;
}

/** Bounded LRU cache for tokenized blocks with DOM-to-block WeakMap. */
export class TokenizeCache {
  private readonly cache: LruCache<string, TokenBlock>;
  private readonly domMap = new WeakMap<Element, TokenBlock>();
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
    if (!this.cache.has(block.id) && this.cache.size >= this.cache.capacity) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        const evicted = this.cache.peek(oldestKey);
        if (evicted) this.onEvict?.(evicted);
      }
    }
    this.cache.set(block.id, block);
    this.domMap.set(block.element, block);
  }

  /** Remove a block by id. */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /** Look up block from its DOM element. */
  getByElement(element: Element): TokenBlock | undefined {
    return this.domMap.get(element);
  }

  /** Remove all blocks. */
  clear(): void {
    this.cache.clear();
  }
}
