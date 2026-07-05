/**
 * Inject design-system theme tokens into a container (ADR-015 T12, ADR-022 D3).
 *
 * Content-script isolated world — cannot access popup stylesheets. Injects a
 * `<style>` block with theme tokens (light + dark) into document.head, sets
 * `data-theme` on the video container.
 *
 * ADR-022 port: tokens now generated from chrome.storage.local.themeConfig
 * (customColors palette) instead of hardcoded strings. Falls back to
 * DEFAULT_THEME_CONFIG when storage absent. Listens to storage.onChanged for
 * realtime theme switching (themeMode + themeConfig keys).
 *
 * Static tokens (fonts, spacing, radius, shadows, nav-cluster) stay constant —
 * only color tokens are user-customizable.
 */

import { onStorageChanged, removeOnStorageChangedListener, getStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { DEFAULT_THEME_MODE } from '@/features/theme/logic/themeStorage';
import { generateHoverColor, generateShade, hexToRgb } from '@/features/theme/logic/colorGenerator';
import { NAV_CLUSTER_CSS } from '@/features/subtitle/ui/navClusterCss';
import type { ThemeMode, ThemeConfig, ResolvedMode, CoreColorTokens } from '@/entities/theme';

const STYLE_ID = 'subtitle-theme-tokens';

/** Static (non-color) tokens — fonts, spacing, radius, shadows, nav-cluster. */
const STATIC_TOKENS = `
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  --transition: 150ms ease;
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --ease-standard: ease;
  --nav-cluster-size-sm: 32px;
  --nav-cluster-size-md: 32px;
  --nav-cluster-size-lg: 32px;
  --nav-cluster-bg-opacity-default: 0.7;
  --nav-cluster-btn-opacity-default: 0.9;
  --nav-cluster-collapse-size: 32px;
  --nav-cluster-edge-threshold: 20px;
  --nav-cluster-z-index: 1000001;
  --nav-cluster-repeat-hold-ms: 500;
  --nav-cluster-no-sub-window-ms: 3000;
`;

/** Build color token CSS string for one mode (9 core + derived). */
function buildColorTokens(colors: CoreColorTokens, mode: ResolvedMode): string {
  const rgba = (hex: string, alpha: number): string => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const lines: string[] = [
    `--color-primary: ${colors.primary};`,
    `--color-primary-hover: ${generateHoverColor(colors.primary)};`,
    `--color-primary-subtle: ${rgba(colors.primary, 0.1)};`,
    `--color-background: ${colors.background};`,
    `--color-surface: ${colors.surface};`,
    `--color-surface-hover: ${generateHoverColor(colors.surface)};`,
    `--color-text: ${colors.text};`,
    `--color-text-secondary: ${colors.textSecondary};`,
    `--color-text-muted: ${generateShade(colors.textSecondary, 20)};`,
    `--color-text-inverse: ${colors.background};`,
    `--color-border: ${colors.border};`,
    `--color-border-subtle: ${generateShade(colors.surface, 5)};`,
    `--color-border-focus: ${colors.primary};`,
    `--color-success: ${colors.success};`,
    `--color-warning: ${colors.warning};`,
    `--color-error: ${colors.error};`,
    `--color-info: ${colors.primary};`,
    `--color-error-subtle: ${rgba(colors.error, mode === 'dark' ? 0.15 : 0.08)};`,
    `--color-warning-subtle: ${rgba(colors.warning, mode === 'dark' ? 0.15 : 0.1)};`,
    `--color-scrollbar-thumb: ${mode === 'dark' ? '#475569' : '#cbd5e1'};`,
    `--color-scrollbar-thumb-hover: ${mode === 'dark' ? '#64748b' : '#94a3b8'};`,
    `--color-scrollbar-track: transparent;`,
    `--shadow-sm: 0 1px 2px rgba(0, 0, 0, ${mode === 'dark' ? 0.3 : 0.05});`,
    `--shadow-md: 0 4px 12px rgba(0, 0, 0, ${mode === 'dark' ? 0.4 : 0.08});`,
  ];
  return lines.join('\n  ');
}

/** Build the full `<style>` text content from a ThemeConfig. */
function buildStyleContent(config: ThemeConfig): string {
  const lightTokens = buildColorTokens(config.customColors.light, 'light');
  const darkTokens = buildColorTokens(config.customColors.dark, 'dark');
  return `
[data-theme="light"], :root {
  ${lightTokens}
${STATIC_TOKENS}
}
[data-theme="dark"] {
  ${darkTokens}
}

@keyframes subtitle-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

${NAV_CLUSTER_CSS}
`;
}

/** Resolve 'system' mode → 'light'|'dark' via prefers-color-scheme. */
function resolveSystemMode(): ResolvedMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): ResolvedMode {
  return mode === 'system' ? resolveSystemMode() : mode;
}

/**
 * Inject theme tokens `<style>` into document.head + set initial `data-theme`
 * on container. Returns a cleanup function that removes the style + storage listener.
 *
 * @param container - Video wrapper (panel/chip/toast parent)
 * @returns cleanup function
 */
export function injectThemeTokens(container: HTMLElement): () => void {
  // Inject <style> once (idempotent — skip if already present)
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildStyleContent(DEFAULT_THEME_CONFIG);
    document.head.appendChild(style);
  }

  // Set initial theme synchronously to default 'dark' to avoid FOUC.
  container.setAttribute('data-theme', 'dark');

  // Load mode + config from storage, then apply.
  let currentMode: ThemeMode = DEFAULT_THEME_MODE;
  let currentConfig: ThemeConfig = DEFAULT_THEME_CONFIG;

  const applyResolved = (mode: ThemeMode, config: ThemeConfig): void => {
    const resolved = resolveMode(mode);
    container.setAttribute('data-theme', resolved);
    // Re-inject <style> with custom palette (if config != default).
    const style = document.getElementById(STYLE_ID);
    if (style) style.textContent = buildStyleContent(config);
  };

  // Load themeMode + themeConfig from storage.
  Promise.all([
    getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE),
    getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_CONFIG),
  ]).then(([modeData, configData]) => {
    const storedMode = modeData[STORAGE_KEYS.THEME_MODE];
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
      currentMode = storedMode;
    }
    const storedConfig = configData[STORAGE_KEYS.THEME_CONFIG] as ThemeConfig | undefined;
    if (storedConfig?.customColors?.light && storedConfig?.customColors?.dark) {
      currentConfig = storedConfig;
    }
    applyResolved(currentMode, currentConfig);
  }).catch(() => {
    applyResolved(currentMode, currentConfig);
  });

  // Listen for theme changes (realtime) — themeMode + themeConfig keys.
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    let changed = false;
    if (changes[STORAGE_KEYS.THEME_MODE]?.newValue) {
      const newMode = changes[STORAGE_KEYS.THEME_MODE].newValue;
      if (newMode === 'light' || newMode === 'dark' || newMode === 'system') {
        currentMode = newMode;
        changed = true;
      }
    }
    if (changes[STORAGE_KEYS.THEME_CONFIG]?.newValue) {
      const newConfig = changes[STORAGE_KEYS.THEME_CONFIG].newValue as ThemeConfig | undefined;
      if (newConfig?.customColors?.light && newConfig?.customColors?.dark) {
        currentConfig = newConfig;
        changed = true;
      }
    }
    if (changed) applyResolved(currentMode, currentConfig);
  };
  onStorageChanged(onChanged);

  // Cleanup
  return () => {
    removeOnStorageChangedListener(onChanged);
  };
}

// Export for testing.
export { buildStyleContent, buildColorTokens };
