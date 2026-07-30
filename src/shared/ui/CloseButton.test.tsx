import { render, screen } from '@testing-library/react';
import { CloseButton } from './CloseButton';

describe('CloseButton', () => {
  it('renders with default aria-label="Close"', () => {
    render(<CloseButton />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md'] as const;
    for (const size of sizes) {
      const { unmount } = render(<CloseButton size={size} aria-label={`Close ${size}`} />);
      expect(screen.getByRole('button', { name: `Close ${size}` })).toBeInTheDocument();
      unmount();
    }
  });

  it('allows custom aria-label', () => {
    render(<CloseButton aria-label="Dismiss panel" />);
    expect(screen.getByRole('button', { name: 'Dismiss panel' })).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(<CloseButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<CloseButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
