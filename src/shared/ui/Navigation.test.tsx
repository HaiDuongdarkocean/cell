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
    expect(container.querySelector('nav')).toHaveClass('horizontal');
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

  describe('horizontal overflow affordance', () => {
    const setScrollMetrics = (
      nav: Element,
      metrics: { scrollLeft?: number; scrollWidth?: number; clientWidth?: number },
    ): void => {
      for (const [key, value] of Object.entries(metrics)) {
        Object.defineProperty(nav, key, { value, configurable: true });
      }
    };

    const renderStrip = () => {
      const utils = render(
        <Navigation orientation="horizontal" ariaLabel="Settings sections">
          <NavItem data-section-id="sec1" label="Section 1" />
          <NavItem data-section-id="sec2" label="Section 2" />
        </Navigation>,
      );
      const nav = utils.container.querySelector('nav');
      if (!nav) throw new Error('nav element not rendered');
      return { ...utils, nav };
    };

    it('renders no scroll arrows when the strip fits', () => {
      const { container } = renderStrip();
      expect(container.querySelector('[data-cell-id="settings-nav-scroll-left"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-cell-id="settings-nav-scroll-right"]')).not.toBeInTheDocument();
    });

    it('renders the <nav> landmark inside the wrapper with its aria-label intact', () => {
      const { nav } = renderStrip();
      setScrollMetrics(nav, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 });
      fireEvent.scroll(nav);
      expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBe(nav);
    });

    it('shows only the right arrow at the start bound and pages the strip on click', () => {
      const { nav } = renderStrip();
      setScrollMetrics(nav, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 });
      fireEvent.scroll(nav);

      const rightArrow = screen.getByTestId('settings-nav-scroll-right');
      expect(rightArrow).toHaveAttribute('aria-label', 'Scroll sections right');
      expect(rightArrow).toHaveAttribute('type', 'button');
      expect(screen.queryByTestId('settings-nav-scroll-left')).not.toBeInTheDocument();
      expect(nav.className).toContain('fadeEnd');
      expect(nav.className).not.toContain('fadeStart');

      const scrollBySpy = jest.fn();
      Object.defineProperty(nav, 'scrollBy', { value: scrollBySpy, configurable: true });
      fireEvent.click(rightArrow);
      expect(scrollBySpy).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });
    });

    it('shows both arrows mid-scroll and hides the right arrow at the end bound', () => {
      const { nav } = renderStrip();
      setScrollMetrics(nav, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 });
      fireEvent.scroll(nav);

      setScrollMetrics(nav, { scrollLeft: 200 });
      fireEvent.scroll(nav);
      expect(screen.getByTestId('settings-nav-scroll-left')).toHaveAttribute('aria-label', 'Scroll sections left');
      expect(screen.getByTestId('settings-nav-scroll-right')).toBeInTheDocument();
      expect(nav.className).toContain('fadeStart');
      expect(nav.className).toContain('fadeEnd');

      setScrollMetrics(nav, { scrollLeft: 599 });
      fireEvent.scroll(nav);
      expect(screen.getByTestId('settings-nav-scroll-left')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-nav-scroll-right')).not.toBeInTheDocument();
      expect(nav.className).toContain('fadeStart');
      expect(nav.className).not.toContain('fadeEnd');
    });

    it('never renders arrows in vertical orientation', () => {
      const { container } = render(
        <Navigation ariaLabel="Settings sections">
          <NavItem data-section-id="sec1" label="Section 1" />
        </Navigation>,
      );
      const nav = container.querySelector('nav');
      if (!nav) throw new Error('nav element not rendered');
      setScrollMetrics(nav, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 });
      fireEvent.scroll(nav);
      expect(container.querySelector('[data-cell-id^="settings-nav-scroll"]')).not.toBeInTheDocument();
    });
  });
});
