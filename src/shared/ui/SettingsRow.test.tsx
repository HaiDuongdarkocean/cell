import { render, screen } from '@testing-library/react';
import { SettingsRow } from './SettingsRow';

describe('SettingsRow', () => {
  it('renders children', () => {
    render(<SettingsRow>Row content</SettingsRow>);
    expect(screen.getByText('Row content')).toBeInTheDocument();
  });

  it('spreads extra attributes on the row', () => {
    render(
      <SettingsRow data-cell-id="settings-row" aria-label="API key">
        Row content
      </SettingsRow>,
    );
    expect(screen.getByTestId('settings-row')).toHaveAttribute('aria-label', 'API key');
  });

  it('accepts all layout modifier props without error', () => {
    const { container } = render(
      <SettingsRow divider stacked flush compact dense>
        Stacked row
      </SettingsRow>,
    );
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('Stacked row')).toBeInTheDocument();
  });

  it('forwards refs to the div', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <SettingsRow ref={ref} data-cell-id="row">
        Ref row
      </SettingsRow>,
    );
    expect(ref.current).toBe(screen.getByTestId('row'));
  });
});
