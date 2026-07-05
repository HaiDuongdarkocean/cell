import { useThemeStore } from '@/stores/themeStore';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { DEFAULT_THEME_MODE } from '@/features/theme/logic/themeStorage';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeMode, ThemeConfig } from '@/entities/theme';

// --- chrome.storage.local mock ---

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
  // Default: storage empty → loadThemeMode returns default, loadThemeConfig returns default,
  // loadSettings returns DEFAULT_SETTINGS (no settings key).
  storageLocalGetMock.mockResolvedValue({});
  useThemeStore.setState({ mode: DEFAULT_THEME_MODE, config: DEFAULT_THEME_CONFIG, isLoaded: false });
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('useThemeStore', () => {
  it('has correct initial state', () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe(DEFAULT_THEME_MODE);
    expect(state.config).toEqual(DEFAULT_THEME_CONFIG);
    expect(state.isLoaded).toBe(false);
  });

  describe('init', () => {
    it('loads mode + config from storage', async () => {
      const config: ThemeConfig = {
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
          dark: DEFAULT_THEME_CONFIG.customColors.dark,
        },
      };
      storageLocalGetMock.mockImplementation((keys) => {
        const k = Array.isArray(keys) ? keys[0] : keys;
        if (k === STORAGE_KEYS.THEME_MODE) return Promise.resolve({ [STORAGE_KEYS.THEME_MODE]: 'light' });
        if (k === STORAGE_KEYS.THEME_CONFIG) return Promise.resolve({ [STORAGE_KEYS.THEME_CONFIG]: config });
        return Promise.resolve({});
      });
      await useThemeStore.getState().init();
      const state = useThemeStore.getState();
      expect(state.mode).toBe('light');
      expect(state.config.customColors.light.primary).toBe('#ff0000');
      expect(state.isLoaded).toBe(true);
    });

    it('seeds themeMode from legacy settings.theme when themeMode absent', async () => {
      // themeMode absent (default dark returned), settings.theme = 'light' (legacy, v7 —
      // no migration flip). settingsStore.loadSettings returns merged với schemaVersion=7.
      storageLocalGetMock.mockImplementation((keys) => {
        const k = Array.isArray(keys) ? keys[0] : keys;
        if (k === STORAGE_KEYS.THEME_MODE) return Promise.resolve({}); // absent
        if (k === STORAGE_KEYS.SETTINGS) {
          // v7 settings — loadSettings returns as-is (no migration), theme='light' preserved.
          return Promise.resolve({ settings: { theme: 'light', schemaVersion: 7 } });
        }
        return Promise.resolve({});
      });
      await useThemeStore.getState().init();
      expect(useThemeStore.getState().mode).toBe('light');
      // Seed persists themeMode.
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_MODE]: 'light' });
    });

    it('keeps default when both themeMode + settings.theme absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      await useThemeStore.getState().init();
      expect(useThemeStore.getState().mode).toBe(DEFAULT_THEME_MODE);
      expect(useThemeStore.getState().isLoaded).toBe(true);
    });

    it('does not seed when themeMode already set (system)', async () => {
      storageLocalGetMock.mockImplementation((keys) => {
        const k = Array.isArray(keys) ? keys[0] : keys;
        if (k === STORAGE_KEYS.THEME_MODE) return Promise.resolve({ [STORAGE_KEYS.THEME_MODE]: 'system' });
        return Promise.resolve({});
      });
      await useThemeStore.getState().init();
      expect(useThemeStore.getState().mode).toBe('system');
      // No seed write (themeMode already present).
      expect(storageLocalSetMock).not.toHaveBeenCalled();
    });
  });

  describe('switchMode', () => {
    it('updates mode + persists', () => {
      useThemeStore.getState().switchMode('system');
      expect(useThemeStore.getState().mode).toBe('system');
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_MODE]: 'system' });
    });
  });

  describe('updateColor', () => {
    it('updates 1 token for dark mode + persists config', () => {
      useThemeStore.getState().updateColor('dark', 'primary', '#ff0000');
      const state = useThemeStore.getState();
      expect(state.config.customColors.dark.primary).toBe('#ff0000');
      // Light unchanged.
      expect(state.config.customColors.light.primary).toBe(DEFAULT_THEME_CONFIG.customColors.light.primary);
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_CONFIG]: state.config });
    });

    it('updates 1 token for light mode only', () => {
      useThemeStore.getState().updateColor('light', 'background', '#eeeeee');
      expect(useThemeStore.getState().config.customColors.light.background).toBe('#eeeeee');
      expect(useThemeStore.getState().config.customColors.dark.background).toBe(DEFAULT_THEME_CONFIG.customColors.dark.background);
    });
  });

  describe('setConfig', () => {
    it('replaces whole config + persists', () => {
      const newConfig: ThemeConfig = {
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#123456' },
          dark: { ...DEFAULT_THEME_CONFIG.customColors.dark, primary: '#abcdef' },
        },
      };
      useThemeStore.getState().setConfig(newConfig);
      expect(useThemeStore.getState().config).toEqual(newConfig);
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_CONFIG]: newConfig });
    });
  });

  describe('resetTheme', () => {
    it('resets config to default + persists', () => {
      useThemeStore.getState().updateColor('dark', 'primary', '#ff0000');
      useThemeStore.getState().resetTheme();
      expect(useThemeStore.getState().config).toEqual(DEFAULT_THEME_CONFIG);
      expect(storageLocalSetMock).toHaveBeenLastCalledWith({ [STORAGE_KEYS.THEME_CONFIG]: DEFAULT_THEME_CONFIG });
    });
  });
});

export type { ThemeMode };
