/**
 * Inject design-system theme tokens into a container (ADR-015 T12).
 *
 * The popup has `theme.css` bundled via Vite, but content-scripts run in an
 * isolated world that cannot access popup stylesheets. The Subtitle Manager
 * Panel + chip + toast use `var(--color-*)` tokens, so we inject a `<style>`
 * block with the same tokens (light + dark) into the video container.
 *
 * Toggle: reads `chrome.storage.local.settings.theme` → sets `data-theme`
 * attribute on container. Listens to `chrome.storage.onChanged` for realtime
 * theme switching.
 *
 * ponytail ceiling: extract `tokens.css` as a shared asset V3 (build-time
 * import in both popup + content-script). V2 inlines the tokens here to avoid
 * a new build pipeline.
 */

// Token definitions — mirrors src/popup/styles/theme.css (keep in sync).
const LIGHT_TOKENS = `
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-subtle: rgba(37, 99, 235, 0.1);
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-hover: #f1f5f9;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-text-inverse: #ffffff;
  --color-border: #e2e8f0;
  --color-border-subtle: #f1f5f9;
  --color-border-focus: #2563eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #2563eb;
  --color-scrollbar-thumb: #cbd5e1;
  --color-scrollbar-thumb-hover: #94a3b8;
  --color-scrollbar-track: transparent;
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
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --transition: 150ms ease;
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --ease-standard: ease;
`;

const DARK_TOKENS = `
  --color-primary: #60a5fa;
  --color-primary-hover: #3b82f6;
  --color-primary-subtle: rgba(96, 165, 250, 0.15);
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-surface-hover: #334155;
  --color-text: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #64748b;
  --color-text-inverse: #0f172a;
  --color-border: #334155;
  --color-border-subtle: #1e293b;
  --color-border-focus: #60a5fa;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #60a5fa;
  --color-scrollbar-thumb: #475569;
  --color-scrollbar-thumb-hover: #64748b;
  --color-scrollbar-track: transparent;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
`;

const STYLE_ID = 'subtitle-theme-tokens';

/**
 * Inject theme tokens `<style>` into container + set initial `data-theme`.
 * Returns a cleanup function that removes the style + storage listener.
 *
 * @param container - Video wrapper (panel/chip/toast parent)
 * @returns cleanup function
 */
export function injectThemeTokens(container: HTMLElement): () => void {
  // Inject <style> once (idempotent — skip if already present)
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
[data-theme-Host="light"], [data-theme="light"] {
${LIGHT_TOKENS}
}
[data-theme="dark"] {
${DARK_TOKENS}
}
`;
    document.head.appendChild(style);
  }

  // Set initial theme from storage
  const applyTheme = (theme: 'light' | 'dark'): void => {
    container.setAttribute('data-theme', theme);
  };

  chrome.storage.local.get('settings').then((result) => {
    const settings = result.settings as { theme?: 'light' | 'dark' } | undefined;
    applyTheme(settings?.theme ?? 'light');
  }).catch(() => {
    applyTheme('light');
  });

  // Listen for theme changes (realtime)
  const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string): void => {
    if (area !== 'local') return;
    const newSettings = changes.settings?.newValue as { theme?: 'light' | 'dark' } | undefined;
    if (newSettings?.theme) {
      applyTheme(newSettings.theme);
    }
  };
  chrome.storage.onChanged.addListener(onChanged);

  // Cleanup
  return () => {
    chrome.storage.onChanged.removeListener(onChanged);
  };
}
