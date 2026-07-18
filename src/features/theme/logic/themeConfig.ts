// Theme config defaults (ADR-022 D2) — 9 core tokens per mode.
//
// Palette mirrors current LIGHT_TOKENS/DARK_TOKENS trong themeTokens.ts (pre-port).
// Sau port, themeTokens.ts đọc từ themeConfig.customColors[resolvedMode] thay vì
// hardcoded strings — DEFAULT_THEME_CONFIG là fallback khi storage absent.

import type { ThemeConfig } from '@/entities/theme';
import {
  DEFAULT_LIGHT_COLORS,
  DEFAULT_DARK_COLORS,
} from '@/shared/lib/tokens';

export { DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS };

/** Default theme config — used when chrome.storage.local.themeConfig absent. */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  customColors: {
    light: { ...DEFAULT_LIGHT_COLORS },
    dark: { ...DEFAULT_DARK_COLORS },
  },
};
