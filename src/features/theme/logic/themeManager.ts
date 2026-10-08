// themeManager — apply theme to DOM (ADR-022 D2-D3, spec F2).
//
// applyTheme set 9 core CSS vars trên :root + derive secondary qua colorGenerator.
// resolveMode: system mode → light|dark qua prefers-color-scheme.
// registerSystemModeListener: re-apply khi OS theme đổi (chỉ khi mode='system').

import { getColorTokens } from '@/shared/lib/tokens';
import type { ThemeMode, ResolvedMode, ThemeConfig, CoreColorTokens } from '@/entities/theme';

/** Single-palette: every mode resolves to 'light' (dark palette removed). */
export function resolveMode(_mode: ThemeMode): ResolvedMode {
  return 'light';
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
  const resolved = resolveMode(mode);
  const tokens = getColorTokens(config.customColors[resolved], resolved, config.preset);

  for (const [name, value] of Object.entries(tokens)) {
    target.style.setProperty(name, value);
  }

  target.setAttribute('data-theme', resolved);
  target.setAttribute('data-preset', config.preset ?? 'dawn');
}

/**
 * Register prefers-color-scheme listener. Returns cleanup.
 * Caller re-apply khi change CHỈ KHI current mode === 'system'.
 */
export function registerSystemModeListener(onChange: (resolved: ResolvedMode) => void): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => {
    onChange(resolveMode('system'));
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

/** Get current palette for a resolved mode (helper for UI preview). */
export function getPalette(config: ThemeConfig, mode: ResolvedMode): CoreColorTokens {
  return config.customColors[resolveMode(mode)];
}
