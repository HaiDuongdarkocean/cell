import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import { SettingsTab } from './SettingsTab';

// SettingsDialogContent is a large composite; mock it to isolate SettingsTab.
interface MockSettingsDialogContentProps {
  settings?: Settings;
  onChange?: (settings: Settings) => void;
  className?: string;
}

jest.mock('@/features/settings/ui/SettingsDialogContent', () => ({
  SettingsDialogContent: ({ settings, onChange }: MockSettingsDialogContentProps) => (
    <div data-cell-id="settings-dialog-content">
      <nav>
        <button type="button" data-cell-id="settings-sidebar-button">Sidebar</button>
      </nav>
      <button
        type="button"
        data-cell-id="settings-first-control"
        onClick={() => onChange?.(settings as Settings)}
      >
        First control
      </button>
    </div>
  ),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  onStorageChanged: jest.fn(),
  removeOnStorageChangedListener: jest.fn(),
}));

import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged } from '@/shared/lib/chrome-apis';

const mockLoadSettings = jest.mocked(loadSettings);
const mockSaveSettings = jest.mocked(saveSettings);
const mockOnStorageChanged = jest.mocked(onStorageChanged);

describe('SettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockSaveSettings.mockResolvedValue(undefined);
    document.body.innerHTML = '';
  });

  it('loads settings and renders SettingsDialogContent', async () => {
    render(<SettingsTab />);
    expect(screen.getByTestId('settings-tab-loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('settings-dialog-content')).toBeInTheDocument());
    expect(screen.queryByTestId('settings-tab-loading')).not.toBeInTheDocument();
    expect(mockLoadSettings).toHaveBeenCalledTimes(1);
  });

  it('saves settings via saveSettings when onChange is called', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByTestId('settings-dialog-content'));

    fireEvent.click(screen.getByTestId('settings-first-control'));
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS));
  });

  it('syncs flat fields back into the active language profile before saving', async () => {
    const withProfile: Settings = {
      ...DEFAULT_SETTINGS,
      activeProfileId: 'p1',
      languageProfiles: [{
        id: 'p1',
        target: 'en',
        native: '',
        name: 'English',
        order: 1,
        subtitleOverlayTargetStyle: DEFAULT_SETTINGS.subtitleOverlayTargetStyle!,
        subtitleOverlayNativeStyle: DEFAULT_SETTINGS.subtitleOverlayNativeStyle!,
        subtitleOverlayAutoLoad: DEFAULT_SETTINGS.subtitleOverlayAutoLoad,
        subtitleOverlayAutoLoadAsr: DEFAULT_SETTINGS.subtitleOverlayAutoLoadAsr,
        subtitleOverlayAutoTranslate: DEFAULT_SETTINGS.subtitleOverlayAutoTranslate,
        dictionaryPopup: DEFAULT_SETTINGS.dictionaryPopup!,
        resourceIds: [],
      }],
      subtitleOverlayAutoLoad: false,
    };
    mockLoadSettings.mockResolvedValueOnce(withProfile);
    render(<SettingsTab />);
    await waitFor(() => screen.getByTestId('settings-dialog-content'));

    fireEvent.click(screen.getByTestId('settings-first-control'));
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalled());

    const saved = mockSaveSettings.mock.calls[0][0] as Settings;
    expect(saved.subtitleOverlayAutoLoad).toBe(false);
    expect(saved.languageProfiles[0]?.subtitleOverlayAutoLoad).toBe(false);
    expect(saved.languageProfiles[0]?.dictionaryPopup).toEqual(DEFAULT_SETTINGS.dictionaryPopup);
  });

  it('keeps settings in sync via chrome.storage.onChanged', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByTestId('settings-dialog-content'));
    expect(mockLoadSettings).toHaveBeenCalledTimes(1);

    const listener = mockOnStorageChanged.mock.calls[0][0] as (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => void;
    listener({ settings: { newValue: {}, oldValue: {} } }, 'local');

    await waitFor(() => expect(mockLoadSettings).toHaveBeenCalledTimes(2));
  });

  it('moves initial focus to the first non-sidebar settings control', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByTestId('settings-first-control'));

    expect(document.activeElement).toBe(screen.getByTestId('settings-first-control'));
  });
});
