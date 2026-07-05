// Theme entity types (ADR-022)
//
// Runtime-customizable theme system. Storage tách riêng (themeMode + themeConfig)
// khỏi settings — theme có lifecycle riêng (change thường xuyên, import/export, reset).

/** Theme mode — source of truth ở chrome.storage.local.themeMode (riêng, không trong settings). */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Resolved mode — system mode resolve về light|dark qua prefers-color-scheme. */
export type ResolvedMode = 'light' | 'dark';

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
 * Theme config — palette data cho 2 mode. KHÔNG chứa `mode` (mode là source of
 * truth ở `themeMode` riêng — ADR-022 D1, Risk #8 fix). Import/export JSON thuần.
 */
export interface ThemeConfig {
  readonly customColors: {
    readonly light: CoreColorTokens;
    readonly dark: CoreColorTokens;
  };
}

/** Key of a core color token (for updateColor action typing). */
export type CoreColorTokenKey = keyof CoreColorTokens;
