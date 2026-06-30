import { injectThemeTokens } from '../../../src/content/themeTokens';

// Mock chrome.storage.local
const storageData: { settings?: { theme?: 'light' | 'dark' } } = {};
const storageListeners: Array<(changes: any, area: string) => void> = [];

beforeAll(() => {
  (global as any).chrome = (global as any).chrome ?? {};
  (global as any).chrome.storage = (global as any).chrome.storage ?? {};
  (global as any).chrome.storage.local = {
    get: jest.fn((_key: string) => Promise.resolve(storageData)),
    set: jest.fn((obj: any) => { Object.assign(storageData, obj); return Promise.resolve(); }),
  };
  (global as any).chrome.storage.onChanged = {
    addListener: jest.fn((cb: (changes: any, area: string) => void) => { storageListeners.push(cb); }),
    removeListener: jest.fn((cb: (changes: any, area: string) => void) => {
      const idx = storageListeners.indexOf(cb);
      if (idx >= 0) storageListeners.splice(idx, 1);
    }),
  };
});

beforeEach(() => {
  delete storageData.settings;
  document.head.innerHTML = '';
  storageListeners.length = 0;
});

describe('injectThemeTokens (ADR-015 T12)', () => {
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

  it('sets data-theme="light" by default when no settings', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await Promise.resolve();
    expect(container.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme="dark" when settings.theme = dark', async () => {
    storageData.settings = { theme: 'dark' };
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await Promise.resolve();
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('responds to chrome.storage.onChanged for theme', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    await Promise.resolve();
    expect(container.getAttribute('data-theme')).toBe('light');
    // Simulate storage change
    for (const listener of storageListeners) {
      listener({ settings: { newValue: { theme: 'dark' } } }, 'local');
    }
    expect(container.getAttribute('data-theme')).toBe('dark');
  });

  it('cleanup removes storage listener', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const cleanup = injectThemeTokens(container);
    const beforeCount = storageListeners.length;
    cleanup();
    expect(storageListeners.length).toBe(beforeCount - 1);
  });

  it('style contains both light + dark token blocks', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    injectThemeTokens(container);
    const style = document.getElementById('subtitle-theme-tokens');
    expect(style?.textContent).toContain('[data-theme="dark"]');
    expect(style?.textContent).toContain('#2563eb'); // light primary
    expect(style?.textContent).toContain('#60a5fa'); // dark primary
  });
});
