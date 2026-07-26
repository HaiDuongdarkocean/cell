import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import type { TokenizePanelState } from '@/features/settings/ui/TokenizeSettingsPanel';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import { SettingsTab } from './SettingsTab';

// SettingsDialogContent is a large composite; mock it to isolate SettingsTab.
interface MockSettingsDialogContentProps {
  settings?: Settings;
  onChange?: (settings: Settings) => void;
  tokenizeState?: TokenizePanelState;
  onToggleTokenize?: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  onOpenDictionary?: () => void;
  className?: string;
}

jest.mock('@/features/settings/ui/SettingsDialogContent', () => ({
  SettingsDialogContent: ({
    settings,
    onChange,
    tokenizeState,
    onToggleTokenize,
    onOpenDictionary,
  }: MockSettingsDialogContentProps) => (
    <div data-testid="settings-dialog-content">
      <nav>
        <button type="button" data-testid="settings-sidebar-button">Sidebar</button>
      </nav>
      <button
        type="button"
        data-testid="settings-first-control"
        onClick={() => onChange?.(settings as Settings)}
      >
        First control
      </button>
      <button
        type="button"
        data-testid="settings-open-dictionary"
        onClick={onOpenDictionary}
      >
        Open Dictionary
      </button>
      {tokenizeState && (
        <>
          <div data-testid="settings-tokenize-state">tokenize-on</div>
          <button
            type="button"
            data-testid="settings-toggle-tokenize"
            onClick={() => onToggleTokenize?.('showStatus')}
          >
            Toggle tokenize
          </button>
        </>
      )}
      {!tokenizeState && <div data-testid="settings-tokenize-state">tokenize-off</div>}
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
  const tokenizeState: TokenizePanelState = { enabled: true, showStatus: true, showFrequency: false };

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

  it('bridges tokenize state to SettingsDialogContent and handles toggles', async () => {
    const unsubscribe = jest.fn();
    const tokenize = {
      getState: jest.fn(() => tokenizeState),
      onToggle: jest.fn(),
      subscribe: jest.fn((cb: (state: TokenizePanelState) => void) => {
        cb(tokenizeState);
        return unsubscribe;
      }),
    };

    const { unmount } = render(<SettingsTab tokenize={tokenize} />);
    await waitFor(() => expect(screen.getByTestId('settings-tokenize-state').textContent).toBe('tokenize-on'));

    fireEvent.click(screen.getByTestId('settings-toggle-tokenize'));
    expect(tokenize.onToggle).toHaveBeenCalledWith('showStatus');
    expect(tokenize.getState).toHaveBeenCalled();
    expect(tokenize.subscribe).toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('calls onOpenDictionary prop from SettingsDialogContent', async () => {
    const onOpenDictionary = jest.fn();
    render(<SettingsTab onOpenDictionary={onOpenDictionary} />);
    await waitFor(() => screen.getByTestId('settings-dialog-content'));

    fireEvent.click(screen.getByTestId('settings-open-dictionary'));
    expect(onOpenDictionary).toHaveBeenCalled();
  });

  it('moves initial focus to the first non-sidebar settings control', async () => {
    render(<SettingsTab />);
    await waitFor(() => screen.getByTestId('settings-first-control'));

    expect(document.activeElement).toBe(screen.getByTestId('settings-first-control'));
  });
});
