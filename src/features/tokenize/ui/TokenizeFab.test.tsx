import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenizeFab } from './TokenizeFab';
import type { TokenizeState, TokenizeStateStore } from '@/features/tokenize/services/tokenizeStateStore';

function createMockStore(initial = { enabled: false, showStatus: false, showFrequency: false }): TokenizeStateStore {
  const listeners = new Set<(state: TokenizeState) => void>();
  let state: TokenizeState = {
    ...initial,
    hoveredTerm: null,
    selectedTerms: new Set<string>() as ReadonlySet<string>,
  };

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,
    setEnabled: jest.fn((enabled: boolean) => { state = { ...state, enabled }; notify(); }),
    setShowStatus: jest.fn((show: boolean) => { state = { ...state, showStatus: show }; notify(); }),
    setShowFrequency: jest.fn((show: boolean) => { state = { ...state, showFrequency: show }; notify(); }),
    setHoveredTerm: jest.fn(),
    toggleSelectedTerm: jest.fn(),
    addSelectedTerm: jest.fn(),
    removeSelectedTerm: jest.fn(),
    clearSelection: jest.fn(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('TokenizeFab', () => {
  it('renders the FAB button', () => {
    render(<TokenizeFab />);
    expect(screen.getByTestId('tokenize-fab-button')).toBeInTheDocument();
  });

  it('opens and closes the panel when the FAB is clicked', () => {
    render(<TokenizeFab />);
    const fab = screen.getByTestId('tokenize-fab-button');

    fireEvent.click(fab);
    expect(screen.getByTestId('tokenize-fab-panel')).toBeInTheDocument();

    fireEvent.click(fab);
    expect(screen.queryByTestId('tokenize-fab-panel')).not.toBeInTheDocument();
  });

  it('toggles internal state when no store is provided', () => {
    render(<TokenizeFab />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    const enabledToggle = screen.getByTestId('tokenize-fab-toggle-enabled');
    expect(enabledToggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(enabledToggle);
    expect(enabledToggle).toHaveAttribute('aria-pressed', 'true');

    const statusToggle = screen.getByTestId('tokenize-fab-toggle-showStatus');
    fireEvent.click(statusToggle);
    expect(statusToggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables status and frequency toggles when tokenize is off', () => {
    render(<TokenizeFab />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    expect(screen.getByTestId('tokenize-fab-toggle-enabled')).not.toBeDisabled();
    expect(screen.getByTestId('tokenize-fab-toggle-showStatus')).toBeDisabled();
    expect(screen.getByTestId('tokenize-fab-toggle-showFrequency')).toBeDisabled();
  });

  it('dispatches store setters when a store is provided', () => {
    const store = createMockStore();
    render(<TokenizeFab store={store} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-enabled'));
    expect(store.setEnabled).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-showStatus'));
    expect(store.setShowStatus).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-showFrequency'));
    expect(store.setShowFrequency).toHaveBeenCalledWith(true);
  });

  it('renders the dictionary button when onOpenDictionary is provided', () => {
    const onOpenDictionary = jest.fn();
    render(<TokenizeFab onOpenDictionary={onOpenDictionary} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    const dictButton = screen.getByTestId('tokenize-fab-dictionary');
    expect(dictButton).toBeInTheDocument();

    fireEvent.click(dictButton);
    expect(onOpenDictionary).toHaveBeenCalled();
  });

  it('closes the panel when clicking outside', () => {
    render(<TokenizeFab />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));
    expect(screen.getByTestId('tokenize-fab-panel')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('tokenize-fab-panel')).not.toBeInTheDocument();
  });
});
