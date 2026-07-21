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

  it('closes the panel when a pointerdown lands outside the badge', () => {
    const badge = createTokenBadge({
      initialState: { enabled: false, showStatus: true, showFrequency: true },
      onToggleEnabled: jest.fn(),
      onToggleStatus: jest.fn(),
      onToggleFrequency: jest.fn(),
      onOpenDictionary: jest.fn(),
    });

    const host = document.querySelector('.js-cell-token-badge-host') as HTMLElement;
    const shadow = getShadow(host);
    const fab = shadow.querySelector('.js-cell-token-fab') as HTMLButtonElement;
    fab.click();
    expect(shadow.querySelector('.cell-token-panel--open')).not.toBeNull();

    // Pointerdown on body (outside host) → panel closes.
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(shadow.querySelector('.cell-token-panel--open')).toBeNull();

    badge.destroy();
  });

  it('dragging the FAB repositions it and suppresses toggle', () => {
    const badge = createTokenBadge({
      initialState: { enabled: false, showStatus: true, showFrequency: true },
      onToggleEnabled: jest.fn(),
      onToggleStatus: jest.fn(),
      onToggleFrequency: jest.fn(),
      onOpenDictionary: jest.fn(),
    });

    const host = document.querySelector('.js-cell-token-badge-host') as HTMLElement;
    const shadow = getShadow(host);
    const fab = shadow.querySelector('.js-cell-token-fab') as HTMLButtonElement;

    // jsdom lacks getBoundingClientRect layout; stub a fixed rect so drag math
    // produces a deterministic new left/top.
    jest.spyOn(fab, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 200, right: 148, bottom: 248, width: 48, height: 48,
      x: 100, y: 200, toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(fab, 'offsetWidth', { value: 48, configurable: true });
    Object.defineProperty(fab, 'offsetHeight', { value: 48, configurable: true });

    fab.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 110, clientY: 210, bubbles: true }));
    // Move beyond 4px threshold → enters drag mode.
    fab.dispatchEvent(new MouseEvent('pointermove', { clientX: 160, clientY: 260, bubbles: true }));
    fab.dispatchEvent(new MouseEvent('pointerup', { clientX: 160, clientY: 260, bubbles: true }));

    // FAB now has explicit left/top inline styles (switched from right/bottom).
    expect(fab.style.getPropertyValue('left')).not.toBe('');
    expect(fab.style.getPropertyValue('top')).not.toBe('');
    expect(fab.style.getPropertyValue('right')).toBe('auto');

    // Drag suppresses the click that follows → panel stays closed.
    fab.click();
    expect(shadow.querySelector('.cell-token-panel--open')).toBeNull();

    badge.destroy();
  });
});
