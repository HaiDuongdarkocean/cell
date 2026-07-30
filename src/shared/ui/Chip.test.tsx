import { render, screen } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders as span by default', () => {
    render(<Chip>Tag</Chip>);
    expect(screen.getByText('Tag')).toBeInTheDocument();
    expect(screen.getByText('Tag').tagName).toBe('SPAN');
  });

  it('renders as button when as="button"', () => {
    render(<Chip as="button">Filter</Chip>);
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('reflects selected state via aria-pressed', () => {
    render(<Chip as="button" selected>Active</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('aria-pressed is false when not selected', () => {
    render(<Chip as="button">Inactive</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders all variants', () => {
    const variants = ['default', 'outline'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Chip variant={variant}>{variant}</Chip>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Chip size={size}>{size}</Chip>);
      expect(screen.getByText(size)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<Chip className="extra">Tag</Chip>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
