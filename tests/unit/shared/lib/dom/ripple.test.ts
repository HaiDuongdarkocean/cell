import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { spawnRipple, installRippleDelegation } from '@/shared/lib/dom/ripple';

function press(el: Element, button = 0): void {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button }));
}

describe('spawnRipple', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('appends a marked span sized 1.6x the host at the press point', () => {
    const host = document.createElement('button');
    document.body.appendChild(host);
    jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      width: 40, height: 20, left: 10, top: 50, right: 50, bottom: 70, x: 10, y: 50, toJSON: () => ({}),
    } as DOMRect);
    spawnRipple(host, 30, 60);
    const span = host.querySelector('[data-cell-ripple]') as HTMLElement;
    expect(span).not.toBeNull();
    expect(span.style.width).toBe('64px');
    expect(span.style.height).toBe('64px');
    expect(span.style.left).toBe('-12px');
    expect(span.style.top).toBe('-22px');
  });

  it('removes the span on animationend and via fallback timeout', () => {
    const host = document.createElement('button');
    document.body.appendChild(host);
    spawnRipple(host, 0, 0);
    const span = host.querySelector('[data-cell-ripple]') as HTMLElement;
    span.dispatchEvent(new Event('animationend'));
    expect(host.querySelector('[data-cell-ripple]')).toBeNull();

    spawnRipple(host, 0, 0);
    jest.advanceTimersByTime(1300);
    expect(host.querySelector('[data-cell-ripple]')).toBeNull();
  });
});

describe('installRippleDelegation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ripples a raw button inside a shadow root on pointerdown', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    shadow.appendChild(btn);
    const cleanup = installRippleDelegation(shadow);
    press(btn);
    expect(btn.querySelector('[data-cell-ripple]')).not.toBeNull();
    cleanup();
  });

  it('ripples a role=button element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    shadow.appendChild(div);
    installRippleDelegation(shadow);
    press(div);
    expect(div.querySelector('[data-cell-ripple]')).not.toBeNull();
  });

  it('skips disabled and aria-disabled buttons', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const disabled = document.createElement('button');
    disabled.disabled = true;
    const ariaDisabled = document.createElement('button');
    ariaDisabled.setAttribute('aria-disabled', 'true');
    shadow.append(disabled, ariaDisabled);
    installRippleDelegation(shadow);
    press(disabled);
    press(ariaDisabled);
    expect(disabled.querySelector('[data-cell-ripple]')).toBeNull();
    expect(ariaDisabled.querySelector('[data-cell-ripple]')).toBeNull();
  });

  it('defers to components that manage their own ripple', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    btn.setAttribute('data-cell-ripple-self', '');
    shadow.appendChild(btn);
    installRippleDelegation(shadow);
    press(btn);
    expect(btn.querySelector('[data-cell-ripple]')).toBeNull();
  });

  it('honors data-cell-no-ripple opt-out', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    btn.setAttribute('data-cell-no-ripple', '');
    shadow.appendChild(btn);
    installRippleDelegation(shadow);
    press(btn);
    expect(btn.querySelector('[data-cell-ripple]')).toBeNull();
  });

  it('ignores non-primary pointer buttons and installs only once per root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    shadow.appendChild(btn);
    installRippleDelegation(shadow);
    installRippleDelegation(shadow);
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button: 2 }));
    expect(btn.querySelector('[data-cell-ripple]')).toBeNull();
    press(btn);
    expect(btn.querySelectorAll('[data-cell-ripple]')).toHaveLength(1);
  });

  it('does not double-ripple buttons inside a nested delegated shadow root', () => {
    const outerHost = document.createElement('div');
    document.body.appendChild(outerHost);
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    const innerHost = document.createElement('div');
    outerShadow.appendChild(innerHost);
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    innerShadow.appendChild(btn);
    installRippleDelegation(outerShadow);
    installRippleDelegation(innerShadow);
    press(btn);
    expect(btn.querySelectorAll('[data-cell-ripple]')).toHaveLength(1);
  });

  it('cleanup removes the listener', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const btn = document.createElement('button');
    shadow.appendChild(btn);
    const cleanup = installRippleDelegation(shadow);
    cleanup();
    press(btn);
    expect(btn.querySelector('[data-cell-ripple]')).toBeNull();
  });
});
