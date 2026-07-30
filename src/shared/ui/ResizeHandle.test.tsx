import { render, screen, fireEvent } from '@testing-library/react';
import { ResizeHandle } from './ResizeHandle';

describe('ResizeHandle', () => {
  it('renders with role="separator" and default aria-label', () => {
    render(<ResizeHandle />);
    expect(screen.getByRole('separator', { name: 'Resize' })).toBeInTheDocument();
  });

  it('renders horizontal direction with aria-orientation', () => {
    render(<ResizeHandle direction="horizontal" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('renders vertical direction with aria-orientation', () => {
    render(<ResizeHandle direction="vertical" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('allows custom aria-label', () => {
    render(<ResizeHandle aria-label="Resize panel" />);
    expect(screen.getByRole('separator', { name: 'Resize panel' })).toBeInTheDocument();
  });

  it('is keyboard focusable (tabIndex=0)', () => {
    const { container } = render(<ResizeHandle />);
    expect(container.firstChild).toHaveAttribute('tabindex', '0');
  });

  it('calls onKeyDown on Shift+Arrow but not plain Arrow', () => {
    const onKeyDown = jest.fn();
    render(<ResizeHandle onKeyDown={onKeyDown} />);
    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onKeyDown).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<ResizeHandle className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
