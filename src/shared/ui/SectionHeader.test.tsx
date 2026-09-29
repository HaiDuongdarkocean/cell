import { render, screen } from '@testing-library/react';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders title as a heading at the requested level', () => {
    render(<SectionHeader level={2} title="Dictionaries" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Dictionaries' })).toBeInTheDocument();
  });

  it('renders optional subtitle and trailing action', () => {
    render(
      <SectionHeader
        title="Links"
        subtitle="Manage dictionary links"
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByText('Manage dictionary links')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('omits subtitle and action slots when not provided', () => {
    const { container } = render(<SectionHeader title="Solo" />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 3, name: 'Solo' })).toBeInTheDocument();
  });

  it('passes data-cell-id through to the header element', () => {
    render(<SectionHeader title="T" data-cell-id="res-header" />);
    expect(screen.getByRole('heading').parentElement?.parentElement).toHaveAttribute(
      'data-cell-id',
      'res-header',
    );
  });
});
