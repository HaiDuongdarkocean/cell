import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { useSheet } from './useSheet';

function Probe({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { onPointerDownHandle } = useSheet({ onClose });
  return createElement('div', { 'data-tihoka-id': 'handle', onPointerDown: onPointerDownHandle });
}

function firePointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  const e = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  target.dispatchEvent(e);
}

describe('useSheet ghost-click swallower', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function closeViaHandle(): { readonly sentinel: jest.Mock; readonly onClose: jest.Mock } {
    const onClose = jest.fn();
    const { getByTestId } = render(createElement(Probe, { onClose }));
    const handle = getByTestId('handle');
    const sentinel = jest.fn();
    document.addEventListener('click', sentinel);
    act(() => {
      firePointer(handle, 'pointerdown', 100, 200);
      firePointer(document, 'pointerup', 100, 200);
    });
    return { sentinel, onClose };
  }

  it('closes on handle click and swallows the retargeted ghost click', () => {
    jest.useFakeTimers();
    const { sentinel, onClose } = closeViaHandle();
    expect(onClose).toHaveBeenCalledTimes(1);

    const ghost = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    document.body.dispatchEvent(ghost);
    expect(sentinel).not.toHaveBeenCalled();
    expect(ghost.defaultPrevented).toBe(true);
  });

  it('lets keyboard clicks (detail 0) pass through', () => {
    jest.useFakeTimers();
    const { sentinel } = closeViaHandle();
    const keyClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
    document.body.dispatchEvent(keyClick);
    expect(sentinel).toHaveBeenCalledTimes(1);
    expect(keyClick.defaultPrevented).toBe(false);
  });

  it('disarms itself so a later click reaches listeners', () => {
    jest.useFakeTimers();
    const { sentinel } = closeViaHandle();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    const late = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    document.body.dispatchEvent(late);
    expect(sentinel).toHaveBeenCalledTimes(1);
    expect(late.defaultPrevented).toBe(false);
  });
});
