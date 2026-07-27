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

jest.mock('./tabs/DictionaryTab', () => ({
  DictionaryTab: (props: { initialTerm?: string; prefill?: { term?: string } | null }) => (
    <div
      data-testid="dictionary-tab"
      data-initial-term={props.initialTerm ?? ''}
      data-prefill-term={props.prefill?.term ?? ''}
    >
      <div data-testid="dictionary-panel">Dictionary panel</div>
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
    await act(async () => {
      controller = mountUniversalPanel();
      // Yield to the microtask queue so loadSettings().then(render) runs inside act().
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => { controller.unmount(); });
  });

  it('switches to Settings tab when the Settings tab button is clicked', async () => {
    await act(async () => { await controller.open('dictionary'); });
    await waitFor(() => expect(screen.getByTestId('dictionary-panel')).toBeInTheDocument());

    await act(async () => { fireEvent.click(screen.getByTestId('universal-panel-tab-settings')); });

    await waitFor(() => expect(screen.getByTestId('universal-panel-content-settings')).toBeInTheDocument());
    expect(controller.isOpen()).toBe(true);
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

  it('sendToCard opens the dictionary tab with initialTerm and prefill, then clears the one-shot term', async () => {
    const prefill = {
      term: 'hello',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: 'hello world',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };

    await act(async () => { await controller.sendToCard(prefill); });

    await waitFor(() => expect(screen.getByTestId('universal-panel')).toBeInTheDocument());
    const tab = screen.getByTestId('dictionary-tab');
    expect(tab).toHaveAttribute('data-initial-term', 'hello');
    expect(tab).toHaveAttribute('data-prefill-term', 'hello');

    // Close and reopen via the orbital badge: the search term should not be
    // replayed, but the prefill persists while the panel is open.
    await act(async () => { await controller.close(); });
    await act(async () => { await controller.open('dictionary'); });

    const reopenedTab = screen.getByTestId('dictionary-tab');
    expect(reopenedTab).toHaveAttribute('data-initial-term', '');
    expect(reopenedTab).toHaveAttribute('data-prefill-term', '');
  });

  it('prefill survives tab switches while the panel is open', async () => {
    const prefill = {
      term: 'hello',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: 'hello world',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };

    await act(async () => { await controller.sendToCard(prefill); });
    await waitFor(() => expect(screen.getByTestId('dictionary-tab')).toBeInTheDocument());
    expect(screen.getByTestId('dictionary-tab')).toHaveAttribute('data-prefill-term', 'hello');

    await act(async () => { await controller.switchTab('settings'); });
    await waitFor(() => expect(screen.getByTestId('settings-dialog-content')).toBeInTheDocument());

    await act(async () => { await controller.switchTab('dictionary'); });
    await waitFor(() => expect(screen.getByTestId('dictionary-tab')).toBeInTheDocument());
    expect(screen.getByTestId('dictionary-tab')).toHaveAttribute('data-prefill-term', 'hello');
  });
});
