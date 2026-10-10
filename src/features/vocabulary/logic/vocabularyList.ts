import type { WordStatus } from '@/entities/dictionary';

export interface VocabularyEntry {
  readonly term: string;
  readonly status: WordStatus;
  readonly updatedAt: number;
}

export type VocabularySort = 'recent' | 'alpha' | 'grouped';

export const VOCABULARY_SEGMENTS = ['all', 'tracking', 'known', 'ignore'] as const;
export type VocabularySegment = (typeof VOCABULARY_SEGMENTS)[number];

export const MARKED_STATUSES: readonly WordStatus[] = ['tracking', 'known', 'ignore'];
export type MarkedStatus = Exclude<WordStatus, 'unknown'>;

export function nextMarkedStatus(status: WordStatus): WordStatus {
  const index = MARKED_STATUSES.indexOf(status);
  return MARKED_STATUSES[(index + 1) % MARKED_STATUSES.length] ?? 'tracking';
}

export function statusesForSegment(segment: VocabularySegment): ReadonlySet<WordStatus> {
  if (segment === 'all') {
    return new Set<WordStatus>(VOCABULARY_SEGMENTS.filter((s) => s !== 'all'));
  }
  return new Set([segment]);
}

export function countByStatus(entries: readonly VocabularyEntry[]): Record<WordStatus, number> {
  const counts: Record<WordStatus, number> = { unknown: 0, tracking: 0, known: 0, ignore: 0 };
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
    const order = new Map<string, number>(VOCABULARY_SEGMENTS.map((s, i) => [s, i]));
    sorted.sort(
      (a, b) => (order.get(a.status) ?? 0) - (order.get(b.status) ?? 0) || b.updatedAt - a.updatedAt,
    );
  }
  return sorted;
}

export function selectAllTerms(entries: readonly VocabularyEntry[]): Set<string> {
  return new Set(entries.map((e) => e.term));
}

export function pruneSelection(
  selection: ReadonlySet<string>,
  entries: readonly { readonly term: string }[],
): Set<string> {
  if (selection.size === 0) return new Set();
  const present = new Set(entries.map((e) => e.term));
  let dropped = false;
  const next = new Set<string>();
  for (const term of selection) {
    if (present.has(term)) next.add(term);
    else dropped = true;
  }
  return dropped ? next : new Set(selection);
}

export function snapshotStatuses(
  entries: readonly VocabularyEntry[],
  terms: Iterable<string>,
): Map<string, WordStatus> {
  const wanted = new Set(terms);
  const map = new Map<string, WordStatus>();
  for (const entry of entries) {
    if (wanted.has(entry.term)) map.set(entry.term, entry.status);
  }
  return map;
}

export function groupByStatus(
  statuses: ReadonlyMap<string, WordStatus>,
): Map<WordStatus, string[]> {
  const groups = new Map<WordStatus, string[]>();
  for (const [term, status] of statuses) {
    const list = groups.get(status);
    if (list) list.push(term);
    else groups.set(status, [term]);
  }
  return groups;
}
