// themeStore — Zustand store cho theme system (ADR-022 D1).
//
// Single source of truth cho themeMode + themeConfig. Actions: init, switchMode,
// switchPreset, setConfig. Used by ThemePanel (options), SettingsDialog
// (popup shortcut), ThemeProvider (popup/options/sidepanel boot), themeTokens
// (content-script read-only qua themeStorage).

import { create } from 'zustand';
import { loadThemeMode, loadThemeConfig, saveThemeMode, saveThemeConfig, DEFAULT_THEME_MODE } from '@/features/theme/logic/themeStorage';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getPresetColors } from '@/shared/lib/tokens';
import type { ThemeMode, ThemeConfig, PresetName } from '@/entities/theme';

interface ThemeStore {
  /** Current theme mode ('light'|'dark'|'system'). Source of truth. */
  mode: ThemeMode;
  /** Current theme config (customColors palette cho light + dark). */
  config: ThemeConfig;
  /** True sau khi init() load xong từ storage. */
  isLoaded: boolean;
  /** Load mode + config từ chrome.storage. Seed legacy settings.theme nếu themeMode absent. */
  init(): Promise<void>;
  /** Switch mode (persist + notify listeners qua storage.onChanged). */
  switchMode(mode: ThemeMode): void;
  /** Switch to a named preset. */
  switchPreset(preset: PresetName): void;
  /** Replace whole config (import JSON / sync from storage). */
  setConfig(config: ThemeConfig): void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: DEFAULT_THEME_MODE,
  config: DEFAULT_THEME_CONFIG,
  isLoaded: false,

  async init() {
    try {
      let mode = await loadThemeMode();
      // Legacy fallback: nếu themeMode absent (default returned), kiểm tra settings.theme
      // (pre-port) để seed. Tránh user mất theme preference khi upgrade.
      if (mode === DEFAULT_THEME_MODE) {
        try {
          const settings = await loadSettings();
          const legacyTheme = (settings as { theme?: 'light' | 'dark' }).theme;
          if (legacyTheme === 'light' || legacyTheme === 'dark') {
            mode = legacyTheme;
            // Seed themeMode từ legacy (1 lần, sau đó themeMode là source of truth).
            await saveThemeMode(mode);
          }
        } catch {
          // settings load fail → giữ default, không block theme init.
        }
      }
      const config = await loadThemeConfig();
      set({ mode, config, isLoaded: true });
    } catch {
      // chrome.storage unavailable (e.g. page opened outside extension context).
      // Keep defaults and mark loaded so ThemeProvider still applies the theme.
      set({ isLoaded: true });
    }
  },

  switchMode(mode) {
    set({ mode });
    void saveThemeMode(mode);
  },

  switchPreset(preset) {
    const next: ThemeConfig = {
      ...get().config,
      preset,
      customColors: { ...getPresetColors(preset) },
    };
    set({ config: next });
    void saveThemeConfig(next);
  },

  setConfig(config) {
    set({ config });
    void saveThemeConfig(config);
  },
}));
