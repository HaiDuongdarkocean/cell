import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { syncElementTheme, injectThemeTokens } from '@/shared/lib/themeTokens';
import { mountSettingsDialog } from './mountSettingsDialog';
import { mountSettingsDialogLegacy } from './mountSettingsDialogLegacy';

interface MockSettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

declare global {
  var __useLegacySettings: boolean | undefined;
}

jest.mock('./SettingsDialog', () => {
  const React = require('react');
  return {
    SettingsDialog: ({ isOpen, settings, onChange, onClose }: MockSettingsDialogProps) => {
      if (!isOpen) return null;
      return React.createElement(
        'div',
        { 'data-cell-id': 'mock-settings-dialog' },
        React.createElement(
          'button',
          { 'data-cell-id': 'mock-settings-close', onClick: onClose, type: 'button' },
          'Close',
        ),
        React.createElement(
          'button',
          { 'data-cell-id': 'mock-settings-change', onClick: () => onChange(settings), type: 'button' },
          'Change',
        ),
      );
    },
  };
});

jest.mock('@/shared/lib/shadowRoot/ShadowThemeProvider', () => {
  const React = require('react');
  return {
    ShadowThemeProvider: ({ children }: { children: unknown }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/shared/lib/shadowRoot/mountReactShadow', () => {
  const { createRoot } = require('react-dom/client');
  return {
    mountReactShadow: (component: React.ReactElement, options: { parent?: HTMLElement; [key: string]: unknown }) => {
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

jest.mock('@/shared/lib/themeTokens', () => ({
  THEME_STYLE_ID: 'subtitle-theme-tokens',
  syncElementTheme: jest.fn(() => jest.fn()),
  injectThemeTokens: jest.fn(() => jest.fn()),
}));

jest.mock('@/shared/config/config', () => ({
  ...jest.requireActual('@/shared/config/config'),
  get USE_LEGACY_SETTINGS() {
    return Boolean(global.__useLegacySettings);
  },
}));

const mockLoadSettings = jest.mocked(loadSettings);
const mockSaveSettings = jest.mocked(saveSettings);
const mockOnStorageChanged = jest.mocked(onStorageChanged);
const mockRemoveOnStorageChangedListener = jest.mocked(removeOnStorageChangedListener);
const mockSyncElementTheme = jest.mocked(syncElementTheme);
const mockInjectThemeTokens = jest.mocked(injectThemeTokens);

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function getSettingsHost(): HTMLElement | null {
  return document.getElementById('cell-settings-dialog-host');
}

function getLegacyHost(): HTMLElement | null {
  return document.getElementById('cell-settings-dialog-host-legacy');
}



beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  global.__useLegacySettings = false;
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
    let controller: ReturnType<typeof mountSettingsDialog>;
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
    let controller: ReturnType<typeof mountSettingsDialog>;
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
    let controller: ReturnType<typeof mountSettingsDialog>;
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
    let controller: ReturnType<typeof mountSettingsDialog>;
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
    let controller: ReturnType<typeof mountSettingsDialog>;
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

  it('delegates to legacy implementation when USE_LEGACY_SETTINGS is true', async () => {
    global.__useLegacySettings = true;

    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialog>;
    act(() => {
      controller = mountSettingsDialog({ onClose });
    });
    await flush();

    act(() => controller.open());
    await flush();

    expect(screen.getByTestId('mock-settings-dialog')).toBeInTheDocument();
    expect(getLegacyHost()).toBeInTheDocument();
    expect(controller.isOpen()).toBe(true);

    act(() => controller.unmount());
  });
});

describe('mountSettingsDialogLegacy', () => {
  it('returns a controller with open, close, isOpen and unmount', () => {
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose: jest.fn() });
    });

    expect(typeof controller.open).toBe('function');
    expect(typeof controller.close).toBe('function');
    expect(typeof controller.isOpen).toBe('function');
    expect(typeof controller.unmount).toBe('function');

    act(() => controller.unmount());
  });

  it('loads settings, renders the dialog on open and hides on close', async () => {
    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
    });
    await flush();

    const host = getLegacyHost();
    expect(host).toBeInTheDocument();
    expect(screen.queryByTestId('mock-settings-dialog')).not.toBeInTheDocument();

    act(() => controller.open());
    await flush();

    expect(screen.getByTestId('mock-settings-dialog')).toBeInTheDocument();
    const rootEl = host?.lastElementChild as HTMLElement | null;
    expect(rootEl?.style.pointerEvents).toBe('auto');
    expect(controller.isOpen()).toBe(true);

    act(() => controller.close());
    await flush();

    expect(screen.queryByTestId('mock-settings-dialog')).not.toBeInTheDocument();
    expect(rootEl?.style.pointerEvents).toBe('none');
    expect(controller.isOpen()).toBe(false);

    act(() => controller.unmount());
  });

  it('unmount removes the host and cleans up listeners and tokens', async () => {
    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
    });
    await flush();

    const listener = mockOnStorageChanged.mock.calls[0][0] as (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => void;

    act(() => controller.unmount());

    expect(mockRemoveOnStorageChangedListener).toHaveBeenCalledWith(listener);
    expect(getLegacyHost()).toBeNull();

    const syncCleanup = mockSyncElementTheme.mock.results[0]?.value as jest.Mock | undefined;
    if (syncCleanup) expect(syncCleanup).toHaveBeenCalled();

    const tokenCleanup = mockInjectThemeTokens.mock.results[0]?.value as jest.Mock | undefined;
    if (tokenCleanup) expect(tokenCleanup).toHaveBeenCalled();
  });

  it('saves settings and closes via the dialog callbacks', async () => {
    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
    });
    await flush();
    act(() => controller.open());
    await flush();

    const changeButton = screen.getByTestId('mock-settings-change');
    const closeButton = screen.getByTestId('mock-settings-close');

    fireEvent.click(changeButton);
    expect(mockSaveSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId('mock-settings-dialog')).not.toBeInTheDocument();
    expect(controller.isOpen()).toBe(false);

    act(() => controller.unmount());
  });

  it('reloads settings when chrome storage changes for the settings key', async () => {
    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
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

  it('reparents to fullscreen element and back', async () => {
    const style = document.createElement('style');
    style.id = 'subtitle-theme-tokens';
    document.head.appendChild(style);

    const fsContainer = document.createElement('div');
    document.body.appendChild(fsContainer);

    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
    });
    await flush();

    expect(getLegacyHost()?.parentElement).toBe(document.body);
    expect(mockInjectThemeTokens).not.toHaveBeenCalled();

    // Enter fullscreen via the event listener.
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = fsContainer;
    document.dispatchEvent(new Event('fullscreenchange'));
    await flush();

    expect(getLegacyHost()?.parentElement).toBe(fsContainer);
    expect(style.parentElement).toBe(fsContainer);

    // Exit fullscreen via the event listener.
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    await flush();

    expect(getLegacyHost()?.parentElement).toBe(document.body);
    expect(style.parentElement).toBe(document.head);

    // controller.open() also reparents when already in fullscreen.
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = fsContainer;
    act(() => controller.open());
    await flush();

    expect(getLegacyHost()?.parentElement).toBe(fsContainer);
    expect(screen.getByTestId('mock-settings-dialog')).toBeInTheDocument();

    act(() => controller.unmount());

    const fsChangeHandler = addSpy.mock.calls.find(([type]) => type === 'fullscreenchange')?.[1] as EventListener;
    const webkitFsChangeHandler = addSpy.mock.calls.find(([type]) => type === 'webkitfullscreenchange')?.[1] as EventListener;

    expect(removeSpy).toHaveBeenCalledWith('fullscreenchange', fsChangeHandler);
    expect(removeSpy).toHaveBeenCalledWith('webkitfullscreenchange', webkitFsChangeHandler);
    expect(style.parentElement).toBe(document.head);

    fsContainer.remove();
  });

  it('skips token injection when the theme style already exists', async () => {
    const style = document.createElement('style');
    style.id = 'subtitle-theme-tokens';
    document.head.appendChild(style);

    const onClose = jest.fn();
    let controller: ReturnType<typeof mountSettingsDialogLegacy>;
    act(() => {
      controller = mountSettingsDialogLegacy({ onClose });
    });
    await flush();

    expect(mockInjectThemeTokens).not.toHaveBeenCalled();

    act(() => controller.unmount());
    document.head.innerHTML = '';
  });
});
