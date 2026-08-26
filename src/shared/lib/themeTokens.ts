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
import navClusterModuleCss from '@/features/subtitle/ui/NavCluster.module.css?inline';
import type { ThemeMode, ThemeConfig, ResolvedMode } from '@/entities/theme';

/** ID of the injected `<style>` element holding theme tokens. Exported so
 *  other modules (e.g. mountCardCreatorDialog) can clone it into fullscreen
 *  contexts where `<head>` styles don't apply. */
export const THEME_STYLE_ID = 'subtitle-theme-tokens';
const STYLE_ID = THEME_STYLE_ID;


/** Build the full `<style>` text content from a ThemeConfig.
 *  Static tokens live on :root. Color + component tokens apply inside a
 *  [data-theme] or [data-preset][data-theme] boundary. Component tokens
 *  reference color vars, and CSS custom properties resolve where they are
 *  DECLARED, not where they are used, so the component block must be
 *  re-declared in each theme selector to re-resolve against the theme's core
 *  colors (critical for Shadow DOM). */
function buildStyleContent(config: ThemeConfig): string {
  const staticTokens = formatStaticTokens();
  const componentTokens = formatComponentTokens();
  const preset = config.preset;
  const lightTokens = buildColorTokenCSS(config.customColors.light, 'light', preset);
  const darkTokens = buildColorTokenCSS(config.customColors.dark, 'dark', preset);
  const selectorPrefix = preset ? `[data-preset="${preset}"]` : '';
  return `
:root {
${staticTokens}
}

/* Semantic touch target — adapts to primary pointer type.
   Mirrors scripts/generate-tokens.js output for tokens.css; the flat
   tokens.json model cannot express @media aliases, so inject here. */
:root { --touch-target: var(--touch-target-desktop); }
@media (pointer: coarse) {
  :root { --touch-target: var(--touch-target-mobile); }
}

${selectorPrefix}[data-theme="light"] {
${lightTokens}
${componentTokens}
}

${selectorPrefix}[data-theme="dark"] {
${darkTokens}
${componentTokens}
}

@keyframes subtitle-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(var(--space-2)); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .subtitle-toast { animation: none; }
}

/* Drag-drop hint overlay — full-cover video, visible only while dragging.
   pointer-events:none so it never blocks video controls or the container's
   drop listener. z-index above subtitle shadow host (z:200) so the hint
   reads on top. */
.subtitle-drag-hint {
  position: absolute;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background-color: var(--color-overlay-backdrop);
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  border: 2px dashed var(--subtitle-drag-hint, var(--color-info));
  border-radius: var(--radius-card);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}
.subtitle-drag-hint--visible {
  opacity: 1;
}

${navClusterModuleCss}
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
    const preset = container.getAttribute('data-preset') ?? '';
    element.setAttribute('data-theme', theme);
    if (preset) {
      element.setAttribute('data-preset', preset);
    } else {
      element.removeAttribute('data-preset');
    }
  };
  apply();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && (mutation.attributeName === 'data-theme' || mutation.attributeName === 'data-preset')) {
        apply();
        break;
      }
    }
  });
  observer.observe(container, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });

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
    if (config.preset) {
      container.setAttribute('data-preset', config.preset);
    } else {
      container.removeAttribute('data-preset');
    }
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
