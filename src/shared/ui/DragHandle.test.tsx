import { render, screen, fireEvent } from '@testing-library/react';
import { DragHandle } from './DragHandle';

describe('DragHandle', () => {
  it('renders with role="button" and default aria-label', () => {
    render(<DragHandle />);
    expect(screen.getByRole('button', { name: 'Drag' })).toBeInTheDocument();
  });

  it('allows custom aria-label', () => {
    render(<DragHandle aria-label="Drag row" />);
    expect(screen.getByRole('button', { name: 'Drag row' })).toBeInTheDocument();
  });

  it('is draggable', () => {
    const { container } = render(<DragHandle />);
    expect(container.firstChild).toHaveAttribute('draggable', 'true');
  });

  it('is keyboard focusable (tabIndex=0)', () => {
    const { container } = render(<DragHandle />);
    expect(container.firstChild).toHaveAttribute('tabindex', '0');
  });

  it('calls onKeyDown when arrow keys are pressed', () => {
    const onKeyDown = jest.fn();
    render(<DragHandle onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<DragHandle className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
