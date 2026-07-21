import { describe, expect, it, jest, beforeAll } from '@jest/globals';
import { createTokenBadge } from './tokenBadge';

beforeAll(() => {
  // jsdom does not implement matchMedia — mock the same shape popupShell.test.ts uses.
  if (!window.matchMedia) {
    window.matchMedia = jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  c.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
});

function getShadow(host: HTMLElement): ShadowRoot {
  return host.shadowRoot as ShadowRoot;
}

describe('createTokenBadge', () => {
  it('renders FAB in shadow root and toggles panel open', () => {
    const badge = createTokenBadge({
      initialState: { enabled: false, showStatus: true, showFrequency: true },
      onToggleEnabled: jest.fn(),
      onToggleStatus: jest.fn(),
      onToggleFrequency: jest.fn(),
      onOpenDictionary: jest.fn(),
    });

    const host = document.querySelector('.js-cell-token-badge-host') as HTMLElement;
    expect(host).not.toBeNull();

    const shadow = getShadow(host);
    const fab = shadow.querySelector('.js-cell-token-fab') as HTMLButtonElement;
    expect(fab).not.toBeNull();

    expect(shadow.querySelector('.cell-token-panel--open')).toBeNull();
    fab.click();
    expect(shadow.querySelector('.cell-token-panel--open')).not.toBeNull();

    badge.destroy();
    expect(document.querySelector('.js-cell-token-badge-host')).toBeNull();
  });

  it('calls callbacks from toggle rows', () => {
    const onToggleEnabled = jest.fn();
    const badge = createTokenBadge({
      initialState: { enabled: false, showStatus: true, showFrequency: true },
      onToggleEnabled,
      onToggleStatus: jest.fn(),
      onToggleFrequency: jest.fn(),
      onOpenDictionary: jest.fn(),
    });

    const host = document.querySelector('.js-cell-token-badge-host') as HTMLElement;
    const shadow = getShadow(host);
    (shadow.querySelector('.js-cell-token-fab') as HTMLButtonElement).click();

    // DS Toggle pattern: <button aria-pressed> + click handler flips pressed state.
    const toggle = shadow.querySelector('.js-cell-token-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    badge.destroy();
  });
});
