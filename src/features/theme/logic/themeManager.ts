// themeManager — apply theme to DOM (ADR-022 D2-D3, spec F2).
//
// applyTheme set 9 core CSS vars trên :root + derive secondary qua colorGenerator.
// resolveMode: system mode → light|dark qua prefers-color-scheme.
// registerSystemModeListener: re-apply khi OS theme đổi (chỉ khi mode='system').

import { getColorTokens } from '@/shared/lib/tokens';
import type { ThemeMode, ResolvedMode, ThemeConfig, CoreColorTokens } from '@/entities/theme';

/** Resolve 'system' mode → 'light'|'dark' qua prefers-color-scheme media query. */
export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply all color tokens (core + derived) onto the target element and set data-theme/data-preset.
 * Uses precomputed default tokens when the palette matches tokens.json, else
 * derives them at runtime. Component tokens in tokens.css resolve these vars.
 */
export function applyTheme(
  mode: ResolvedMode,
  config: ThemeConfig,
  target: HTMLElement = document.documentElement,
): void {
  const tokens = getColorTokens(config.customColors[mode], mode, config.preset);

  for (const [name, value] of Object.entries(tokens)) {
    target.style.setProperty(name, value);
  }

  target.setAttribute('data-theme', mode);
  target.setAttribute('data-preset', config.preset ?? '');
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

/** Get current palette for a resolved mode (helper for UI preview). */
export function getPalette(config: ThemeConfig, mode: ResolvedMode): CoreColorTokens {
  return config.customColors[mode];
}
