import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import type { TokenizePanelState } from '@/features/settings/ui/TokenizeSettingsPanel';
import { DEFAULT_SETTINGS } from '@/shared/config/config';

// Mock the heavy settings UI so the mount integration test stays focused on
// controller/tab wiring.
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
    onOpenDictionary,
  }: MockSettingsDialogContentProps) => (
    <div data-testid="settings-dialog-content">
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
  getStorage: jest.fn(() => Promise.resolve({})),
  setStorage: jest.fn(() => Promise.resolve()),
  getSessionStorage: jest.fn(() => Promise.resolve({})),
  setSessionStorage: jest.fn(() => Promise.resolve()),
}));

import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getSessionStorage } from '@/shared/lib/chrome-apis';
import { mountUniversalPanel } from './mountUniversalPanel';
import type { UniversalPanelMountController } from './UniversalPanelController';

const mockLoadSettings = jest.mocked(loadSettings);
const mockGetSessionStorage = jest.mocked(getSessionStorage);

describe('mountUniversalPanel', () => {
  let controller: UniversalPanelMountController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockGetSessionStorage.mockResolvedValue({});
    document.body.innerHTML = '';
    controller = await act(() => mountUniversalPanel());
  });

  afterEach(() => {
    act(() => { controller.unmount(); });
  });

  it('renders the universal panel and wires SettingsTab onOpenDictionary to switch to the Dictionary tab', async () => {
    await act(async () => { await controller.open('settings'); });

    await waitFor(() => expect(screen.getByTestId('settings-open-dictionary')).toBeInTheDocument());
    expect(screen.getByTestId('universal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('universal-panel-content-settings')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTestId('settings-open-dictionary')); });

    await waitFor(() => expect(screen.getByTestId('universal-panel-content-dictionary')).toBeInTheDocument());
    expect(screen.getByTestId('dictionary-tab')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('universal-panel-content-settings')).not.toBeInTheDocument();
  });
});
