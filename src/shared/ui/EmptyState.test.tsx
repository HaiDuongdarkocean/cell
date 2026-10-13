import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, description, and action', () => {
    render(
      <EmptyState
        icon={<span data-tihoka-id="icon">Icon</span>}
        title="No items"
        description="Add your first item."
        action={<button data-tihoka-id="action">Add</button>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first item.')).toBeInTheDocument();
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('passes data attributes and extra props to the root', () => {
    const { container } = render(<EmptyState title="No items" data-tihoka-id="empty-root" />);
    expect(container.firstChild).toHaveAttribute('data-tihoka-id', 'empty-root');
  });

  it.each(['sm', 'compact', 'md'] as const)('applies %s size class', (size) => {
    const { container } = render(<EmptyState title="No items" size={size} />);
    expect(container.firstChild).toHaveClass(size);
  });
});
