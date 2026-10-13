import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { useDragScroll } from './useDragScroll';

function Probe(): React.JSX.Element {
  const ref = useDragScroll<HTMLDivElement>();
  return createElement('div', { ref, 'data-tihoka-id': 'scroller' });
}

function firePointer(el: HTMLElement, type: string, init: { clientX?: number; button?: number; pointerType?: string; pointerId?: number }): void {
  const e = new MouseEvent(type, { bubbles: true, clientX: init.clientX ?? 0, button: init.button ?? 0 });
  Object.defineProperty(e, 'pointerType', { value: init.pointerType ?? 'mouse' });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 });
  el.dispatchEvent(e);
}

describe('useDragScroll', () => {
  let el: HTMLElement;

  beforeEach(() => {
    const { getByTestId } = render(createElement(Probe));
    el = getByTestId('scroller');
    Object.defineProperty(el, 'scrollWidth', { value: 500, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true });
    el.setPointerCapture = jest.fn() as unknown as typeof el.setPointerCapture;
    el.releasePointerCapture = jest.fn() as unknown as typeof el.releasePointerCapture;
    el.hasPointerCapture = jest.fn(() => true) as unknown as typeof el.hasPointerCapture;
  });

  it('scrolls horizontally on mouse drag', () => {
    firePointer(el, 'pointerdown', { clientX: 0 });
    firePointer(el, 'pointermove', { clientX: -40 });
    expect(el.scrollLeft).toBe(40);
    firePointer(el, 'pointerup', {});
    firePointer(el, 'pointermove', { clientX: -80 });
    expect(el.scrollLeft).toBe(40);
  });

  it('does not capture the pointer below the drag threshold so taps still click', () => {
    firePointer(el, 'pointerdown', { clientX: 0 });
    firePointer(el, 'pointermove', { clientX: 2 });
    expect(el.scrollLeft).toBe(0);
    expect(el.setPointerCapture).not.toHaveBeenCalled();
    firePointer(el, 'pointerup', {});
  });

  it('ignores non-primary buttons and non-mouse pointers', () => {
    firePointer(el, 'pointerdown', { clientX: 0, button: 2 });
    firePointer(el, 'pointermove', { clientX: -40 });
    expect(el.scrollLeft).toBe(0);
    firePointer(el, 'pointerdown', { clientX: 0, pointerType: 'touch' });
    firePointer(el, 'pointermove', { clientX: -40 });
    expect(el.scrollLeft).toBe(0);
  });

  it('maps vertical wheel to horizontal scroll and prevents default', () => {
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 });
    el.dispatchEvent(e);
    expect(el.scrollLeft).toBe(60);
    expect(e.defaultPrevented).toBe(true);
  });

  it('does nothing when content fits', () => {
    Object.defineProperty(el, 'scrollWidth', { value: 100, configurable: true });
    firePointer(el, 'pointerdown', { clientX: 0 });
    firePointer(el, 'pointermove', { clientX: -40 });
    expect(el.scrollLeft).toBe(0);
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 });
    el.dispatchEvent(e);
    expect(el.scrollLeft).toBe(0);
  });
});
