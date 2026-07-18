import { injectThemeTokens, buildStyleContent, syncElementTheme } from '@/shared/lib/themeTokens';
import { buildColorTokenCSS } from '@/shared/lib/tokens';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeConfig } from '@/entities/theme';

// Mock chrome.storage.local
const storageData: Record<string, unknown> = {};
const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

beforeAll(() => {
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn((_key: string) => Promise.resolve(storageData)),
    set: jest.fn((obj: Record<string, unknown>) => { Object.assign(storageData, obj); return Promise.resolve(); }),
  };
  c.storage.onChanged = {
    addListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => { storageListeners.push(cb); }),
    removeListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
      const idx = storageListeners.indexOf(cb);
      if (idx >= 0) storageListeners.splice(idx, 1);
    }),
  };
  // matchMedia mock (jsdom)
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  for (const k of Object.keys(storageData)) delete storageData[k];
  document.head.innerHTML = '';
  storageListeners.length = 0;
});

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('injectThemeTokens (ADR-015 T12, ADR-022 D3)', () => {
  it('injects <style> with theme tokens into document.head', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    const style = document.getElementById('subtitle-theme-tokens');
    expect(style).toBeTruthy();
    expect(style?.tagName).toBe('STYLE');
    expect(style?.textContent).toContain('--color-primary');
    expect(style?.textContent).toContain('--color-background');
  });

  it('is idempotent — does not inject duplicate <style>', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    injectThemeTokens(container);
    const styles = document.querySelectorAll('#subtitle-theme-tokens');
    expect(styles.length).toBe(1);
  });

  it('sets data-theme="dark" by default synchronously and after load', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    expect(container.getAttribute('data-theme')).toBe('dark');
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme="light" when themeMode = light', async () => {
    storageData[STORAGE_KEYS.THEME_MODE] = 'light';
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme="dark" when themeMode = dark', async () => {
    storageData[STORAGE_KEYS.THEME_MODE] = 'dark';
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system mode via prefers-color-scheme (light)', async () => {
    storageData[STORAGE_KEYS.THEME_MODE] = 'system';
    (window.matchMedia as unknown as jest.Mock).mockReturnValue({ matches: false });
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('light');
  });

  it('resolves system mode via prefers-color-scheme (dark)', async () => {
    storageData[STORAGE_KEYS.THEME_MODE] = 'system';
    (window.matchMedia as unknown as jest.Mock).mockReturnValue({ matches: true });
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('responds to chrome.storage.onChanged for themeMode', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    expect(container.getAttribute('data-theme')).toBe('dark');
    for (const listener of storageListeners) {
      listener({ [STORAGE_KEYS.THEME_MODE]: { newValue: 'light' } }, 'local');
    }
    expect(container.getAttribute('data-theme')).toBe('light');
    for (const listener of storageListeners) {
      listener({ [STORAGE_KEYS.THEME_MODE]: { newValue: 'dark' } }, 'local');
    }
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('responds to chrome.storage.onChanged for themeConfig (re-injects style)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    const customConfig: ThemeConfig = {
      customColors: {
        light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#ff0000' },
        dark: { ...DEFAULT_THEME_CONFIG.customColors.dark, primary: '#00ff00' },
      },
    };
    for (const listener of storageListeners) {
      listener({ [STORAGE_KEYS.THEME_CONFIG]: { newValue: customConfig } }, 'local');
    }
    const style = document.getElementById('subtitle-theme-tokens');
    expect(style?.textContent).toContain('#ff0000'); // custom light primary
    expect(style?.textContent).toContain('#00ff00'); // custom dark primary
  });

  it('cleanup removes storage listener', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const cleanup = injectThemeTokens(container);
    const beforeCount = storageListeners.length;
    cleanup();
    expect(storageListeners.length).toBe(beforeCount - 1);
  });

  it('style contains both light + dark token blocks with default palette', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    const style = document.getElementById('subtitle-theme-tokens');
    expect(style?.textContent).toContain('[data-theme="dark"]');
    expect(style?.textContent).toContain('#2563eb'); // default light primary
    expect(style?.textContent).toContain('#60a5fa'); // default dark primary
  });

  it('applies custom themeConfig from storage on load', async () => {
    const customConfig: ThemeConfig = {
      customColors: {
        light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: '#abcdef' },
        dark: DEFAULT_THEME_CONFIG.customColors.dark,
      },
    };
    storageData[STORAGE_KEYS.THEME_CONFIG] = customConfig;
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await flushMicrotasks();
    const style = document.getElementById('subtitle-theme-tokens');
    expect(style?.textContent).toContain('#abcdef');
  });
});

describe('buildStyleContent', () => {
  it('returns CSS string with light + dark blocks', () => {
    const css = buildStyleContent(DEFAULT_THEME_CONFIG);
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('--color-primary');
  });

  it('includes static tokens (fonts, spacing)', () => {
    const css = buildStyleContent(DEFAULT_THEME_CONFIG);
    expect(css).toContain('--font-family');
    expect(css).toContain('--space-3');
    expect(css).toContain('--radius-md');
  });

  it('includes nav-cluster CSS', () => {
    const css = buildStyleContent(DEFAULT_THEME_CONFIG);
    expect(css).toContain('nav-cluster');
  });
});

describe('buildColorTokenCSS', () => {
  it('returns 9 core + derived token lines', () => {
    const css = buildColorTokenCSS(DEFAULT_THEME_CONFIG.customColors.dark, 'dark');
    expect(css).toContain('--color-primary:');
    expect(css).toContain('--color-primary-hover:');
    expect(css).toContain('--color-primary-subtle:');
    expect(css).toContain('--color-background:');
    expect(css).toContain('--color-surface:');
    expect(css).toContain('--color-text:');
    expect(css).toContain('--color-border:');
    expect(css).toContain('--color-success:');
    expect(css).toContain('--color-error:');
  });

  it('uses custom primary color', () => {
    const custom = { ...DEFAULT_THEME_CONFIG.customColors.dark, primary: '#ff0000' };
    const css = buildColorTokenCSS(custom, 'dark');
    expect(css).toContain('--color-primary: #ff0000;');
  });
});

describe('syncElementTheme (ADR-024)', () => {
  it('sets element data-theme to match container', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    container.setAttribute('data-theme', 'light');
    syncElementTheme(element, container);
    expect(element.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to dark when container has no data-theme', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    syncElementTheme(element, container);
    expect(element.getAttribute('data-theme')).toBe('dark');
  });

  it('updates element when container data-theme changes', async () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    container.setAttribute('data-theme', 'dark');
    syncElementTheme(element, container);
    expect(element.getAttribute('data-theme')).toBe('dark');

    container.setAttribute('data-theme', 'light');
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(element.getAttribute('data-theme')).toBe('light');
  });

  it('cleanup stops updates', async () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    const cleanup = syncElementTheme(element, container);
    expect(element.getAttribute('data-theme')).toBe('dark');

    cleanup();
    container.setAttribute('data-theme', 'light');
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(element.getAttribute('data-theme')).toBe('dark');
  });
});
