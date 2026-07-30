import { render, screen, fireEvent } from '@testing-library/react';
import { MaximizeButton } from './MaximizeButton';

describe('MaximizeButton', () => {
  it('renders with aria-label "Maximize" when not maximized', () => {
    render(<MaximizeButton maximized={false} />);
    expect(screen.getByRole('button', { name: 'Maximize' })).toBeInTheDocument();
  });

  it('renders with aria-label "Restore" when maximized', () => {
    render(<MaximizeButton maximized={true} />);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('sets aria-pressed to false when not maximized', () => {
    render(<MaximizeButton maximized={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets aria-pressed to true when maximized', () => {
    render(<MaximizeButton maximized={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('is disabled when disabled prop is set', () => {
    render(<MaximizeButton maximized={false} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<MaximizeButton maximized={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<MaximizeButton maximized={false} className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
