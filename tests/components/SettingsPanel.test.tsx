import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '@/popup/components/SettingsPanel';
import type { Settings } from '@/types/media';

const mockSettings: Settings = {
  concurrentDownloads: 3,
  defaultQuality: 'highest',
  defaultSubtitleLanguage: 'en',
  theme: 'light',
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: 4,
  parallelFallback: 'save-ts',
};

describe('SettingsPanel', () => {
  it('renders all settings fields with current values', () => {
    render(<SettingsPanel settings={mockSettings} onChange={jest.fn()} />);
    expect(screen.getByTestId('concurrent-input')).toHaveValue(3);
    expect(screen.getByTestId('quality-select')).toHaveValue('highest');
    expect(screen.getByTestId('language-input')).toHaveValue('en');
    expect(screen.getByTestId('theme-select')).toHaveValue('light');
  });

  it('calls onChange with updated concurrentDownloads', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('concurrent-input'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      concurrentDownloads: 5,
    });
  });

  it('calls onChange with updated defaultQuality', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('quality-select'), { target: { value: '720p' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      defaultQuality: '720p',
    });
  });

  it('calls onChange with updated defaultSubtitleLanguage', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('language-input'), { target: { value: 'fr' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      defaultSubtitleLanguage: 'fr',
    });
  });

  it('calls onChange with updated theme', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('theme-select'), { target: { value: 'dark' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      theme: 'dark',
    });
  });

  it('renders parallel conversion mode select with current value', () => {
    render(<SettingsPanel settings={mockSettings} onChange={jest.fn()} />);
    expect(screen.getByTestId('parallel-mode-select')).toHaveValue('auto');
  });

  it('calls onChange with updated parallelConversion', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('parallel-mode-select'), { target: { value: 'manual' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      parallelConversion: 'manual',
    });
  });

  it('shows worker count input only in manual mode', () => {
    const { rerender } = render(<SettingsPanel settings={mockSettings} onChange={jest.fn()} />);
    // auto mode — no worker count input
    expect(screen.queryByTestId('manual-workers-input')).not.toBeInTheDocument();

    // switch to manual
    const manualSettings = { ...mockSettings, parallelConversion: 'manual' as const };
    rerender(<SettingsPanel settings={manualSettings} onChange={jest.fn()} />);
    expect(screen.getByTestId('manual-workers-input')).toBeInTheDocument();
    expect(screen.getByTestId('manual-workers-input')).toHaveValue(4);
  });

  it('clamps manual worker count to safe bounds', () => {
    const onChange = jest.fn();
    const manualSettings = { ...mockSettings, parallelConversion: 'manual' as const };
    render(<SettingsPanel settings={manualSettings} onChange={onChange} />);

    // Try setting above max (6)
    fireEvent.change(screen.getByTestId('manual-workers-input'), { target: { value: '99' } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...manualSettings,
      manualWorkerCount: 6,
    });

    // Try setting below min (2)
    fireEvent.change(screen.getByTestId('manual-workers-input'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...manualSettings,
      manualWorkerCount: 2,
    });
  });

  it('hides fallback select when parallel is off', () => {
    const offSettings = { ...mockSettings, parallelConversion: 'off' as const };
    render(<SettingsPanel settings={offSettings} onChange={jest.fn()} />);
    expect(screen.queryByTestId('parallel-fallback-select')).not.toBeInTheDocument();
  });

  it('calls onChange with updated parallelFallback', () => {
    const onChange = jest.fn();
    render(<SettingsPanel settings={mockSettings} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('parallel-fallback-select'), { target: { value: 'sequential' } });
    expect(onChange).toHaveBeenCalledWith({
      ...mockSettings,
      parallelFallback: 'sequential',
    });
  });
});
