// resourcePriority tests — Task 1.4: deterministic multi-resource ordering.

import { describe, expect, it } from '@jest/globals';
import {
  sortResidentIndexesByPriority,
  pickWinnerByPriority,
} from './resourcePriority';
import type { ResidentPhraseIndex } from './phraseIndexLoader';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

function fakeResident(resourceId: number): ResidentPhraseIndex {
  const index = {
    compilerVersion: 1,
    termCount: 0,
    templates: [],
    anchorKeys: [],
    anchorCount: 0,
    lookupByAnchor: () => [],
    byteSize: 100,
  } as unknown as PhraseIndex;
  return { resourceId, index, anchorMap: new Map(), byteSize: 100 };
}

describe('sortResidentIndexesByPriority', () => {
  it('sorts by resourceId descending by default (newest import first)', () => {
    const sorted = sortResidentIndexesByPriority([
      fakeResident(1),
      fakeResident(3),
      fakeResident(2),
    ]);
    expect(sorted.map((r) => r.resourceId)).toEqual([3, 2, 1]);
  });

  it('respects an explicit priorityMap (lower rank = higher priority)', () => {
    const priority = new Map([
      [1, 10],
      [2, 5],
      [3, 1],
    ]);
    const sorted = sortResidentIndexesByPriority(
      [fakeResident(1), fakeResident(2), fakeResident(3)],
      priority,
    );
    expect(sorted.map((r) => r.resourceId)).toEqual([3, 2, 1]);
  });

  it('priorityMap overrides resourceId order', () => {
    const priority = new Map([
      [3, 5],
      [1, 1],
    ]);
    const sorted = sortResidentIndexesByPriority(
      [fakeResident(1), fakeResident(3)],
      priority,
    );
    // resourceId 1 has rank 1 (higher priority) → comes first despite lower id.
    expect(sorted.map((r) => r.resourceId)).toEqual([1, 3]);
  });

  it('resources not in priorityMap sort after mapped ones, by resourceId desc', () => {
    const priority = new Map([[2, 1]]);
    const sorted = sortResidentIndexesByPriority(
      [fakeResident(1), fakeResident(2), fakeResident(5)],
      priority,
    );
    // resourceId 2 (mapped, rank 1) first; then 5 and 1 (unmapped, desc).
    expect(sorted.map((r) => r.resourceId)).toEqual([2, 5, 1]);
  });

  it('does not mutate the input array', () => {
    const input = [fakeResident(1), fakeResident(3), fakeResident(2)];
    const inputIds = input.map((r) => r.resourceId);
    sortResidentIndexesByPriority(input);
    expect(input.map((r) => r.resourceId)).toEqual(inputIds);
  });
});

describe('pickWinnerByPriority', () => {
  it('returns undefined for empty candidates', () => {
    expect(pickWinnerByPriority([])).toBeUndefined();
  });

  it('picks the highest-resourceId candidate by default', () => {
    const winner = pickWinnerByPriority([
      { resident: fakeResident(1), match: 'a' },
      { resident: fakeResident(3), match: 'b' },
      { resident: fakeResident(2), match: 'c' },
    ]);
    expect(winner?.resident.resourceId).toBe(3);
  });

  it('respects an explicit priorityMap', () => {
    const priority = new Map([[1, 1]]);
    const winner = pickWinnerByPriority(
      [
        { resident: fakeResident(1), match: 'a' },
        { resident: fakeResident(3), match: 'b' },
      ],
      priority,
    );
    expect(winner?.resident.resourceId).toBe(1);
  });
});
