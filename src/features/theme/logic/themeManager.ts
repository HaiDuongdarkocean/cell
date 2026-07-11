// themeManager — apply theme to DOM (ADR-022 D2-D3, spec F2).
//
// applyTheme set 9 core CSS vars trên :root + derive secondary qua colorGenerator.
// resolveMode: system mode → light|dark qua prefers-color-scheme.
// registerSystemModeListener: re-apply khi OS theme đổi (chỉ khi mode='system').

import { generateHoverColor, generateShade, hexToRgb, rgbToHex } from '@/features/theme/logic/colorGenerator';
import type { ThemeMode, ResolvedMode, ThemeConfig, CoreColorTokens } from '@/entities/theme';

/** Resolve 'system' mode → 'light'|'dark' qua prefers-color-scheme media query. */
export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply 9 core CSS vars + derive secondary trên :root (document.documentElement).
 * Secondary: primary-hover (shade 10%), surface-hover (shade 10%), border-focus
 * (= primary), primary-subtle (rgba 10%), border-subtle (shade surface 5%).
 */
export function applyTheme(mode: ResolvedMode, config: ThemeConfig): void {
  const colors = config.customColors[mode];
  const root = document.documentElement;
  const setVar = (name: string, value: string): void => root.style.setProperty(name, value);

  // 9 core tokens
  setVar('--color-primary', colors.primary);
  setVar('--color-background', colors.background);
  setVar('--color-surface', colors.surface);
  setVar('--color-text', colors.text);
  setVar('--color-text-secondary', colors.textSecondary);
  setVar('--color-border', colors.border);
  setVar('--color-success', colors.success);
  setVar('--color-warning', colors.warning);
  setVar('--color-error', colors.error);

  // Derived secondary tokens (ADR-022 D2 — DRY, không store)
  setVar('--color-primary-hover', generateHoverColor(colors.primary));
  setVar('--color-surface-hover', generateHoverColor(colors.surface));
  setVar('--color-primary-subtle', rgba(colors.primary, 0.1));
  setVar('--color-border-focus', colors.primary);
  setVar('--color-border-subtle', generateShade(colors.surface, 5));
  setVar('--color-text-muted', generateShade(colors.textSecondary, 20));
  setVar('--color-text-inverse', colors.background);
  setVar('--color-error-subtle', rgba(colors.error, 0.1));
  setVar('--color-warning-subtle', rgba(colors.warning, 0.1));

  // Design-system semantic tokens (Button/Card/Input/Dialog components)
  setVar('--color-secondary', colors.surface);
  setVar('--color-secondary-hover', generateHoverColor(colors.surface));
  setVar('--color-secondary-foreground', colors.text);
  setVar('--color-accent', colors.surface);
  setVar('--color-accent-foreground', colors.text);
  setVar('--color-destructive', colors.error);
  setVar('--color-destructive-hover', generateHoverColor(colors.error));
  setVar('--color-destructive-foreground', colors.background);
  setVar('--color-muted', colors.surface);
  setVar('--color-muted-foreground', generateShade(colors.textSecondary, 20));
  setVar('--color-ring', colors.primary);
  setVar('--color-input', colors.border);
  setVar('--color-card', colors.surface);
  setVar('--color-card-foreground', colors.text);
  setVar('--color-popover', colors.background);
  setVar('--color-popover-foreground', colors.text);

  // data-theme attr cho CSS [data-theme="light"]/[data-theme="dark"] selectors
  root.setAttribute('data-theme', mode);
}

/** Convert hex to rgba string. */
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Register prefers-color-scheme listener. Returns cleanup.
 * Caller re-apply khi change CHỈ KHI current mode === 'system'.
 */
export function registerSystemModeListener(onChange: (resolved: ResolvedMode) => void): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent): void => {
    onChange(e.matches ? 'dark' : 'light');
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

/** Re-export rgbToHex for potential palette tooling (avoid unused import lint). */
export { rgbToHex };

/** Get current palette for a resolved mode (helper for UI preview). */
export function getPalette(config: ThemeConfig, mode: ResolvedMode): CoreColorTokens {
  return config.customColors[mode];
}
