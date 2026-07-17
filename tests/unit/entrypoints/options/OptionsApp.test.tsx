import { render, screen, fireEvent } from '@testing-library/react';
import { OptionsApp } from '@/entrypoints/options/OptionsApp';

// Mock ResourcesPanel + ThemePanel + SettingsPanel để test shell only
jest.mock('@/features/dictionary/ui/ResourcesPanel', () => ({
  ResourcesPanel: () => <div data-testid="resources-panel">Resources</div>,
}));
jest.mock('@/features/theme/ui/ThemePanel', () => ({
  ThemePanel: () => <div data-testid="theme-panel">Theme</div>,
}));
jest.mock('@/features/tts/ui/TtsVoiceManagerPanel', () => ({
  TtsVoiceManagerPanel: () => <div data-testid="tts-voice-manager">TTS</div>,
  DEFAULT_TTS_SETTINGS: {
    enabled: true,
    savedVoices: [],
    voices: [],
    maxDisplay: 3,
    autoplayCount: 0,
    preferredAccent: 'US',
  },
}));
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue({ dictionaryPopup: undefined }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('OptionsApp shell — sidebar nav (UI-UX-Contract)', () => {
  it('renders title "Cell — Tùy chọn"', () => {
    render(<OptionsApp />);
    expect(screen.getByText('Cell — Tùy chọn')).toBeInTheDocument();
  });

  it('renders sidebar navigation with 3 items', () => {
    render(<OptionsApp />);
    const nav = screen.getByRole('tablist', { name: /tùy chọn sections/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tài nguyên/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /giao diện/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /cài đặt/i })).toBeInTheDocument();
  });

  it('defaults to resources tab active', () => {
    render(<OptionsApp />);
    const resourcesTab = screen.getByRole('tab', { name: /tài nguyên/i });
    expect(resourcesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches panel on sidebar item click', () => {
    render(<OptionsApp />);
    const themeTab = screen.getByRole('tab', { name: /giao diện/i });
    fireEvent.click(themeTab);
    expect(themeTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('theme-panel')).toBeInTheDocument();
  });

  it('ARIA: tab has aria-controls pointing to tabpanel id', () => {
    render(<OptionsApp />);
    const resourcesTab = screen.getByRole('tab', { name: /tài nguyên/i });
    const controlsId = resourcesTab.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const panel = document.getElementById(controlsId!);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
  });

  it('ARIA: tabpanel has aria-labelledby pointing back to tab id', () => {
    render(<OptionsApp />);
    const panel = document.getElementById('panel-resources');
    expect(panel).not.toBeNull();
    const labelledbyId = panel!.getAttribute('aria-labelledby');
    expect(labelledbyId).toBeTruthy();
    const tab = document.getElementById(labelledbyId!);
    expect(tab).not.toBeNull();
    expect(tab).toHaveAttribute('role', 'tab');
  });

  it('ARIA: all 3 tabpanels exist with correct linkage', () => {
    render(<OptionsApp />);
    ['resources', 'theme', 'settings'].forEach((id) => {
      const panel = document.getElementById(`panel-${id}`);
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      const labelledbyId = panel!.getAttribute('aria-labelledby');
      expect(labelledbyId).toBe(`nav-${id}`);
      const tab = document.getElementById(`nav-${id}`);
      expect(tab).toHaveAttribute('aria-controls', `panel-${id}`);
    });
  });

  it('renders settings placeholder panel when settings tab active', () => {
    render(<OptionsApp />);
    const settingsTab = screen.getByRole('tab', { name: /cài đặt/i });
    fireEvent.click(settingsTab);
    expect(screen.getByTestId('settings-placeholder')).toBeInTheDocument();
  });

  it('has data-testid="options-app" on container', () => {
    render(<OptionsApp />);
    expect(screen.getByTestId('options-app')).toBeInTheDocument();
  });
});
