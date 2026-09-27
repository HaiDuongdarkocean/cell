import { describe, expect, it } from '@jest/globals';
import { stableHash, stableJson } from './stableHash';

describe('stableJson', () => {
  it('is insensitive to object key order', () => {
    expect(stableJson({ b: 1, a: 2 })).toBe(stableJson({ a: 2, b: 1 }));
  });

  it('sorts keys recursively', () => {
    expect(stableJson({ z: { b: 1, a: 2 }, a: 1 })).toBe('{"a":1,"z":{"a":2,"b":1}}');
  });

  it('preserves array order', () => {
    expect(stableJson([2, 1])).not.toBe(stableJson([1, 2]));
  });
});

describe('stableHash', () => {
  it('is deterministic', () => {
    const value = { key: 'cards:1', op: 'put', hlc: { wall: 5, counter: 0, node: 'd1' } };
    expect(stableHash(value)).toBe(stableHash(value));
  });

  it('is insensitive to key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('differs for different values', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });

  it('returns an 8-char lowercase hex string', () => {
    expect(stableHash({ x: 'cell' })).toMatch(/^[0-9a-f]{8}$/);
  });
});
