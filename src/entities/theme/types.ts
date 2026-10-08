// Theme entity types (ADR-022)
//
// Runtime-customizable theme system. Storage tách riêng (themeMode + themeConfig)
// khỏi settings — theme có lifecycle riêng (mode/preset switch + config sync).

/** Theme mode — source of truth ở chrome.storage.local.themeMode (riêng, không trong settings).
 *  Single-palette: every value renders the light palette (dark palette removed). */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Named color preset (liquid-glass design system). */
export type PresetName = 'dawn' | 'forest' | 'ocean' | 'warmth';

/**
 * 9 core color tokens (user-editable, runtime customizable — ADR-022 D2).
 * Secondary tokens (hover/subtle/border-focus) DERIVED qua colorGenerator, không store.
 */
export interface CoreColorTokens {
  readonly primary: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly border: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
}

/**
 * Theme config — palette data + named preset. KHÔNG chứa `mode`
 * (mode là source of truth ở `themeMode` riêng — ADR-022 D1, Risk #8 fix).
 * Single-palette: only the light palette is customizable (dark removed).
 * Import/export JSON thuần.
 */
export interface ThemeConfig {
  readonly preset: PresetName;
  readonly customColors: {
    readonly light: CoreColorTokens;
  };
}


