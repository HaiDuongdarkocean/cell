import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { VocabularyTab } from './VocabularyTab';
import type { VocabularySource, VocabularySourceState } from '../services/vocabularySource';
import type { VocabularyEntry } from '../logic/vocabularyList';
import type { TrashedWordEntry } from '@/features/dictionary';

const mockCycle = jest.fn().mockResolvedValue(undefined);
const mockTrash = jest.fn().mockResolvedValue(undefined);
const mockRestore = jest.fn().mockResolvedValue(undefined);
const mockDeleteTrash = jest.fn().mockResolvedValue(undefined);
const mockRefreshTrash = jest.fn().mockResolvedValue(undefined);
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
    refreshTrash: mockRefreshTrash,
    refresh: jest.fn(),
    destroy: mockDestroy,
  } satisfies VocabularySource)),
}));

const state = (entries: VocabularyEntry[], trash: TrashedWordEntry[] = []): VocabularySourceState => ({
  entries,
  trash,
  loaded: true,
});

const DEFAULT_ENTRIES: VocabularyEntry[] = [
  { term: 'apple', status: 'known', updatedAt: 10 },
  { term: 'banana', status: 'tracking', updatedAt: 30 },
  { term: 'cherry', status: 'ignore', updatedAt: 20 },
];

const segment = (name: string): HTMLElement =>
  document.querySelector(`[data-cell-id="vocabulary-segment-${name}"]`)!;

const openFilterMenu = (): void => {
  fireEvent.click(document.querySelector('[data-cell-id="vocabulary-filter"]')!);
};

beforeEach(() => {
  jest.clearAllMocks();
  listeners.clear();
  currentState = state(DEFAULT_ENTRIES);
});

describe('VocabularyTab', () => {
  it('renders rows with status badges (A1)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.getByText('banana')).toBeTruthy();
    expect(screen.getByText('cherry')).toBeTruthy();
  });

  it('renders a single-select filter menu with counts (REQ-1)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    expect(document.querySelector('[role="menu"]')).toBeTruthy();
    expect(segment('all').getAttribute('aria-checked')).toBe('true');
    expect(segment('tracking')).toBeTruthy();
    expect(segment('known')).toBeTruthy();
    expect(segment('ignore')).toBeTruthy();
    expect(segment('trash')).toBeTruthy();
  });

  it('filters rows by the selected segment', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    fireEvent.click(segment('tracking'));
    expect(screen.queryByText('apple')).toBeNull();
    expect(screen.getByText('banana')).toBeTruthy();
    expect(screen.queryByText('cherry')).toBeNull();
  });

  it('searches by substring (A3)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search words…'), { target: { value: 'app' } });
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.queryByText('banana')).toBeNull();
  });

  it('cycles a term status via the source (A5)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Cycle status for apple'));
    expect(mockCycle).toHaveBeenCalledWith('apple');
  });

  it('opens the dictionary lookup on term click (A6)', () => {
    const onLookup = jest.fn();
    render(<VocabularyTab langCode="en" onLookup={onLookup} />);
    fireEvent.click(screen.getByText('apple'));
    expect(onLookup).toHaveBeenCalledWith('apple');
  });

  it('hides remove buttons in view mode and reveals them in edit mode (REQ-6)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    expect(document.querySelector('[data-cell-id="vocabulary-delete-apple"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-edit-toggle"]')!);
    expect(document.querySelector('[data-cell-id="vocabulary-delete-apple"]')).toBeTruthy();
  });

  it('trashes a word after confirmation (REQ-7)', async () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-edit-toggle"]')!);
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-delete-apple"]')!);
    expect(screen.getByText('Remove word?')).toBeTruthy();
    expect(screen.getByText(/moves to Trash/)).toBeTruthy();
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-delete-confirm"]')!);
    await waitFor(() => expect(mockTrash).toHaveBeenCalledWith('apple'));
  });

  it('switching to the Trash segment exits edit mode', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-edit-toggle"]')!);
    openFilterMenu();
    fireEvent.click(segment('trash'));
    expect(document.querySelector('[data-cell-id="vocabulary-edit-toggle"]')).toBeNull();
    openFilterMenu();
    fireEvent.click(segment('all'));
    expect(screen.getByText('Edit')).toBeTruthy();
  });

  it('shows trash entries with restore + delete-forever actions (REQ-9)', async () => {
    currentState = state(DEFAULT_ENTRIES, [
      { term: 'zebra', previousStatus: 'known', trashedAt: Date.now() - 60 * 60 * 1000 },
    ]);
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    fireEvent.click(segment('trash'));
    await waitFor(() => expect(screen.getByText('zebra')).toBeTruthy());
    const row = document.querySelector('[data-cell-id="vocabulary-trash-row-zebra"]')!;
    expect(within(row as HTMLElement).getByText('Known')).toBeTruthy();
    expect(within(row as HTMLElement).getByText(/left$/)).toBeTruthy();
    expect(document.querySelector('[data-cell-id="vocabulary-restore-zebra"]')).toBeTruthy();
    expect(document.querySelector('[data-cell-id="vocabulary-trash-delete-zebra"]')).toBeTruthy();
    expect(document.querySelector('[data-cell-id="vocabulary-sort"]')).toBeNull();
    expect(mockRefreshTrash).toHaveBeenCalled();
  });

  it('restores a trashed word via the source (REQ-10)', async () => {
    currentState = state(DEFAULT_ENTRIES, [
      { term: 'zebra', previousStatus: 'tracking', trashedAt: Date.now() },
    ]);
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    fireEvent.click(segment('trash'));
    await waitFor(() => expect(screen.getByText('zebra')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-restore-zebra"]')!);
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('zebra'));
  });

  it('confirms before deleting a trash record forever (REQ-11)', async () => {
    currentState = state(DEFAULT_ENTRIES, [
      { term: 'zebra', previousStatus: 'ignore', trashedAt: Date.now() },
    ]);
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    fireEvent.click(segment('trash'));
    await waitFor(() => expect(screen.getByText('zebra')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-trash-delete-zebra"]')!);
    expect(screen.getByText('Delete forever?')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-trash-delete-confirm"]')!);
    await waitFor(() => expect(mockDeleteTrash).toHaveBeenCalledWith('zebra'));
  });

  it('shows the trash empty state', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    openFilterMenu();
    fireEvent.click(segment('trash'));
    expect(document.querySelector('[data-cell-id="vocabulary-trash-empty"]')).toBeTruthy();
    expect(screen.getByText('Trash is empty')).toBeTruthy();
  });

  it('shows the empty state when the store has no rows (A12)', () => {
    currentState = state([]);
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    expect(screen.getByText('No words marked yet')).toBeTruthy();
  });

  it('destroys the source on unmount', () => {
    const { unmount } = render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
