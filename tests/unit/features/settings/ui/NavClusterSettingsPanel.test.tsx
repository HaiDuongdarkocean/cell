import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavClusterSettingsPanel } from '@/features/settings/ui/NavClusterSettingsPanel';
import { DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import type { NavClusterSettings } from '@/entities/settings';

function makeProps(overrides: Partial<NavClusterSettings> = {}) {
  const settings: NavClusterSettings = { ...DEFAULT_NAV_CLUSTER_SETTINGS, ...overrides };
  return {
    settings,
    onChange: jest.fn(),
  };
}

describe('NavClusterSettingsPanel (ADR-018 D2, spec §A9)', () => {
  it('renders panel with data-testid', () => {
    render(<NavClusterSettingsPanel {...makeProps()} />);
    expect(screen.getByTestId('nav-cluster-settings-panel')).toBeInTheDocument();
  });

  it('renders button size slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ buttonSize: 48 })} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    expect(slider.value).toBe('48');
  });

  it('renders text opacity slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ textOpacity: 0.8 })} />);
    const slider = screen.getByTestId('nav-cluster-text-opacity') as HTMLInputElement;
    expect(slider.value).toBe('0.8');
  });

  it('renders bg opacity slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ bgOpacity: 0.3 })} />);
    const slider = screen.getByTestId('nav-cluster-bg-opacity') as HTMLInputElement;
    expect(slider.value).toBe('0.3');
  });

  it('button size slider change calls onChange with raw value (free range, no snap)', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '56' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonSize: 56 });
  });

  it('button size slider has min=10 max=100 (ADR-018 D2-rev free range)', () => {
    render(<NavClusterSettingsPanel {...makeProps()} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    expect(slider.min).toBe('10');
    expect(slider.max).toBe('100');
    expect(slider.step).toBe('1');
  });

  it('text opacity slider change calls onChange with new textOpacity', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-text-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(props.onChange).toHaveBeenCalledWith({ textOpacity: 0.8 });
  });

  it('bg opacity slider change calls onChange with new bgOpacity', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-bg-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(props.onChange).toHaveBeenCalledWith({ bgOpacity: 0.5 });
  });

  it('preset button click calls onChange with preset values', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const frosted = screen.getByTestId('nav-cluster-preset-frosted');
    fireEvent.click(frosted);
    expect(props.onChange).toHaveBeenCalledWith({ textOpacity: 1, bgOpacity: 0.2 });
  });

  it('button size slider passes through non-preset value (free range, no snap)', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '52' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonSize: 52 });
  });
});
