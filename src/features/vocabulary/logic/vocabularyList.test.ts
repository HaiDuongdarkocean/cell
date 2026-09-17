import {
  upsertEntry,
  removeEntry,
  selectEntries,
  paginateEntries,
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

describe('paginateEntries', () => {
  const entries = Array.from({ length: 5 }, (_, i) => entry(`t${i}`, 'known', i));

  it('slices the requested page', () => {
    const page = paginateEntries(entries, 2, 1);
    expect(page.entries.map((e) => e.term)).toEqual(['t2', 't3']);
    expect(page.pageCount).toBe(3);
    expect(page.total).toBe(5);
  });

  it('clamps an out-of-range page index (A18)', () => {
    const page = paginateEntries(entries, 2, 10);
    expect(page.pageIndex).toBe(2);
    expect(page.entries.map((e) => e.term)).toEqual(['t4']);
  });

  it('returns one empty page for an empty list', () => {
    const page = paginateEntries([], 2, 0);
    expect(page.pageIndex).toBe(0);
    expect(page.entries).toEqual([]);
  });
});
