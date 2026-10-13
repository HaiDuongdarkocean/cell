import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { VocabularyTab } from './VocabularyTab';
import type { VocabularySource, VocabularySourceState, CardSources } from '../services/vocabularySource';
import type { VocabularyEntry } from '../logic/vocabularyList';
import type { TrashedWordEntry } from '@/features/dictionary';

jest.mock('@/features/ankiStatusSync', () => ({
  runAnkiSyncNow: jest.fn().mockResolvedValue(undefined),
}));

const mockCycle = jest.fn().mockResolvedValue(undefined);
const mockTrash = jest.fn().mockResolvedValue(undefined);
const mockRestore = jest.fn().mockResolvedValue(undefined);
const mockDeleteTrash = jest.fn().mockResolvedValue(undefined);
const mockSetStatusMany = jest.fn().mockResolvedValue(undefined);
const mockTrashMany = jest.fn().mockResolvedValue(undefined);
const mockRestoreMany = jest.fn().mockResolvedValue(undefined);
const mockRefreshTrash = jest.fn().mockResolvedValue(undefined);
const mockRefreshCardSources = jest.fn().mockResolvedValue(undefined);
const mockDestroy = jest.fn();
let currentState: VocabularySourceState;
const listeners = new Set<(s: VocabularySourceState) => void>();

jest.mock('../services/vocabularySource', () => ({
  createVocabularySource: jest.fn(() => ({
    getState: () => currentState,
    subscribe: (l: (s: VocabularySourceState) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    cycle: mockCycle,
    trash: mockTrash,
    restore: mockRestore,
    deleteTrash: mockDeleteTrash,
    setStatusMany: mockSetStatusMany,
    trashMany: mockTrashMany,
    restoreMany: mockRestoreMany,
    refreshTrash: mockRefreshTrash,
    refreshCardSources: mockRefreshCardSources,
    refresh: jest.fn(),
    destroy: mockDestroy,
  } satisfies VocabularySource)),
}));

const NO_CARDS: CardSources = { anki: new Set(), srs: new Set() };

const state = (
  entries: VocabularyEntry[],
  trash: TrashedWordEntry[] = [],
  cardSources: CardSources = NO_CARDS,
): VocabularySourceState => ({ entries, trash, cardSources, loaded: true });

const DEFAULT_ENTRIES: VocabularyEntry[] = [
  { term: 'apple', status: 'known', updatedAt: 10 },
  { term: 'banana', status: 'tracking', updatedAt: 30 },
  { term: 'cherry', status: 'ignore', updatedAt: 20 },
  { term: 'date', status: 'tracking', updatedAt: 5 },
];

const byId = (id: string): HTMLElement | null => document.querySelector(`[data-tihoka-id="${id}"]`);
const click = (id: string): void => {
  fireEvent.click(byId(id)!);
};
const selectTerm = (term: string): void => {
  fireEvent.click(byId(`vocabulary-select-${term}`)!);
};
const bulkBarOpen = (): boolean => byId('vocabulary-bulk-bar')?.hasAttribute('data-open') ?? false;

let ioCallback: IntersectionObserverCallback | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  listeners.clear();
  currentState = state(DEFAULT_ENTRIES);
  ioCallback = null;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    constructor(cb: IntersectionObserverCallback) {
      ioCallback = cb;
    }
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
});

const renderTab = (onLookup = jest.fn()): ReturnType<typeof render> =>
  render(<VocabularyTab langCode="en" onLookup={onLookup} />);

