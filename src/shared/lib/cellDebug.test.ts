import { describe, expect, it, afterEach } from '@jest/globals';
import { isCellDebug } from './cellDebug';

describe('isCellDebug', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__CELL_DEBUG__;
  });

  it('returns false when __CELL_DEBUG__ is undefined', () => {
    expect(isCellDebug()).toBe(false);
  });

  it('returns true only for the literal string "true"', () => {
    (globalThis as Record<string, unknown>).__CELL_DEBUG__ = 'true';
    expect(isCellDebug()).toBe(true);
  });

  it('returns false for other values', () => {
    const g = globalThis as Record<string, unknown>;
    for (const v of ['false', '1', 'TRUE', '', true, 1]) {
      g.__CELL_DEBUG__ = v;
      expect(isCellDebug()).toBe(false);
    }
  });
});
