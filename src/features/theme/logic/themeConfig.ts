// Theme config defaults (ADR-022 D2) — 9 core tokens per mode.
//
// Palette mirrors current LIGHT_TOKENS/DARK_TOKENS trong themeTokens.ts (pre-port).
// Sau port, themeTokens.ts đọc từ themeConfig.customColors[resolvedMode] thay vì
// hardcoded strings — DEFAULT_THEME_CONFIG là fallback khi storage absent.

import type { ThemeConfig } from '@/entities/theme';

/** Default light palette (mirrors pre-port LIGHT_TOKENS 9 core tokens). */
export const DEFAULT_LIGHT_COLORS = {
  primary: '#2563eb',
  background: '#ffffff',
  surface: '#f8fafc',
  text: '#0f172a',
  textSecondary: '#475569',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

/** Default dark palette (mirrors pre-port DARK_TOKENS 9 core tokens). */
export const DEFAULT_DARK_COLORS = {
  primary: '#60a5fa',
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  border: '#334155',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

/** Default theme config — used when chrome.storage.local.themeConfig absent. */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  customColors: {
    light: { ...DEFAULT_LIGHT_COLORS },
    dark: { ...DEFAULT_DARK_COLORS },
  },
};
