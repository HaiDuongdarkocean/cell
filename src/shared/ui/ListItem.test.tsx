import { render, screen } from '@testing-library/react';
import { ListItem } from './ListItem';

describe('ListItem', () => {
  it('renders content and leading/trailing', () => {
    render(
      <ListItem leading={<span data-cell-id="leading">L</span>} trailing={<span data-cell-id="trailing">T</span>}>
        Label
      </ListItem>,
    );
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('trailing')).toBeInTheDocument();
  });

  it('applies active styling', () => {
    const { container } = render(<ListItem active>Label</ListItem>);
    expect(container.firstChild).toHaveClass('active');
  });
});
