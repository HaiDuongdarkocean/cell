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

/** ID of the injected `<style>` element holding theme tokens. Exported so
 *  other modules (e.g. mountCardCreatorDialog) can clone it into fullscreen
 *  contexts where `<head>` styles don't apply. */
export const THEME_STYLE_ID = 'subtitle-theme-tokens';
const STYLE_ID = THEME_STYLE_ID;

/** Static (non-color) tokens — fonts, spacing, radius, shadows, nav-cluster.
 *  ADR-026: includes design-system tokens (--space-*, --font-size-lg/xl/2xl,
 *  --font-weight-bold, --leading-*, --tracking-*, --radius-xl/2xl, --duration-*,
 *  --ease-*, --z-*) so shared/ui components (Dialog, Button, Alert, Input,
 *  Select, Card) work in the content-script isolated world. */
const STATIC_TOKENS = `
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-2xl: 20px;
  --font-size-3xl: 24px;
  --font-size-4xl: 30px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  /* Design system --space-* scale (4px base) */
  --space-0: 0;
  --space-0-5: 2px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-3-5: 14px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
  --transition: 150ms ease;
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --duration-75: 75ms;
  --duration-150: 150ms;
  --duration-200: 200ms;
  --duration-300: 300ms;
  --duration-fast: var(--duration-150);
  --duration-normal: var(--duration-200);
  --duration-slow: var(--duration-300);
  --ease-standard: ease-in-out;
  --ease-out: ease-out;
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal: 1200;
  --z-popover: 1300;
  --z-tooltip: 1400;
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
    // ADR-026: color-scheme tells the browser to render native controls (select
    // <option> dropdown, scrollbar, date picker) in dark/light. Without this,
    // <option> elements ignore CSS variables and render with default OS colors
    // (white bg + black text) even inside a [data-theme="dark"] boundary.
    `color-scheme: ${mode};`,
    `--color-primary: ${colors.primary};`,
    `--color-primary-hover: ${generateHoverColor(colors.primary)};`,
    `--color-primary-active: ${generateShade(colors.primary, 10)};`,
    `--color-primary-subtle: ${rgba(colors.primary, 0.1)};`,
    `--color-primary-foreground: ${colors.background};`,
    `--color-background: ${colors.background};`,
    `--color-foreground: ${colors.text};`,
    `--color-surface: ${colors.surface};`,
    `--color-surface-hover: ${generateHoverColor(colors.surface)};`,
    `--color-card: ${colors.surface};`,
    `--color-card-foreground: ${colors.text};`,
    `--color-popover: ${colors.surface};`,
    `--color-popover-foreground: ${colors.text};`,
    `--color-text: ${colors.text};`,
    `--color-text-secondary: ${colors.textSecondary};`,
    `--color-text-muted: ${generateShade(colors.textSecondary, 20)};`,
    `--color-text-inverse: ${colors.background};`,
    `--color-secondary: ${colors.surface};`,
    `--color-secondary-hover: ${generateHoverColor(colors.surface)};`,
    `--color-secondary-foreground: ${colors.text};`,
    `--color-muted: ${colors.surface};`,
    `--color-muted-foreground: ${colors.textSecondary};`,
    `--color-accent: ${generateHoverColor(colors.surface)};`,
    `--color-accent-foreground: ${colors.text};`,
    `--color-destructive: ${colors.error};`,
    `--color-destructive-hover: ${generateHoverColor(colors.error)};`,
    `--color-destructive-foreground: ${colors.background};`,
    `--color-border: ${colors.border};`,
    `--color-border-subtle: ${generateShade(colors.surface, 5)};`,
    `--color-border-focus: ${colors.primary};`,
    `--color-input: ${colors.border};`,
    `--color-ring: ${colors.primary};`,
    `--color-success: ${colors.success};`,
    `--color-success-subtle: ${rgba(colors.success, mode === 'dark' ? 0.15 : 0.08)};`,
    `--color-warning: ${colors.warning};`,
    `--color-warning-subtle: ${rgba(colors.warning, mode === 'dark' ? 0.15 : 0.1)};`,
    `--color-error: ${colors.error};`,
    `--color-error-subtle: ${rgba(colors.error, mode === 'dark' ? 0.15 : 0.08)};`,
    `--color-info: ${colors.primary};`,
    `--color-info-subtle: ${rgba(colors.primary, 0.1)};`,
    `--color-scrollbar-thumb: ${mode === 'dark' ? '#475569' : '#cbd5e1'};`,
    `--color-scrollbar-thumb-hover: ${mode === 'dark' ? '#64748b' : '#94a3b8'};`,
    `--color-scrollbar-track: transparent;`,
    `--shadow-sm: none;`,
    `--shadow-md: none;`,
    `--shadow-lg: none;`,
    // === Component tokens (ADR-026: design-system §2.3) ===
    // Button
    `--button-bg: var(--color-primary);`,
    `--button-fg: var(--color-primary-foreground);`,
    `--button-hover-bg: var(--color-primary-hover);`,
    `--button-active-bg: var(--color-primary-active);`,
    `--button-padding-x: var(--space-4);`,
    `--button-padding-y: var(--space-2);`,
    `--button-radius: var(--radius-md);`,
    `--button-font-size: var(--font-size-sm);`,
    `--button-font-weight: var(--font-weight-medium);`,
    `--button-height: 32px;`,
    `--button-height-sm: 28px;`,
    `--button-height-lg: 40px;`,
    `--button-secondary-bg: var(--color-secondary);`,
    `--button-secondary-fg: var(--color-secondary-foreground);`,
    `--button-secondary-hover-bg: var(--color-secondary-hover);`,
    `--button-outline-border: var(--color-border);`,
    `--button-outline-fg: var(--color-foreground);`,
    `--button-outline-hover-bg: var(--color-accent);`,
    `--button-ghost-fg: var(--color-foreground);`,
    `--button-ghost-hover-bg: var(--color-accent);`,
    `--button-destructive-bg: var(--color-destructive);`,
    `--button-destructive-fg: var(--color-destructive-foreground);`,
    `--button-destructive-hover-bg: var(--color-destructive-hover);`,
    `--button-disabled-opacity: 0.5;`,
    `--button-focus-ring: var(--color-ring);`,
    // Input
    `--input-bg: var(--color-background);`,
    `--input-border: var(--color-input);`,
    `--input-fg: var(--color-foreground);`,
    `--input-placeholder: var(--color-muted-foreground);`,
    `--input-focus-border: var(--color-ring);`,
    `--input-focus-ring: 0 0 0 3px var(--color-primary-subtle);`,
    `--input-error-border: var(--color-error);`,
    `--input-error-fg: var(--color-error);`,
    `--input-disabled-bg: var(--color-muted);`,
    `--input-disabled-fg: var(--color-muted-foreground);`,
    `--input-padding-x: var(--space-3);`,
    `--input-padding-y: var(--space-2);`,
    `--input-radius: var(--radius-md);`,
    `--input-font-size: var(--font-size-sm);`,
    `--input-height: 32px;`,
    `--input-height-lg: 40px;`,
    // Card
    `--card-bg: var(--color-card);`,
    `--card-fg: var(--color-card-foreground);`,
    `--card-border: var(--color-border);`,
    `--card-padding: var(--space-4);`,
    `--card-padding-sm: var(--space-3);`,
    `--card-gap: var(--space-3);`,
    `--card-radius: var(--radius-lg);`,
    `--card-shadow: var(--shadow-sm);`,
    `--card-shadow-hover: var(--shadow-md);`,
    // Alert
    `--alert-bg: var(--color-background);`,
    `--alert-fg: var(--color-foreground);`,
    `--alert-border: var(--color-border);`,
    `--alert-success-bg: var(--color-success);`,
    `--alert-success-fg: var(--color-text-inverse);`,
    `--alert-warning-bg: var(--color-warning);`,
    `--alert-warning-fg: var(--color-foreground);`,
    `--alert-error-bg: var(--color-error);`,
    `--alert-error-fg: var(--color-text-inverse);`,
    `--alert-padding: var(--space-4);`,
    `--alert-radius: var(--radius-lg);`,
    // Dialog
    `--dialog-overlay-bg: rgb(0 0 0 / 0.5);`,
    `--dialog-bg: var(--color-background);`,
    `--dialog-fg: var(--color-foreground);`,
    `--dialog-border: var(--color-border);`,
    `--dialog-shadow: var(--shadow-lg);`,
    `--dialog-padding: var(--space-6);`,
    `--dialog-radius: var(--radius-lg);`,
    // ADR-026: dialog/drawer widths use px, not rem. Host pages (e.g.
    // YouTube) may set a small html font-size, which would shrink rem-based
    // widths and break the dialog layout. Static spacing tokens are already
    // in px, so using px here keeps widths consistent across sites.
    `--dialog-max-width-sm: 384px;`,
    `--dialog-max-width: 512px;`,
    `--dialog-max-width-lg: 640px;`,
    `--drawer-max-width: 384px;`,
    // Badge
    `--badge-bg: var(--color-primary);`,
    `--badge-fg: var(--color-primary-foreground);`,
    `--badge-secondary-bg: var(--color-secondary);`,
    `--badge-secondary-fg: var(--color-secondary-foreground);`,
    `--badge-outline-border: var(--color-border);`,
    `--badge-outline-fg: var(--color-foreground);`,
    `--badge-destructive-bg: var(--color-destructive);`,
    `--badge-destructive-fg: var(--color-destructive-foreground);`,
    `--badge-padding-x: var(--space-2);`,
    `--badge-padding-y: var(--space-0-5);`,
    `--badge-radius: var(--radius-full);`,
    `--badge-font-size: var(--font-size-xs);`,
    // IconButton
    `--iconbutton-bg: transparent;`,
    `--iconbutton-fg: var(--color-text-muted);`,
    `--iconbutton-hover-bg: var(--color-surface-hover);`,
    `--iconbutton-hover-fg: var(--color-text);`,
    `--iconbutton-active-bg: var(--color-primary-subtle);`,
    `--iconbutton-active-fg: var(--color-primary);`,
    `--iconbutton-danger-hover-bg: var(--color-error-subtle);`,
    `--iconbutton-danger-hover-fg: var(--color-error);`,
    `--iconbutton-size-xs: 24px;`,
    `--iconbutton-size-sm: 28px;`,
    `--iconbutton-size-md: 32px;`,
    `--iconbutton-radius: var(--radius-sm);`,
  ];
  return lines.join('\n  ');
}

/** Build the full `<style>` text content from a ThemeConfig. */
function buildStyleContent(config: ThemeConfig): string {
  const lightTokens = buildColorTokens(config.customColors.light, 'light');
  const darkTokens = buildColorTokens(config.customColors.dark, 'dark');
  // ADR-024: static tokens live on :root; color tokens only apply inside a
  // [data-theme] boundary. This prevents elements that lose their container
  // context from inheriting the light :root color tokens.
  return `
:root {
${STATIC_TOKENS}
}

[data-theme="light"] {
  ${lightTokens}
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
 * Sync the resolved `data-theme` attribute from a container to a portable
 * element. Portable content-script components (e.g. nav cluster) may be
 * re-parented to a different element, so they cannot rely solely on the
 * container's `data-theme` boundary. Uses MutationObserver to keep the
 * attribute in realtime sync.
 *
 * @param element - The component root that should carry its own data-theme
 * @param container - The source-of-truth element (usually the video wrapper)
 * @returns cleanup function to disconnect the observer
 */
export function syncElementTheme(element: HTMLElement, container: HTMLElement): () => void {
  const apply = (): void => {
    const theme = container.getAttribute('data-theme') ?? 'dark';
    element.setAttribute('data-theme', theme);
  };
  apply();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        apply();
        break;
      }
    }
  });
  observer.observe(container, { attributes: true, attributeFilter: ['data-theme'] });

  return () => observer.disconnect();
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
