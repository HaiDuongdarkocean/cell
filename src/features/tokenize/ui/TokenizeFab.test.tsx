import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenizeFab } from './TokenizeFab';
import type { TokenizePanelState } from '@/features/tokenize/types';

const OFF_STATE: TokenizePanelState = { enabled: false, showStatus: false, showFrequency: false };
const ON_STATE: TokenizePanelState = { enabled: true, showStatus: true, showFrequency: true };

describe('TokenizeFab', () => {
  it('renders the FAB button', () => {
    render(<TokenizeFab state={OFF_STATE} onToggle={jest.fn()} />);
    expect(screen.getByTestId('tokenize-fab-button')).toBeInTheDocument();
  });

  it('opens and closes the panel when the FAB is clicked', () => {
    render(<TokenizeFab state={OFF_STATE} onToggle={jest.fn()} />);
    const fab = screen.getByTestId('tokenize-fab-button');

    fireEvent.click(fab);
    expect(screen.getByTestId('tokenize-fab-panel')).toBeInTheDocument();

    fireEvent.click(fab);
    expect(screen.queryByTestId('tokenize-fab-panel')).not.toBeInTheDocument();
  });

  it('calls onToggle for each key', () => {
    const onToggle = jest.fn();
    render(<TokenizeFab state={ON_STATE} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-enabled'));
    expect(onToggle).toHaveBeenCalledWith('enabled');

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-showStatus'));
    expect(onToggle).toHaveBeenCalledWith('showStatus');

    fireEvent.click(screen.getByTestId('tokenize-fab-toggle-showFrequency'));
    expect(onToggle).toHaveBeenCalledWith('showFrequency');
  });

  it('disables status and frequency toggles when tokenize is off', () => {
    render(<TokenizeFab state={OFF_STATE} onToggle={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    expect(screen.getByTestId('tokenize-fab-toggle-enabled')).not.toBeDisabled();
    expect(screen.getByTestId('tokenize-fab-toggle-showStatus')).toBeDisabled();
    expect(screen.getByTestId('tokenize-fab-toggle-showFrequency')).toBeDisabled();
  });

  it('renders the dictionary button when onOpenDictionary is provided', () => {
    const onOpenDictionary = jest.fn();
    render(<TokenizeFab state={ON_STATE} onToggle={jest.fn()} onOpenDictionary={onOpenDictionary} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));

    const dictButton = screen.getByTestId('tokenize-fab-dictionary');
    expect(dictButton).toBeInTheDocument();

    fireEvent.click(dictButton);
    expect(onOpenDictionary).toHaveBeenCalled();
  });

  it('closes the panel when clicking outside', () => {
    render(<TokenizeFab state={ON_STATE} onToggle={jest.fn()} />);
    fireEvent.click(screen.getByTestId('tokenize-fab-button'));
    expect(screen.getByTestId('tokenize-fab-panel')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('tokenize-fab-panel')).not.toBeInTheDocument();
  });
});
