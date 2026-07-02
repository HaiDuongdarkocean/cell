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

  it('renders bg opacity slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ bgOpacity: 0.7 })} />);
    const slider = screen.getByTestId('nav-cluster-bg-opacity') as HTMLInputElement;
    expect(slider.value).toBe('0.7');
  });

  it('renders button opacity slider with current value', () => {
    render(<NavClusterSettingsPanel {...makeProps({ buttonOpacity: 0.9 })} />);
    const slider = screen.getByTestId('nav-cluster-button-opacity') as HTMLInputElement;
    expect(slider.value).toBe('0.9');
  });

  it('renders off toggle button', () => {
    render(<NavClusterSettingsPanel {...makeProps()} />);
    expect(screen.getByTestId('nav-cluster-off-toggle')).toBeInTheDocument();
  });

  it('button size slider change calls onChange with new buttonSize', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '56' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonSize: 56 });
  });

  it('bg opacity slider change calls onChange with new bgOpacity', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-bg-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(props.onChange).toHaveBeenCalledWith({ bgOpacity: 0.5 });
  });

  it('button opacity slider change calls onChange with new buttonOpacity', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonOpacity: 0.8 });
  });

  it('off toggle click shows confirm dialog', () => {
    render(<NavClusterSettingsPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('nav-cluster-off-toggle'));
    expect(screen.getByTestId('nav-cluster-off-confirm')).toBeInTheDocument();
  });

  it('confirm Yes calls onChange with enabled=false', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    fireEvent.click(screen.getByTestId('nav-cluster-off-toggle'));
    fireEvent.click(screen.getByTestId('nav-cluster-off-confirm-yes'));
    expect(props.onChange).toHaveBeenCalledWith({ enabled: false });
  });

  it('confirm No cancels (no onChange call)', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    fireEvent.click(screen.getByTestId('nav-cluster-off-toggle'));
    fireEvent.click(screen.getByTestId('nav-cluster-off-confirm-no'));
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('nav-cluster-off-confirm')).not.toBeInTheDocument();
  });

  it('button size slider snaps to nearest preset on change', () => {
    const props = makeProps();
    render(<NavClusterSettingsPanel {...props} />);
    const slider = screen.getByTestId('nav-cluster-button-size') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '52' } });
    expect(props.onChange).toHaveBeenCalledWith({ buttonSize: 56 });
  });
});
