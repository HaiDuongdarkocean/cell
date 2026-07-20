import { describe, expect, it, jest } from '@jest/globals';
import { createTokenBadge } from './tokenBadge';

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

    const toggle = shadow.querySelector('.js-cell-token-toggle') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);

    badge.destroy();
  });
});
