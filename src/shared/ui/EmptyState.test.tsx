import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, description, and action', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">Icon</span>}
        title="No items"
        description="Add your first item."
        action={<button data-testid="action">Add</button>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first item.')).toBeInTheDocument();
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });
});
