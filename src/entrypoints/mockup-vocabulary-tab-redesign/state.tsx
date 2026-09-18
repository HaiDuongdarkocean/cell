import { useMemo, useState } from 'react';
import {
  MOCK_ENTRIES,
  MOCK_TRASH,
  type MockEntry,
  type MockStatus,
  type MockTrashEntry,
} from './mockData';

export type Segment = 'all' | MockStatus | 'trash';
export type Sort = 'recent' | 'alpha' | 'grouped';

export const SEGMENT_ORDER: readonly MockStatus[] = ['tracking', 'known', 'ignore'];

const NEXT_STATUS: Record<MockStatus, MockStatus | null> = {
  tracking: 'known',
  known: 'ignore',
  ignore: null,
};

export interface VocabMock {
  readonly segment: Segment;
  readonly setSegment: (s: Segment) => void;
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly sort: Sort;
  readonly setSort: (s: Sort) => void;
  readonly editMode: boolean;
  readonly setEditMode: (v: boolean) => void;
  readonly pendingDelete: string | null;
  readonly setPendingDelete: (t: string | null) => void;
  readonly pendingPurge: string | null;
  readonly setPendingPurge: (t: string | null) => void;
  readonly visible: readonly MockEntry[];
  readonly trashVisible: readonly MockTrashEntry[];
  readonly counts: Record<Segment, number>;
  readonly cycle: (term: string) => void;
  readonly remove: (term: string) => void;
  readonly restore: (term: string) => void;
  readonly purge: (term: string) => void;
}

export function useVocabMock(): VocabMock {
  const [entries, setEntries] = useState<MockEntry[]>(MOCK_ENTRIES);
  const [trash, setTrash] = useState<MockTrashEntry[]>(MOCK_TRASH);
  const [segment, setSegmentRaw] = useState<Segment>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [editMode, setEditMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingPurge, setPendingPurge] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter(
      (e) => (segment === 'all' || e.status === segment) && (q === '' || e.term.toLowerCase().includes(q)),
    );
    const sorted = [...filtered];
    if (sort === 'recent') sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    else if (sort === 'alpha') sorted.sort((a, b) => a.term.localeCompare(b.term));
    else {
      const order = new Map(SEGMENT_ORDER.map((s, i) => [s, i]));
      sorted.sort((a, b) => (order.get(a.status) ?? 0) - (order.get(b.status) ?? 0) || b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [entries, segment, query, sort]);

  const trashVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trash
      .filter((e) => q === '' || e.term.toLowerCase().includes(q))
      .sort((a, b) => b.trashedAt - a.trashedAt);
  }, [trash, query]);

  const counts = useMemo<Record<Segment, number>>(() => ({
    all: entries.length,
    tracking: entries.filter((e) => e.status === 'tracking').length,
    known: entries.filter((e) => e.status === 'known').length,
    ignore: entries.filter((e) => e.status === 'ignore').length,
    trash: trash.length,
  }), [entries, trash]);

  function pickSegment(s: Segment): void {
    setSegmentRaw(s);
    if (s === 'trash') setEditMode(false);
  }

  function cycle(term: string): void {
    setEntries((prev) => {
      const entry = prev.find((e) => e.term === term);
      if (!entry) return prev;
      const next = NEXT_STATUS[entry.status];
      if (next === null) return prev.filter((e) => e.term !== term);
      return prev.map((e) => (e.term === term ? { ...e, status: next, updatedAt: Date.now() } : e));
    });
  }

  function remove(term: string): void {
    const entry = entries.find((e) => e.term === term);
    setPendingDelete(null);
    if (!entry) return;
    setEntries((prev) => prev.filter((e) => e.term !== term));
    setTrash((prev) => [{ term, previousStatus: entry.status, trashedAt: Date.now() }, ...prev]);
  }

  function restore(term: string): void {
    const trashed = trash.find((e) => e.term === term);
    if (!trashed) return;
    setTrash((prev) => prev.filter((e) => e.term !== term));
    setEntries((prev) => [
      { term, status: trashed.previousStatus, updatedAt: Date.now() },
      ...prev.filter((e) => e.term !== term),
    ]);
  }

  function purge(term: string): void {
    setPendingPurge(null);
    setTrash((prev) => prev.filter((e) => e.term !== term));
  }

  return {
    segment, setSegment: pickSegment,
    query, setQuery,
    sort, setSort,
    editMode, setEditMode,
    pendingDelete, setPendingDelete,
    pendingPurge, setPendingPurge,
    visible, trashVisible, counts,
    cycle, remove, restore, purge,
  };
}
