import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders header and children in respective slots', () => {
    render(<Sidebar header={<span>Header Title</span>}><div>Custom Body Content</div></Sidebar>);
    expect(screen.getByText('Header Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Body Content')).toBeInTheDocument();
  });

  it('toggles collapsed state', () => {
    const onCollapsedChange = jest.fn();
    render(<Sidebar collapsible onCollapsedChange={onCollapsedChange}>Nav</Sidebar>);
    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('renders collapsed state', () => {
    const { container } = render(<Sidebar collapsed collapsible>Nav</Sidebar>);
    expect(container.firstChild).toHaveClass('collapsed');
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
  });
});
