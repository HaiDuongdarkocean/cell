import { render, screen, fireEvent } from '@testing-library/react';
import { AntonymChip } from './AntonymChip';

describe('AntonymChip', () => {
  it('renders the word', () => {
    render(<AntonymChip word="sad" />);
    expect(screen.getByText('sad')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<AntonymChip word="unhappy" />);
    expect(screen.getByRole('button', { name: 'Look up antonym: unhappy' })).toBeInTheDocument();
  });

  it('renders as a button', () => {
    render(<AntonymChip word="depressed" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onLookup with the word on click', () => {
    const onLookup = jest.fn();
    render(<AntonymChip word="miserable" onLookup={onLookup} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).toHaveBeenCalledWith('miserable');
  });

  it('does not call onLookup when disabled', () => {
    const onLookup = jest.fn();
    render(<AntonymChip word="sorrowful" onLookup={onLookup} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLookup).not.toHaveBeenCalled();
  });

  it('merges custom className', () => {
    const { container } = render(<AntonymChip word="down" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
