import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

const items = [
  { label: 'Home', id: 'home' },
  { label: 'Settings', id: 'settings' },
  { label: 'Profile', id: 'profile' },
];

describe('Breadcrumb', () => {
  it('renders all items and default aria-label', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Breadcrumb');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('marks the last item as current by default', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByText('Profile')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Home')).not.toHaveAttribute('aria-current');
  });

  it('respects an explicit current item', () => {
    const withCurrent = items.map((item) => ({ ...item, current: item.id === 'settings' }));
    render(<Breadcrumb items={withCurrent} />);
    expect(screen.getByText('Settings')).toHaveAttribute('aria-current', 'page');
  });

  it('returns null for empty items', () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
