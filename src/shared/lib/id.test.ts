import { newId } from './id';

describe('newId', () => {
  it('returns non-empty unique strings', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it('falls back to timestamp-random ids when crypto is missing', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    try {
      const id = newId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
