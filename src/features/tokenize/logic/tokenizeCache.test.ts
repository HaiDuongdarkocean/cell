import { describe, expect, it } from '@jest/globals';
import { TokenizeCache } from './tokenizeCache';
import type { TokenBlock } from '@/features/tokenize/types';

function makeBlock(id: string, text: string): TokenBlock {
  const element = document.createElement('p');
  const textNode = document.createTextNode(text);
  element.appendChild(textNode);
  return {
    id,
    element,
    sourceNodes: [textNode],
    originalText: text,
    tokens: undefined,
    isBound: false,
    lastAccessedAt: 0,
  };
}

describe('TokenizeCache', () => {
  it('stores and retrieves blocks', () => {
    const cache = new TokenizeCache({ capacity: 3 });
    const block = makeBlock('a', 'hello');
    cache.set(block);
    expect(cache.get('a')).toBe(block);
    expect(cache.getByElement(block.element)).toContain(block);
  });

  it('evicts LRU when over capacity', () => {
    const evicted: TokenBlock[] = [];
    const cache = new TokenizeCache({
      capacity: 2,
      onEvict: (block) => evicted.push(block),
    });
    const a = makeBlock('a', 'a');
    const b = makeBlock('b', 'b');
    const c = makeBlock('c', 'c');
    cache.set(a);
    cache.set(b);
    cache.set(c);
    expect(cache.has('a')).toBe(false);
    expect(evicted).toContain(a);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('updates recency on get', () => {
    const evicted: TokenBlock[] = [];
    const cache = new TokenizeCache({
      capacity: 2,
      onEvict: (block) => evicted.push(block),
    });
    const a = makeBlock('a', 'a');
    const b = makeBlock('b', 'b');
    const c = makeBlock('c', 'c');
    cache.set(a);
    cache.set(b);
    cache.get('a');
    cache.set(c);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(evicted).toContain(b);
  });
});
