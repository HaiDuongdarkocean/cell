import { render, screen, fireEvent } from '@testing-library/react';
import { WordChip } from './WordChip';

describe('WordChip', () => {
  it('renders the word', () => {
    render(<WordChip word="ephemeral" />);
    expect(screen.getByText('ephemeral')).toBeInTheDocument();
  });

  it('renders as a button', () => {
    render(<WordChip word="serendipity" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has correct aria-label with default status', () => {
    render(<WordChip word="ubiquitous" />);
    expect(screen.getByRole('button', { name: 'Look up ubiquitous, status: Unknown' })).toBeInTheDocument();
  });

  it('has correct aria-label with explicit status', () => {
    render(<WordChip word="resilient" status="learning" />);
    expect(screen.getByRole('button', { name: 'Look up resilient, status: Learning' })).toBeInTheDocument();
  });

  it('renders all statuses', () => {
    const cases = [
      ['new', 'New'],
      ['learning', 'Learning'],
      ['mastered', 'Mastered'],
      ['unknown', 'Unknown'],
    ] as const;
    for (const [status, label] of cases) {
      const { unmount } = render(<WordChip word={status} status={status} />);
      expect(screen.getByRole('button', { name: `Look up ${status}, status: ${label}` })).toBeInTheDocument();
      unmount();
    }
  });

  it('calls onLookup with the word on click', () => {
    const onLookup = jest.fn();
    render(<WordChip word="eloquent" onLookup={onLookup} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).toHaveBeenCalledWith('eloquent');
  });

  it('does not call onLookup when disabled', () => {
    const onLookup = jest.fn();
    render(<WordChip word="verbose" onLookup={onLookup} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).not.toHaveBeenCalled();
  });

  it('merges custom className', () => {
    const { container } = render(<WordChip word="terse" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
