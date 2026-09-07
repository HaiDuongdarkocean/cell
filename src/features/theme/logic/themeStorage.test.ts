import {
  loadThemeMode,
  loadThemeConfig,
  saveThemeMode,
  saveThemeConfig,
  DEFAULT_THEME_MODE,
} from '@/features/theme/logic/themeStorage';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeConfig, CoreColorTokens } from '@/entities/theme';

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
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('themeStorage', () => {
  describe('loadThemeMode', () => {
    it('returns stored mode when valid', async () => {
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_MODE]: 'light' });
      await expect(loadThemeMode()).resolves.toBe('light');
    });
    it('returns "system" when stored', async () => {
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_MODE]: 'system' });
      await expect(loadThemeMode()).resolves.toBe('system');
    });
    it('returns DEFAULT_THEME_MODE (dark) when absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      await expect(loadThemeMode()).resolves.toBe(DEFAULT_THEME_MODE);
      expect(DEFAULT_THEME_MODE).toBe('dark');
    });
    it('returns default when stored value invalid', async () => {
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_MODE]: 'blue' });
      await expect(loadThemeMode()).resolves.toBe(DEFAULT_THEME_MODE);
    });
    it('returns default when stored value wrong type', async () => {
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_MODE]: 123 });
      await expect(loadThemeMode()).resolves.toBe(DEFAULT_THEME_MODE);
    });
  });

  describe('loadThemeConfig', () => {
    it('returns stored config when valid', async () => {
      const config: ThemeConfig = {
        preset: 'dawn',
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
          dark: DEFAULT_THEME_CONFIG.customColors.dark,
        },
      };
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_CONFIG]: config });
      const result = await loadThemeConfig();
      expect(result.customColors.light.primary).toBe('#ff0000');
    });
    it('returns DEFAULT_THEME_CONFIG when absent', async () => {
      storageLocalGetMock.mockResolvedValue({});
      await expect(loadThemeConfig()).resolves.toEqual(DEFAULT_THEME_CONFIG);
    });
    it('returns default when config missing customColors', async () => {
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_CONFIG]: { foo: 'bar' } });
      await expect(loadThemeConfig()).resolves.toEqual(DEFAULT_THEME_CONFIG);
    });
    it('returns default when customColors missing light', async () => {
      storageLocalGetMock.mockResolvedValue({
        [STORAGE_KEYS.THEME_CONFIG]: { customColors: { dark: DEFAULT_THEME_CONFIG.customColors.dark } },
      });
      await expect(loadThemeConfig()).resolves.toEqual(DEFAULT_THEME_CONFIG);
    });
    it('defaults missing preset to dawn while preserving customColors', async () => {
      const config = {
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
          dark: DEFAULT_THEME_CONFIG.customColors.dark,
        },
      };
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_CONFIG]: config });
      const result = await loadThemeConfig();
      expect(result.preset).toBe('dawn');
      expect(result.customColors.light.primary).toBe('#ff0000');
    });
    it('defaults invalid preset to dawn while preserving customColors', async () => {
      const config = {
        preset: 'custom',
        customColors: {
          light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
          dark: DEFAULT_THEME_CONFIG.customColors.dark,
        },
      };
      storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.THEME_CONFIG]: config });
      const result = await loadThemeConfig();
      expect(result.preset).toBe('dawn');
      expect(result.customColors.light.primary).toBe('#ff0000');
    });
  });

  describe('saveThemeMode', () => {
    it('persists mode to storage', async () => {
      await saveThemeMode('system');
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_MODE]: 'system' });
    });
  });

  describe('saveThemeConfig', () => {
    it('persists config to storage', async () => {
      const config: ThemeConfig = DEFAULT_THEME_CONFIG;
      await saveThemeConfig(config);
      expect(storageLocalSetMock).toHaveBeenCalledWith({ [STORAGE_KEYS.THEME_CONFIG]: config });
    });
  });
});

// Re-export for type-checking the unused-import lint guard (no runtime use).
export type { CoreColorTokens };
