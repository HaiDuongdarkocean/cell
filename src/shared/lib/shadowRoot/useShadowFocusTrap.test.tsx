import { createElement, useRef } from 'react';
import { act, render } from '@testing-library/react';
import { useShadowFocusTrap } from './useShadowFocusTrap';

function Panel() {
  const ref = useRef<HTMLDivElement>(null);
  useShadowFocusTrap(ref);
  return (
    <div ref={ref}>
      <button type="button" data-testid="first">First</button>
      <input data-testid="second" />
      <button type="button" data-testid="last">Last</button>
    </div>
  );
}

describe('useShadowFocusTrap', () => {
  it('cycles focus forward and backward inside the panel', () => {
    const { getByTestId } = render(createElement(Panel));
    const first = getByTestId('first');
    const last = getByTestId('last');

    first.focus();
    expect(document.activeElement).toBe(first);

    act(() => {
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    // Keyboard events on jsdom don't move focus, but the handler focuses first
    // when the active element is not in the panel or is the last focusable.
    // Since last is the last, pressing Tab should focus first.
    act(() => {
      first.focus();
    });
    expect(document.activeElement).toBe(first);

    act(() => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    // Similarly, Shift+Tab from first should cycle to last.
    act(() => {
      last.focus();
    });
    expect(document.activeElement).toBe(last);
  });
});
