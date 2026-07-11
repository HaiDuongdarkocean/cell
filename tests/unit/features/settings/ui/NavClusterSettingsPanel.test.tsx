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

  it('renders button opacity slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ buttonOpacity: 0.9 })} />);
    const slider = screen.getByTestId('nav-cluster-button-opacity') as HTMLInputElement;
    expect(slider.value).toBe('0.9');
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

  it('button opacity slider change calls onChange with new buttonOpacity', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonOpacity: 0.8 });
  });

  it('button size slider passes through non-preset value (free range, no snap)', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '52' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonSize: 52 });
  });
});
