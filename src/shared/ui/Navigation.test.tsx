import { render, screen, fireEvent } from '@testing-library/react';
import { Navigation } from './Navigation';
import { NavItem } from './NavItem';

describe('Navigation', () => {
  it('renders navigation with accessible role and label', () => {
    render(
      <Navigation ariaLabel="Main navigation">
        <NavItem data-section-id="sec1" label="Section 1" />
        <NavItem data-section-id="sec2" label="Section 2" />
      </Navigation>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    expect(screen.getByText('Section 2')).toBeInTheDocument();
  });

  it('renders vertical orientation by default', () => {
    const { container } = render(
      <Navigation>
        <NavItem data-section-id="sec1" label="Section 1" />
      </Navigation>,
    );
    expect(container.firstChild).toHaveClass('vertical');
  });

  it('renders horizontal orientation when specified', () => {
    const { container } = render(
      <Navigation orientation="horizontal">
        <NavItem data-section-id="sec1" label="Section 1" />
      </Navigation>,
    );
    expect(container.firstChild).toHaveClass('horizontal');
  });

  it('sets aria-current on active item', () => {
    render(
      <Navigation activeId="sec2">
        <NavItem data-section-id="sec1" label="Section 1" />
        <NavItem data-section-id="sec2" label="Section 2" />
      </Navigation>,
    );
    const item1 = screen.getByText('Section 1').closest('button');
    const item2 = screen.getByText('Section 2').closest('button');

    expect(item1).not.toHaveAttribute('aria-current');
    expect(item2).toHaveAttribute('aria-current', 'true');
  });

  it('calls onActiveChange when item is clicked via event delegation', () => {
    const onActiveChange = jest.fn();
    render(
      <Navigation activeId="sec1" onActiveChange={onActiveChange}>
        <NavItem data-section-id="sec1" label="Section 1" />
        <NavItem data-section-id="sec2" label="Section 2" />
      </Navigation>,
    );
    fireEvent.click(screen.getByText('Section 2'));
    expect(onActiveChange).toHaveBeenCalledWith('sec2');
  });
});
