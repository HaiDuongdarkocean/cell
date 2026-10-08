// Theme config defaults (ADR-022 D2) — 9 core tokens (single light palette).
//
// DEFAULT_THEME_CONFIG là fallback khi chrome.storage.local.themeConfig absent.

import type { ThemeConfig } from '@/entities/theme';
import tokensJson from '@/shared/styles/tokens.json';
import { DEFAULT_LIGHT_COLORS } from '@/shared/lib/tokens';

export { DEFAULT_LIGHT_COLORS };

/** Default theme config — Dawn preset, used when chrome.storage.local.themeConfig absent. */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: 'dawn',
  customColors: {
    light: { ...tokensJson.presets.dawn.core.light },
  },
};
