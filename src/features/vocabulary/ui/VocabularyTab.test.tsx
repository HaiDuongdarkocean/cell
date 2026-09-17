import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VocabularyTab } from './VocabularyTab';
import type { VocabularySource, VocabularySourceState } from '../services/vocabularySource';
import type { VocabularyEntry } from '../logic/vocabularyList';

const mockCycle = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
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
    remove: mockRemove,
    refresh: jest.fn(),
    destroy: mockDestroy,
  } satisfies VocabularySource)),
}));

const entries = (list: VocabularyEntry[]): VocabularySourceState => ({ entries: list, loaded: true });

beforeEach(() => {
  jest.clearAllMocks();
  listeners.clear();
  currentState = entries([
    { term: 'apple', status: 'known', updatedAt: 10 },
    { term: 'banana', status: 'tracking', updatedAt: 30 },
    { term: 'cherry', status: 'unknown', updatedAt: 20 },
  ]);
});

describe('VocabularyTab', () => {
  it('renders rows with status badges (A1)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    expect(screen.getByText('apple')).toBeTruthy();
    expect(screen.getByText('banana')).toBeTruthy();
    expect(screen.getByText('cherry')).toBeTruthy();
  });

  it('filters rows by status chip (A2)', () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.click(document.querySelector('[data-cell-id="vocabulary-filter-known"]')!);
    expect(screen.queryByText('apple')).toBeNull();
    expect(screen.getByText('banana')).toBeTruthy();
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

  it('confirms before deleting a row (A7)', async () => {
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Remove apple'));
    expect(screen.getByText('Remove word?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('apple'));
  });

  it('shows the empty state when the store has no rows (A12)', () => {
    currentState = entries([]);
    render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    expect(screen.getByText('No words marked yet')).toBeTruthy();
  });

  it('destroys the source on unmount', () => {
    const { unmount } = render(<VocabularyTab langCode="en" onLookup={jest.fn()} />);
    unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
