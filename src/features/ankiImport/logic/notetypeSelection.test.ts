import { nextEnabledNotetypeId, pillNotetypes } from './notetypeSelection';
import type { NormalizedAnkiNotetype } from '../model/normalized';

const nt = (id: string, name = id): NormalizedAnkiNotetype => ({
  id,
  name,
  isCloze: false,
  fields: [],
});

const counts = (entries: Record<string, number>): ReadonlyMap<string, number> =>
  new Map(Object.entries(entries));

describe('pillNotetypes', () => {
  const nts = [nt('a'), nt('b'), nt('c')];

  it('keeps enabled notetypes with cards, in order', () => {
    expect(pillNotetypes(nts, new Set(['a', 'b', 'c']), counts({ a: 3, b: 1, c: 2 })).map((n) => n.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('drops disabled notetypes', () => {
    expect(pillNotetypes(nts, new Set(['a', 'c']), counts({ a: 3, b: 1, c: 2 })).map((n) => n.id))
      .toEqual(['a', 'c']);
  });

  it('drops enabled notetypes with zero cards', () => {
    expect(pillNotetypes(nts, new Set(['a', 'b']), counts({ a: 3, b: 0 })).map((n) => n.id))
      .toEqual(['a']);
  });

  it('returns empty when all disabled', () => {
    expect(pillNotetypes(nts, new Set(), counts({ a: 3, b: 1 }))).toEqual([]);
  });
});

describe('nextEnabledNotetypeId', () => {
  const nts = [nt('a'), nt('b'), nt('c'), nt('d')];
  const all = counts({ a: 2, b: 5, c: 1, d: 4 });

  it('picks the next enabled notetype after the removed one', () => {
    expect(nextEnabledNotetypeId(nts, new Set(['a', 'c', 'd']), all, 'b')).toBe('c');
  });

  it('wraps to the start of the list', () => {
    expect(nextEnabledNotetypeId(nts, new Set(['a', 'b']), all, 'd')).toBe('a');
  });

  it('skips enabled notetypes with zero cards', () => {
    const withZero = counts({ a: 2, b: 5, c: 0, d: 4 });
    expect(nextEnabledNotetypeId(nts, new Set(['a', 'c', 'd']), withZero, 'b')).toBe('d');
  });

  it('returns null when nothing qualifies', () => {
    expect(nextEnabledNotetypeId(nts, new Set(), all, 'b')).toBeNull();
  });

  it('skips the removed id itself even if still enabled in the set', () => {
    expect(nextEnabledNotetypeId(nts, new Set(['a', 'b', 'c']), all, 'b')).toBe('c');
  });
});
