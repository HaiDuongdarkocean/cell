import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';

export interface VocabularyEntry {
  readonly term: string;
  readonly status: WordStatus;
  readonly updatedAt: number;
}

export type VocabularySort = 'recent' | 'alpha' | 'grouped';

export const VOCABULARY_SEGMENTS = ['all', 'tracking', 'learning', 'known', 'ignore', 'trash'] as const;
export type VocabularySegment = (typeof VOCABULARY_SEGMENTS)[number];

export const MARKED_STATUSES: readonly WordStatus[] = ['tracking', 'learning', 'known', 'ignore'];

export function nextMarkedStatus(status: WordStatus): WordStatus {
  const index = MARKED_STATUSES.indexOf(status);
  return MARKED_STATUSES[(index + 1) % MARKED_STATUSES.length] ?? 'tracking';
}

export function statusesForSegment(segment: VocabularySegment): ReadonlySet<WordStatus> {
  if (segment === 'all') return new Set(MARKED_STATUSES);
  if (segment === 'trash') return new Set();
  return new Set([segment]);
}

export function countByStatus(entries: readonly VocabularyEntry[]): Record<WordStatus, number> {
  const counts: Record<WordStatus, number> = { unknown: 0, tracking: 0, learning: 0, known: 0, ignore: 0 };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

export function filterTrashEntries<T extends { readonly term: string }>(
  entries: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return q === '' ? [...entries] : entries.filter((e) => e.term.toLowerCase().includes(q));
}

export function trashHoursLeft(trashedAt: number, now: number, ttlMs: number): number {
  return Math.max(0, Math.ceil((trashedAt + ttlMs - now) / (60 * 60 * 1000)));
}

export interface VocabularyFilter {
  readonly statuses: ReadonlySet<WordStatus>;
  readonly query: string;
}

export interface VocabularyPage<T = VocabularyEntry> {
  readonly entries: readonly T[];
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

export function paginateEntries<T>(
  sorted: readonly T[],
  pageSize: number,
  pageIndex: number,
): VocabularyPage<T> {
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clamped = Math.min(Math.max(0, pageIndex), pageCount - 1);
  return {
    entries: sorted.slice(clamped * pageSize, clamped * pageSize + pageSize),
    pageIndex: clamped,
    pageCount,
    total: sorted.length,
  };
}
