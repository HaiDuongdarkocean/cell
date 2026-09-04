import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { useThemeStore } from '@/stores/themeStore';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeConfig } from '@/entities/theme';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();
const storageChangedListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
      onChanged: {
        addListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
          storageChangedListeners.push(cb);
        }),
        removeListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
          const idx = storageChangedListeners.indexOf(cb);
          if (idx >= 0) storageChangedListeners.splice(idx, 1);
        }),
      },
    },
  } as unknown as typeof chrome;
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

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
  storageLocalGetMock.mockResolvedValue({});
  storageChangedListeners.length = 0;
  document.documentElement.style.cssText = '';
  document.documentElement.removeAttribute('data-theme');
  useThemeStore.setState({ mode: 'dark', config: DEFAULT_THEME_CONFIG, isLoaded: false });
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

function Child(): React.JSX.Element {
  return <div data-cell-id="child">Hello</div>;
}

describe('ThemeProvider', () => {
  it('renders children', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('inits themeStore on mount', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(useThemeStore.getState().isLoaded).toBe(true);
  });

  it('applies theme to :root after init (dark)', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(DEFAULT_THEME_CONFIG.customColors.dark.primary);
  });

  it('applies light theme when themeMode = light', async () => {
    storageLocalGetMock.mockImplementation((keys) => {
      const k = Array.isArray(keys) ? keys[0] : keys;
      if (k === STORAGE_KEYS.THEME_MODE) return Promise.resolve({ [STORAGE_KEYS.THEME_MODE]: 'light' });
      return Promise.resolve({});
    });
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('re-applies when mode changes via store', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    act(() => {
      useThemeStore.getState().switchMode('light');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('re-applies when config changes via store', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    const customConfig: ThemeConfig = {
      preset: 'dawn',
      customColors: {
        light: DEFAULT_THEME_CONFIG.customColors.light,
        dark: { ...DEFAULT_THEME_CONFIG.customColors.dark, primary: '#ff0000' },
      },
    };
    act(() => {
      useThemeStore.getState().setConfig(customConfig);
    });
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#ff0000');
  });

  it('syncs from storage.onChanged (themeMode)', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    expect(useThemeStore.getState().mode).toBe('dark');
    act(() => {
      for (const listener of storageChangedListeners) {
        listener({ [STORAGE_KEYS.THEME_MODE]: { newValue: 'light' } }, 'local');
      }
    });
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('syncs from storage.onChanged (themeConfig)', async () => {
    await act(async () => {
      render(<ThemeProvider><Child /></ThemeProvider>);
    });
    const customConfig: ThemeConfig = {
      preset: 'dawn',
      customColors: {
        light: DEFAULT_THEME_CONFIG.customColors.light,
        dark: { ...DEFAULT_THEME_CONFIG.customColors.dark, primary: '#abcdef' },
      },
    };
    act(() => {
      for (const listener of storageChangedListeners) {
        listener({ [STORAGE_KEYS.THEME_CONFIG]: { newValue: customConfig } }, 'local');
      }
    });
    expect(useThemeStore.getState().config).toEqual(customConfig);
  });
});
