import { render, screen } from '@testing-library/react';
import { SelectionBar } from './SelectionBar';

describe('SelectionBar', () => {
  it('renders a toolbar landmark with the i18n aria-label', () => {
    render(
      <SelectionBar open>
        <button>Action</button>
      </SelectionBar>,
    );
    expect(screen.getByRole('toolbar', { name: 'Selection actions' })).toBeInTheDocument();
  });

  it('marks the bar open when open=true', () => {
    render(
      <SelectionBar open data-cell-id="bar">
        <button>Action</button>
      </SelectionBar>,
    );
    const bar = screen.getByRole('toolbar');
    expect(bar).toHaveAttribute('data-open');
    expect(bar).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('is hidden and inert when open=false', () => {
    render(
      <SelectionBar open={false}>
        <button>Action</button>
      </SelectionBar>,
    );
    const bar = screen.getByRole('toolbar', { hidden: true });
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).not.toHaveAttribute('data-open');
  });

  it('renders the optional leading label', () => {
    render(
      <SelectionBar open label={<span>3 selected</span>}>
        <button>Action</button>
      </SelectionBar>,
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('passes data-cell-id through', () => {
    render(
      <SelectionBar open data-cell-id="my-bar">
        <button>Action</button>
      </SelectionBar>,
    );
    expect(document.querySelector('[data-cell-id="my-bar"]')).toBeTruthy();
  });
});
