import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders header and children in respective slots', () => {
    render(<Sidebar header={<span>Header Title</span>}><div>Custom Body Content</div></Sidebar>);
    expect(screen.getByText('Header Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Body Content')).toBeInTheDocument();
  });

  it('renders collapsed state', () => {
    const { container } = render(<Sidebar collapsed>Nav</Sidebar>);
    expect(container.firstChild).toHaveClass('collapsed');
    expect(screen.queryByLabelText('Expand sidebar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
  });

  it('does not render a collapse button', () => {
    render(<Sidebar collapsed={false}>Nav</Sidebar>);
    expect(screen.queryByLabelText('Expand sidebar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
  });
});
