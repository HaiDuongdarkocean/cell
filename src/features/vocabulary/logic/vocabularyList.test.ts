import {
  upsertEntry,
  removeEntry,
  selectEntries,
  selectAllTerms,
  pruneSelection,
  snapshotStatuses,
  groupByStatus,
  type VocabularyEntry,
} from './vocabularyList';

const entry = (term: string, status: VocabularyEntry['status'], updatedAt: number): VocabularyEntry => ({
  term,
  status,
  updatedAt,
});

const ALL = new Set(['unknown', 'tracking', 'known', 'ignore'] as const);

describe('upsertEntry', () => {
  it('appends a new term', () => {
    const result = upsertEntry([entry('a', 'known', 1)], 'b', 'tracking', 5);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ term: 'b', status: 'tracking', updatedAt: 5 });
  });

  it('replaces an existing term status', () => {
    const result = upsertEntry([entry('a', 'known', 1)], 'a', 'ignore', 9);
    expect(result).toEqual([{ term: 'a', status: 'ignore', updatedAt: 9 }]);
  });
});

describe('removeEntry', () => {
  it('removes the term', () => {
    expect(removeEntry([entry('a', 'known', 1), entry('b', 'known', 2)], 'a')).toEqual([
      { term: 'b', status: 'known', updatedAt: 2 },
    ]);
  });
});

describe('selectEntries', () => {
  const entries = [
    entry('apple', 'known', 10),
    entry('Banana', 'tracking', 30),
    entry('cherry', 'unknown', 20),
    entry('date', 'ignore', 40),
  ];

  it('filters by status set', () => {
    const result = selectEntries(entries, { statuses: new Set(['tracking']), query: '' }, 'recent');
    expect(result).toEqual([{ term: 'Banana', status: 'tracking', updatedAt: 30 }]);
  });

  it('empty status set shows nothing', () => {
    expect(selectEntries(entries, { statuses: new Set(), query: '' }, 'recent')).toEqual([]);
  });

  it('searches case-insensitive substring', () => {
    const result = selectEntries(entries, { statuses: ALL, query: 'AN' }, 'recent');
    expect(result.map((e) => e.term)).toEqual(['Banana']);
  });

  it('sorts recent by updatedAt desc', () => {
    const result = selectEntries(entries, { statuses: ALL, query: '' }, 'recent');
    expect(result.map((e) => e.term)).toEqual(['date', 'Banana', 'cherry', 'apple']);
  });

  it('sorts alpha case-insensitively', () => {
    const result = selectEntries(entries, { statuses: ALL, query: '' }, 'alpha');
    expect(result.map((e) => e.term)).toEqual(['apple', 'Banana', 'cherry', 'date']);
  });

  it('sorts grouped by status cycle then recent', () => {
    const result = selectEntries(entries, { statuses: ALL, query: '' }, 'grouped');
    expect(result.map((e) => e.status)).toEqual(['unknown', 'tracking', 'known', 'ignore']);
  });
});

describe('selectAllTerms', () => {
  it('returns every term in the filtered result', () => {
    const selected = selectAllTerms([entry('a', 'known', 1), entry('b', 'tracking', 2)]);
    expect([...selected].sort()).toEqual(['a', 'b']);
  });

  it('returns an empty set for an empty list', () => {
    expect(selectAllTerms([]).size).toBe(0);
  });
});

describe('pruneSelection', () => {
  it('drops selected terms that vanished from the source', () => {
    const pruned = pruneSelection(new Set(['a', 'gone', 'b']), [
      entry('a', 'known', 1),
      entry('b', 'known', 2),
    ]);
    expect([...pruned].sort()).toEqual(['a', 'b']);
  });

  it('keeps the full selection when every term still exists', () => {
    const pruned = pruneSelection(new Set(['a']), [entry('a', 'known', 1), entry('x', 'known', 2)]);
    expect([...pruned]).toEqual(['a']);
  });

  it('returns an empty set for an empty selection', () => {
    expect(pruneSelection(new Set(), [entry('a', 'known', 1)]).size).toBe(0);
  });
});

describe('snapshotStatuses', () => {
  const entries = [entry('a', 'known', 1), entry('b', 'tracking', 2), entry('c', 'ignore', 3)];

  it('captures previous statuses for the given terms', () => {
    const map = snapshotStatuses(entries, new Set(['a', 'c']));
    expect(map.get('a')).toBe('known');
    expect(map.get('c')).toBe('ignore');
    expect(map.has('b')).toBe(false);
  });

  it('skips terms that are not in the list', () => {
    const map = snapshotStatuses(entries, ['a', 'ghost']);
    expect(map.size).toBe(1);
  });
});

describe('groupByStatus', () => {
  it('groups terms by their previous status for undo writes', () => {
    const groups = groupByStatus(
      new Map<string, VocabularyEntry['status']>([
        ['a', 'known'],
        ['b', 'tracking'],
        ['c', 'known'],
      ]),
    );
    expect(groups.get('known')?.sort()).toEqual(['a', 'c']);
    expect(groups.get('tracking')).toEqual(['b']);
    expect(groups.has('ignore')).toBe(false);
  });
});
