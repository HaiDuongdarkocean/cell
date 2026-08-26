import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders children', () => {
    render(<Sidebar>Nav</Sidebar>);
    expect(screen.getByText('Nav')).toBeInTheDocument();
  });

  it('toggles collapsed state', () => {
    const onCollapsedChange = jest.fn();
    render(<Sidebar collapsible onCollapsedChange={onCollapsedChange}>Nav</Sidebar>);
    fireEvent.click(screen.getByLabelText('Collapse sidebar to icons'));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('renders collapsed state', () => {
    const { container } = render(<Sidebar collapsed>Nav</Sidebar>);
    expect(container.firstChild).toHaveClass('collapsed');
  });
});
