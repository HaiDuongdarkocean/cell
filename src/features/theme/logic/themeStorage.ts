// themeStorage — chrome.storage.local CRUD cho themeMode + themeConfig (ADR-022 D1).
//
// Storage tách riêng khỏi settings — theme có lifecycle riêng (change thường xuyên,
// import/export, reset). themeMode là source of truth cho mode, themeConfig chỉ là
// palette data (KHÔNG chứa mode).

import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import type { ThemeMode, ThemeConfig, PresetName } from '@/entities/theme';

/** Default theme mode khi storage absent (V5 default dark — giữ pre-port default). */
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

const PRESETS: readonly PresetName[] = ['dawn', 'forest', 'ocean', 'warmth'];

/**
 * Load themeMode from chrome.storage.local. Returns DEFAULT_THEME_MODE nếu absent.
 *
 * Legacy fallback: nếu themeMode absent NHƯNG settings.theme (pre-port) tồn tại,
 * caller (themeStore.init) seed themeMode từ settings.theme. Không làm ở đây
 * (themeStorage không nên đọc settings key).
 */
export async function loadThemeMode(): Promise<ThemeMode> {
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
  const mode = data[STORAGE_KEYS.THEME_MODE];
  if (mode === 'light' || mode === 'dark' || mode === 'system') return mode;
  return DEFAULT_THEME_MODE;
}

/** Load themeConfig from chrome.storage.local. Returns DEFAULT_THEME_CONFIG nếu absent. */
export async function loadThemeConfig(): Promise<ThemeConfig> {
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_CONFIG);
  const config = data[STORAGE_KEYS.THEME_CONFIG] as ThemeConfig | undefined;
  if (config && config.customColors && config.customColors.light && config.customColors.dark) {
    const storedPreset = (config as { preset?: unknown }).preset;
    const preset = PRESETS.includes(storedPreset as PresetName) ? (storedPreset as PresetName) : 'dawn';
    return { ...config, preset };
  }
  return DEFAULT_THEME_CONFIG;
}

/** Persist themeMode to chrome.storage.local. */
export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await setStorage({ [STORAGE_KEYS.THEME_MODE]: mode });
}

/** Persist themeConfig to chrome.storage.local. */
export async function saveThemeConfig(config: ThemeConfig): Promise<void> {
  await setStorage({ [STORAGE_KEYS.THEME_CONFIG]: config });
}
