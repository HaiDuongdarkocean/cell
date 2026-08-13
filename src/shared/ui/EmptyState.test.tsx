import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, description, and action', () => {
    render(
      <EmptyState
        icon={<span data-cell-id="icon">Icon</span>}
        title="No items"
        description="Add your first item."
        action={<button data-cell-id="action">Add</button>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first item.')).toBeInTheDocument();
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('passes data attributes and extra props to the root', () => {
    const { container } = render(<EmptyState title="No items" data-cell-id="empty-root" />);
    expect(container.firstChild).toHaveAttribute('data-cell-id', 'empty-root');
  });

  it.each(['sm', 'compact', 'md'] as const)('applies %s size class', (size) => {
    const { container } = render(<EmptyState title="No items" size={size} />);
    expect(container.firstChild).toHaveClass(size);
  });
});
