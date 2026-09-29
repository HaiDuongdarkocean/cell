import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from './useFocusTrap';

function Trap(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  return (
    <div ref={ref} data-testid="panel">
      <button data-testid="first">first</button>
      <button data-testid="last">last</button>
    </div>
  );
}

function renderInShadow(): { shadow: ShadowRoot; container: HTMLDivElement; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);
  return { shadow, container, host };
}

// jsdom has no layout — offsetParent is always null, which would empty the
// focusable list. Stub it visible so the wrap logic can run.
function markFocusable(...els: HTMLElement[]): void {
  for (const el of els) {
    Object.defineProperty(el, 'offsetParent', { value: el.parentElement, configurable: true });
  }
}

describe('useFocusTrap', () => {
  it('light DOM: Tab wraps last → first, Shift+Tab wraps first → last', () => {
    render(<Trap />);
    const first = document.querySelector('[data-testid="first"]') as HTMLElement;
    const last = document.querySelector('[data-testid="last"]') as HTMLElement;
    markFocusable(first, last);

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('shadow DOM: document.activeElement is the host — wrap must use the shadow root', () => {
    const { shadow, container, host } = renderInShadow();
    render(<Trap />, { container });

    const first = shadow.querySelector('[data-testid="first"]') as HTMLElement;
    const last = shadow.querySelector('[data-testid="last"]') as HTMLElement;
    markFocusable(first, last);

    // Sanity: focusing inside the shadow still reports the host at document level.
    last.focus();
    expect(document.activeElement).toBe(host);
    expect(shadow.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: 'Tab' });
    expect(shadow.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(shadow.activeElement).toBe(last);

    host.remove();
  });
});
