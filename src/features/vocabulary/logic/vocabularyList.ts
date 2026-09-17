import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';

export interface VocabularyEntry {
  readonly term: string;
  readonly status: WordStatus;
  readonly updatedAt: number;
}

export type VocabularySort = 'recent' | 'alpha' | 'grouped';

export interface VocabularyFilter {
  readonly statuses: ReadonlySet<WordStatus>;
  readonly query: string;
}

export interface VocabularyPage {
  readonly entries: readonly VocabularyEntry[];
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly total: number;
}

export function upsertEntry(
  entries: readonly VocabularyEntry[],
  term: string,
  status: WordStatus,
  updatedAt: number,
): VocabularyEntry[] {
  const index = entries.findIndex((e) => e.term === term);
  if (index === -1) return [...entries, { term, status, updatedAt }];
  const next = entries.slice();
  next[index] = { term, status, updatedAt };
  return next;
}

export function removeEntry(
  entries: readonly VocabularyEntry[],
  term: string,
): VocabularyEntry[] {
  return entries.filter((e) => e.term !== term);
}

export function selectEntries(
  entries: readonly VocabularyEntry[],
  filter: VocabularyFilter,
  sort: VocabularySort,
): VocabularyEntry[] {
  const query = filter.query.trim().toLowerCase();
  const filtered = entries.filter(
    (e) =>
      filter.statuses.has(e.status) &&
      (query === '' || e.term.toLowerCase().includes(query)),
  );
  const sorted = filtered.slice();
  if (sort === 'recent') {
    sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  } else if (sort === 'alpha') {
    sorted.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  } else {
    const order = new Map(STATUS_CYCLE.map((s, i) => [s, i]));
    sorted.sort(
      (a, b) => (order.get(a.status) ?? 0) - (order.get(b.status) ?? 0) || b.updatedAt - a.updatedAt,
    );
  }
  return sorted;
}

export function paginateEntries(
  sorted: readonly VocabularyEntry[],
  pageSize: number,
  pageIndex: number,
): VocabularyPage {
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clamped = Math.min(Math.max(0, pageIndex), pageCount - 1);
  return {
    entries: sorted.slice(clamped * pageSize, clamped * pageSize + pageSize),
    pageIndex: clamped,
    pageCount,
    total: sorted.length,
  };
}
