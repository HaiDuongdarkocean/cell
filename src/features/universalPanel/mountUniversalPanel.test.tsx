import { describe, expect, it, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS } from '@/shared/config/config';

// Mock the heavy settings UI so the mount integration test stays focused on
// controller/tab wiring.
interface MockSettingsDialogContentProps {
  settings?: Settings;
  onChange?: (settings: Settings) => void;
  className?: string;
}

jest.mock('@/features/settings/ui/SettingsDialogContent', () => ({
  SettingsDialogContent: ({ settings, onChange }: MockSettingsDialogContentProps) => (
    <div data-cell-id="settings-dialog-content">
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

jest.mock('./tabs/DictionaryTab', () => ({
  DictionaryTab: (props: { initialTerm?: string; prefill?: { term?: string } | null }) => (
    <div
      data-cell-id="dictionary-tab"
      data-initial-term={props.initialTerm ?? ''}
      data-prefill-term={props.prefill?.term ?? ''}
    >
      <div data-cell-id="dictionary-panel">Dictionary panel</div>
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

beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

function getByTestId(testId: string): HTMLElement {
  const host = document.getElementById('cell-universal-panel-host');
  const root = host?.shadowRoot ?? host;
  const element = root?.querySelector(`[data-cell-id="${testId}"]`) as HTMLElement | null;
  if (!element) throw new Error(`Unable to find element by: [data-cell-id="${testId}"]`);
  return element;
}

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
    await waitFor(() => expect(getByTestId('dictionary-panel')).toBeTruthy());

    await act(async () => { fireEvent.click(getByTestId('universal-panel-tab-settings')); });

    await waitFor(() => expect(getByTestId('universal-panel-content-settings')).toBeTruthy());
    expect(controller.isOpen()).toBe(true);
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

    await waitFor(() => expect(getByTestId('universal-panel')).toBeTruthy());
    const tab = getByTestId('dictionary-tab');
    expect(tab).toHaveAttribute('data-initial-term', 'hello');
    expect(tab).toHaveAttribute('data-prefill-term', 'hello');

    // Close and reopen via the orbital badge: the search term should not be
    // replayed, and the card-creator prefill should survive the close cycle.
    await act(async () => { await controller.close(); });
    await act(async () => { await controller.open('dictionary'); });

    const reopenedTab = getByTestId('dictionary-tab');
    expect(reopenedTab).toHaveAttribute('data-initial-term', '');
    expect(reopenedTab).toHaveAttribute('data-prefill-term', 'hello');
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
    await waitFor(() => expect(getByTestId('dictionary-tab')).toBeTruthy());
    expect(getByTestId('dictionary-tab')).toHaveAttribute('data-prefill-term', 'hello');

    await act(async () => { await controller.switchTab('settings'); });
    await waitFor(() => expect(getByTestId('settings-dialog-content')).toBeTruthy());

    await act(async () => { await controller.switchTab('dictionary'); });
    await waitFor(() => expect(getByTestId('dictionary-tab')).toBeTruthy());
    expect(getByTestId('dictionary-tab')).toHaveAttribute('data-prefill-term', 'hello');
  });
});
