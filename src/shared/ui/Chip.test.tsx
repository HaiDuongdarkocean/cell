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

  it('aria-pressed is false when selected={false}', () => {
    render(<Chip as="button" selected={false}>Inactive</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('omits aria-pressed when selected is not provided', () => {
    render(<Chip as="button">Action</Chip>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('renders all variants', () => {
    const variants = ['default', 'outline'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Chip variant={variant}>{variant}</Chip>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders color accents', () => {
    const { container: success } = render(<Chip as="button" color="success">Success</Chip>);
    expect(success.firstChild).toHaveClass('success');
    const { container: error } = render(<Chip as="button" color="error">Error</Chip>);
    expect(error.firstChild).toHaveClass('error');
  });

  it('renders word-status colorways', () => {
    const statuses = ['unknown', 'tracking', 'learning', 'known', 'ignore'] as const;
    for (const status of statuses) {
      const { container, unmount } = render(<Chip status={status}>{status}</Chip>);
      expect(container.firstChild).toHaveClass(`status-${status}`);
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
