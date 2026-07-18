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
import {
  buildColorTokenCSS,
  formatComponentTokens,
  formatStaticTokens,
} from '@/shared/lib/tokens';
import { NAV_CLUSTER_CSS } from '@/features/subtitle/ui/navClusterCss';
import type { ThemeMode, ThemeConfig, ResolvedMode } from '@/entities/theme';

/** ID of the injected `<style>` element holding theme tokens. Exported so
 *  other modules (e.g. mountCardCreatorDialog) can clone it into fullscreen
 *  contexts where `<head>` styles don't apply. */
export const THEME_STYLE_ID = 'subtitle-theme-tokens';
const STYLE_ID = THEME_STYLE_ID;


/** Build the full `<style>` text content from a ThemeConfig.
 *  Static + component tokens live on :root; color tokens only apply inside a
 *  [data-theme] boundary. Component tokens reference color vars, so they
 *  resolve to the nearest [data-theme] ancestor at usage time. */
function buildStyleContent(config: ThemeConfig): string {
  const staticTokens = formatStaticTokens();
  const componentTokens = formatComponentTokens();
  const lightTokens = buildColorTokenCSS(config.customColors.light, 'light');
  const darkTokens = buildColorTokenCSS(config.customColors.dark, 'dark');
  return `
:root {
${staticTokens}
${componentTokens}
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
export { buildStyleContent };
