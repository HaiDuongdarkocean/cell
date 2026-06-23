import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '@/popup/components/SettingsPanel';
import type { Settings } from '@/types/media';

const mockSettings: Settings = {
  concurrentDownloads: 3,
  defaultQuality: 'highest',
  defaultSubtitleLanguage: 'en',
  theme: 'light',
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
});
