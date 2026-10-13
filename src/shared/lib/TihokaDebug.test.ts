import { describe, expect, it, afterEach } from '@jest/globals';
import { isTihokaDebug } from './TihokaDebug';

describe('isTihokaDebug', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__Tihoka_DEBUG__;
  });

  it('returns false when __Tihoka_DEBUG__ is undefined', () => {
    expect(isTihokaDebug()).toBe(false);
  });

  it('returns true only for the literal string "true"', () => {
    (globalThis as Record<string, unknown>).__Tihoka_DEBUG__ = 'true';
    expect(isTihokaDebug()).toBe(true);
  });

  it('returns false for other values', () => {
    const g = globalThis as Record<string, unknown>;
    for (const v of ['false', '1', 'TRUE', '', true, 1]) {
      g.__Tihoka_DEBUG__ = v;
      expect(isTihokaDebug()).toBe(false);
    }
  });
});