describe('VocabularyTab', () => {
  it('renders the hero with known count and status breakdown', () => {
    renderTab();
    const hero = byId('vocabulary-hero')!;
    expect(within(hero).getByText('Known words')).toBeTruthy();
    expect(hero.textContent).toContain('1');
    expect(hero.textContent).toMatch(/2\s*tracked/);
    expect(hero.textContent).toMatch(/1\s*ignored/);
  });

  it('shows the word count meta and rows', () => {
    renderTab();
    expect(byId('vocabulary-meta')!.textContent).toBe('4 words');
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.getByText('date')).toBeTruthy();
  });

  it('selecting a row updates the meta line and opens the bulk bar', () => {
    renderTab();
    expect(bulkBarOpen()).toBe(false);
    selectTerm('apple');
    expect(byId('vocabulary-meta')!.textContent).toBe('1 selected');
    expect(bulkBarOpen()).toBe(true);
  });

  it('select all selects every filtered term, then deselect all clears', () => {
    renderTab();
    click('vocabulary-select-all');
    expect(byId('vocabulary-meta')!.textContent).toBe('4 selected');
    expect(byId('vocabulary-select-all')!.textContent).toBe('Deselect all');
    click('vocabulary-select-all');
    expect(byId('vocabulary-meta')!.textContent).toBe('4 words');
    expect(bulkBarOpen()).toBe(false);
  });

  it('bulk change status writes all selected terms in one call', () => {
    renderTab();
    selectTerm('apple');
    selectTerm('banana');
    click('vocabulary-bulk-status');
    click('vocabulary-bulk-status-known');
    expect(mockSetStatusMany).toHaveBeenCalledTimes(1);
    expect([...mockSetStatusMany.mock.calls[0][0]].sort()).toEqual(['apple', 'banana']);
    expect(mockSetStatusMany.mock.calls[0][1]).toBe('known');
    expect(bulkBarOpen()).toBe(false);
  });

  it('undo after a bulk status change restores previous statuses grouped by status', async () => {
    renderTab();
    selectTerm('apple');
    selectTerm('banana');
    click('vocabulary-bulk-status');
    click('vocabulary-bulk-status-ignore');
    mockSetStatusMany.mockClear();
    click('vocabulary-undo');
    await waitFor(() => expect(mockSetStatusMany).toHaveBeenCalledTimes(2));
    const calls = mockSetStatusMany.mock.calls.map(([terms, status]) => [status, [...terms]]);
    expect(calls).toEqual(expect.arrayContaining([['known', ['apple']], ['tracking', ['banana']]]));
    expect((byId('vocabulary-undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('bulk delete asks for confirmation then trashes, and undo restores', async () => {
    renderTab();
    selectTerm('cherry');
    click('vocabulary-bulk-delete');
    expect(screen.getByText('Delete 1 word?')).toBeTruthy();
    click('vocabulary-bulk-delete-confirm');
    await waitFor(() => expect(mockTrashMany).toHaveBeenCalledWith(['cherry']));
    click('vocabulary-undo');
    await waitFor(() => expect(mockRestoreMany).toHaveBeenCalledWith(['cherry']));
  });

  it('cycles a term status via the status circle and records undo', async () => {
    renderTab();
    fireEvent.click(screen.getByLabelText('Cycle status for apple'));
    expect(mockCycle).toHaveBeenCalledWith('apple');
    click('vocabulary-undo');
    await waitFor(() => expect(mockSetStatusMany).toHaveBeenCalledWith(['apple'], 'known'));
  });

  it('opens the dictionary lookup on term click', () => {
    const onLookup = jest.fn();
    renderTab(onLookup);
    fireEvent.click(screen.getByText('apple'));
    expect(onLookup).toHaveBeenCalledWith('apple');
  });

  it('search toggle reveals the search field and filters by substring', () => {
    renderTab();
    expect(byId('vocabulary-search')).toBeNull();
    click('vocabulary-search-toggle');
    fireEvent.change(screen.getByPlaceholderText('Search words…'), { target: { value: 'app' } });
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.queryByText('banana')).toBeNull();
  });

  it('filter change narrows rows and clears the selection', () => {
    renderTab();
    selectTerm('banana');
    click('vocabulary-filter');
    click('vocabulary-segment-tracking');
    expect(screen.queryByText('apple')).toBeNull();
    expect(screen.getByText('banana')).toBeTruthy();
    expect(byId('vocabulary-meta')!.textContent).toBe('2 words');
    expect(bulkBarOpen()).toBe(false);
  });

  it('renders card-source indicators with accessible labels', () => {
    currentState = state(DEFAULT_ENTRIES, [], { anki: new Set(['apple']), srs: new Set(['apple', 'banana']) });
    renderTab();
    expect(byId('vocabulary-card-anki-apple')!.getAttribute('aria-label')).toBe('In Anki');
    expect(byId('vocabulary-card-srs-apple')!.getAttribute('aria-label')).toBe('In Memory');
    expect(byId('vocabulary-card-srs-banana')).toBeTruthy();
    expect(byId('vocabulary-card-anki-banana')).toBeNull();
  });

  it('renders rows incrementally and appends on sentinel intersection', () => {
    currentState = state(
      Array.from({ length: 250 }, (_, i) => ({ term: `w${String(i).padStart(3, '0')}`, status: 'known', updatedAt: i })),
    );
    renderTab();
    expect(document.querySelectorAll('[data-tihoka-id^="vocabulary-row-"]').length).toBe(100);
    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(document.querySelectorAll('[data-tihoka-id^="vocabulary-row-"]').length).toBe(200);
  });

  it('opens Trash from the more menu with restore and delete-forever actions', async () => {
    currentState = state(DEFAULT_ENTRIES, [
      { term: 'zebra', previousStatus: 'known', trashedAt: Date.now() - 60 * 60 * 1000 },
    ]);
    renderTab();
    click('vocabulary-more');
    click('vocabulary-more-trash');
    await waitFor(() => expect(screen.getByText('zebra')).toBeTruthy());
    const row = byId('vocabulary-trash-row-zebra')!;
    expect(within(row).getByText('Known')).toBeTruthy();
    expect(within(row).getByText(/left$/)).toBeTruthy();
    expect(byId('vocabulary-hero')).toBeNull();
    expect(byId('vocabulary-sort')).toBeNull();
    expect(mockRefreshTrash).toHaveBeenCalled();
    click('vocabulary-restore-zebra');
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('zebra'));
    click('vocabulary-trash-delete-zebra');
    expect(screen.getByText('Delete forever?')).toBeTruthy();
    click('vocabulary-trash-delete-confirm');
    await waitFor(() => expect(mockDeleteTrash).toHaveBeenCalledWith('zebra'));
    click('vocabulary-trash-back');
    expect(byId('vocabulary-hero')).toBeTruthy();
  });

  it('shows the trash empty state', () => {
    renderTab();
    click('vocabulary-more');
    click('vocabulary-more-trash');
    expect(byId('vocabulary-trash-empty')).toBeTruthy();
  });

  it('shows the empty state when the store has no rows', () => {
    currentState = state([]);
    renderTab();
    expect(screen.getByText('No words marked yet')).toBeTruthy();
    expect(byId('vocabulary-select-all')).toBeNull();
  });

  it('destroys the source on unmount', () => {
    const { unmount } = renderTab();
    unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
