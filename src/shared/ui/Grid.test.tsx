import { render, screen } from '@testing-library/react';
import { Grid } from './Grid';

describe('Grid', () => {
  it('renders children', () => {
    render(<Grid>Content</Grid>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders with numeric columns', () => {
    const { container } = render(<Grid columns={3}>Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });
  });

  it('renders with string columns', () => {
    const { container } = render(<Grid columns="1fr 2fr 1fr">Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ gridTemplateColumns: '1fr 2fr 1fr' });
  });

  it('renders with numeric rows', () => {
    const { container } = render(<Grid rows={2}>Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ gridTemplateRows: 'repeat(2, 1fr)' });
  });

  it('applies gap prop', () => {
    const { container } = render(<Grid gap="4">Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ gap: 'var(--space-4)' });
  });

  it('applies columnGap and rowGap separately', () => {
    const { container } = render(<Grid columnGap="2" rowGap="3">Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ columnGap: 'var(--space-2)', rowGap: 'var(--space-3)' });
  });

  it('applies areas prop', () => {
    const { container } = render(<Grid areas='"a b" "c d"'>Grid</Grid>);
    expect(container.firstChild).toHaveStyle({ gridTemplateAreas: '"a b" "c d"' });
  });

  it('applies inline mode', () => {
    const { container } = render(<Grid inline>Grid</Grid>);
    expect(container.firstChild).toHaveClass('inline');
  });

  it('merges custom className', () => {
    const { container } = render(<Grid className="extra">Grid</Grid>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
