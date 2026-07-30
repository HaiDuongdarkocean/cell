import { render, screen } from '@testing-library/react';
import { Collapsible } from './Collapsible';

describe('Collapsible', () => {
  it('renders children when expanded (default)', () => {
    render(<Collapsible>Content</Collapsible>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders children when collapsed (content stays in DOM)', () => {
    render(<Collapsible collapsed>Content</Collapsible>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('sets data-state to expanded by default', () => {
    const { container } = render(<Collapsible>Content</Collapsible>);
    expect(container.firstChild).toHaveAttribute('data-state', 'expanded');
  });

  it('sets data-state to collapsed when collapsed', () => {
    const { container } = render(<Collapsible collapsed>Content</Collapsible>);
    expect(container.firstChild).toHaveAttribute('data-state', 'collapsed');
  });

  it('calls onCollapseChange when clicked', () => {
    const onCollapseChange = jest.fn();
    const { container } = render(
      <Collapsible collapsed={false} onCollapseChange={onCollapseChange}>
        Content
      </Collapsible>,
    );
    (container.firstChild as HTMLElement).click();
    expect(onCollapseChange).toHaveBeenCalledWith(true);
  });
});
