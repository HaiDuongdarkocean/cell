import { render, screen } from '@testing-library/react';
import { Link } from './Link';

describe('Link', () => {
  it('renders an anchor with href', () => {
    render(<Link href="https://example.com">Example</Link>);
    const link = screen.getByRole('link', { name: 'Example' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders all variants', () => {
    const variants = ['inline', 'standalone', 'destructive'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Link href="#" variant={variant}>{variant}</Link>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Link href="#" size={size}>{size}</Link>);
      expect(screen.getByText(size)).toBeInTheDocument();
      unmount();
    }
  });

  it('sets target and rel when external', () => {
    render(<Link href="https://example.com" external>External</Link>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not set target when not external', () => {
    render(<Link href="https://example.com">Internal</Link>);
    const link = screen.getByRole('link');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
  });

  it('merges custom className', () => {
    const { container } = render(<Link href="#" className="extra">Custom</Link>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
