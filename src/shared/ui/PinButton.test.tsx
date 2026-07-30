import { render, screen, fireEvent } from '@testing-library/react';
import { PinButton } from './PinButton';

describe('PinButton', () => {
  it('renders with aria-label "Pin" when unpinned', () => {
    render(<PinButton pinned={false} />);
    expect(screen.getByRole('button', { name: 'Pin' })).toBeInTheDocument();
  });

  it('renders with aria-label "Unpin" when pinned', () => {
    render(<PinButton pinned={true} />);
    expect(screen.getByRole('button', { name: 'Unpin' })).toBeInTheDocument();
  });

  it('sets aria-pressed to false when unpinned', () => {
    render(<PinButton pinned={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets aria-pressed to true when pinned', () => {
    render(<PinButton pinned={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('is disabled when disabled prop is set', () => {
    render(<PinButton pinned={false} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<PinButton pinned={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<PinButton pinned={false} className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
