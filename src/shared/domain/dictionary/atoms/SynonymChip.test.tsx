import { render, screen, fireEvent } from '@testing-library/react';
import { SynonymChip } from './SynonymChip';

describe('SynonymChip', () => {
  it('renders the word', () => {
    render(<SynonymChip word="happy" />);
    expect(screen.getByText('happy')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<SynonymChip word="joyful" />);
    expect(screen.getByRole('button', { name: 'Look up synonym: joyful' })).toBeInTheDocument();
  });

  it('renders as a button', () => {
    render(<SynonymChip word="glad" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onLookup with the word on click', () => {
    const onLookup = jest.fn();
    render(<SynonymChip word="cheerful" onLookup={onLookup} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).toHaveBeenCalledWith('cheerful');
  });

  it('does not call onLookup when disabled', () => {
    const onLookup = jest.fn();
    render(<SynonymChip word="pleased" onLookup={onLookup} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).not.toHaveBeenCalled();
  });

  it('merges custom className', () => {
    const { container } = render(<SynonymChip word="content" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
