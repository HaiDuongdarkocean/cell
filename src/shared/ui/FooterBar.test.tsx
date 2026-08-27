import { render, screen, fireEvent } from '@testing-library/react';
import { FooterBar } from './FooterBar';

const slots = [
  { key: 'home', icon: <span data-cell-id="home-icon" />, label: 'Home', onClick: jest.fn() },
  { key: 'search', icon: <span data-cell-id="search-icon" />, label: 'Search', onClick: jest.fn() },
];

describe('FooterBar', () => {
  it('renders all slots with icons and labels', () => {
    render(<FooterBar slots={slots} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('calls the slot onClick when a button is clicked', () => {
    render(<FooterBar slots={slots} />);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(slots[0].onClick).toHaveBeenCalledTimes(1);
    expect(slots[1].onClick).not.toHaveBeenCalled();
  });

  it('respects disabled slot', () => {
    const disabledSlots = [{ ...slots[0], disabled: true }];
    render(<FooterBar slots={disabledSlots} />);
    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled();
  });

  it('marks active slot', () => {
    const activeSlots = [{ ...slots[0], active: true, variant: 'ghost' as const }];
    const { container } = render(<FooterBar slots={activeSlots} />);
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });
});
