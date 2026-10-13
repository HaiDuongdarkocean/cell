import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { mountSettingsDialog } from './mountSettingsDialog';

interface MockSettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

jest.mock('./SettingsDialog', () => {
  const React = require('react');
  return {
    SettingsDialog: ({ isOpen, settings, onChange, onClose }: MockSettingsDialogProps) => {
      if (!isOpen) return null;
      return React.createElement(
        'div',
        { 'data-tihoka-id': 'mock-settings-dialog' },
        React.createElement(
          'button',
          { 'data-tihoka-id': 'mock-settings-close', onClick: onClose, type: 'button' },
          'Close',
        ),
        React.createElement(
          'button',
          { 'data-tihoka-id': 'mock-settings-change', onClick: () => onChange(settings), type: 'button' },
          'Change',
        ),
      );
    },
  };
});

jest.mock('@/features/theme/ui/ShadowThemeProvider', () => {
  const React = require('react');
  return {
    ShadowThemeProvider: ({ children }: { children: unknown }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/shared/lib/shadowRoot/mountReactShadow', () => {
  const { createRoot } = require('react-dom/client');
  return {
    mountReactShadow: (_component: React.ReactElement, options: { parent?: HTMLElement; [key: string]: unknown }) => {
      const host = document.createElement('div');
      const rootEl = document.createElement('div');
      host.appendChild(rootEl);
      const parent = options?.parent || document.body;
      parent.appendChild(host);
      const root = createRoot(rootEl);
      let unmounted = false;
      return {
        host,
        rootEl,
        shadow: null,
        root: {
          render: (el: React.ReactElement) => {
            if (unmounted) return;
            root.render(el);
          },
        },
        unmount: () => {
          unmounted = true;
          root.unmount();
          host.remove();
        },
      };
    },
  };
});

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  onStorageChanged: jest.fn(),
  removeOnStorageChangedListener: jest.fn(),
}));

const mockLoadSettings = jest.mocked(loadSettings);
const mockSaveSettings = jest.mocked(saveSettings);
const mockOnStorageChanged = jest.mocked(onStorageChanged);
const mockRemoveOnStorageChangedListener = jest.mocked(removeOnStorageChangedListener);

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function getSettingsHost(): HTMLElement | null {
  return document.getElementById('Tihoka-settings-dialog-host');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = null;
  mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockSaveSettings.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = null;
});

describe('mountSettingsDialog', () => {
  it('returns a controller with open, close, isOpen and unmount', () => {
    let controller!: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose: jest.fn() });
    });

    expect(typeof controller.open).toBe('function');
    expect(typeof controller.close).toBe('function');
    expect(typeof controller.isOpen).toBe('function');
    expect(typeof controller.unmount).toBe('function');

    act(() => controller.unmount());
  });

  it('loads settings, renders the dialog on open and hides on close', async () => {
    const onClose = jest.fn();
    let controller!: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose });
    });
    await flush();

    const host = getSettingsHost();
    expect(host).toBeInTheDocument();
    expect(screen.queryByTestId('mock-settings-dialog')).toBeNull();

    act(() => controller.open());
    await flush();

    const dialog = screen.queryByTestId('mock-settings-dialog');
    expect(dialog).not.toBeNull();
    expect(host?.style.pointerEvents).toBe('auto');
    expect(controller.isOpen()).toBe(true);

    act(() => controller.close());
    await flush();

    expect(screen.queryByTestId('mock-settings-dialog')).toBeNull();
    expect(host?.style.pointerEvents).toBe('none');
    expect(controller.isOpen()).toBe(false);

    act(() => controller.unmount());
  });

  it('unmount removes the host and detaches the storage listener', async () => {
    const onClose = jest.fn();
    let controller!: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose });
    });
    await flush();
    act(() => controller.open());
    await flush();

    const listener = mockOnStorageChanged.mock.calls[0][0] as (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => void;

    act(() => controller.unmount());

    expect(mockRemoveOnStorageChangedListener).toHaveBeenCalledWith(listener);
    expect(getSettingsHost()).toBeNull();
  });

  it('saves settings and closes via the dialog callbacks', async () => {
    const onClose = jest.fn();
    let controller!: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose });
    });
    await flush();
    act(() => controller.open());
    await flush();

    const changeButton = screen.getByTestId('mock-settings-change');
    const closeButton = screen.getByTestId('mock-settings-close');

    expect(changeButton).not.toBeNull();
    expect(closeButton).not.toBeNull();

    if (changeButton) fireEvent.click(changeButton);
    expect(mockSaveSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);

    if (closeButton) fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId('mock-settings-dialog')).toBeNull();
    expect(controller.isOpen()).toBe(false);

    act(() => controller.unmount());
  });

  it('reloads settings when chrome storage changes for the settings key', async () => {
    const onClose = jest.fn();
    let controller!: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose });
    });
    await flush();

    const listener = mockOnStorageChanged.mock.calls[0][0] as (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => void;

    act(() => listener({}, 'sync'));
    await flush();
    expect(mockLoadSettings).toHaveBeenCalledTimes(1);

    act(() => listener({}, 'local'));
    await flush();
    expect(mockLoadSettings).toHaveBeenCalledTimes(1);

    act(() => listener({ [STORAGE_KEYS.SETTINGS]: { newValue: {}, oldValue: {} } }, 'local'));
    await flush();
    expect(mockLoadSettings).toHaveBeenCalledTimes(2);

    act(() => controller.unmount());
  });
});
