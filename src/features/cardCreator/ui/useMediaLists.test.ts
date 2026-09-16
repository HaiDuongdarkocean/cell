import { describe, expect, it } from '@jest/globals';
import { reorderItems } from './useMediaLists';

describe('reorderItems', () => {
  it('moves an item forward', () => {
    expect(reorderItems(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves an item backward', () => {
    expect(reorderItems(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns an equal list when from === to', () => {
    expect(reorderItems(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    reorderItems(input, 0, 1);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
