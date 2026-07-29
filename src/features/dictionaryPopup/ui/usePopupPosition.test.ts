import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { usePopupPosition } from './usePopupPosition';
import type { UsePopupPositionOptions } from './usePopupPosition';

const defaultAnchor = { top: 70, left: 100, right: 150, bottom: 100 };

function TestPopup(props: UsePopupPositionOptions): React.ReactElement {
  const { style, isSheet, popupRef, onPointerDownHeader, onPointerDownResize, onPointerDownSheet, onPointerDownContent } = usePopupPosition(props);
  return React.createElement(
    'div',
    { ref: popupRef, style, 'data-testid': 'popup-root', 'data-sheet': isSheet ? 'true' : 'false' },
    React.createElement('div', { 'data-testid': 'popup-header', onPointerDown: onPointerDownHeader }, 'Header'),
    React.createElement('div', { 'data-testid': 'popup-sheet-handle', onPointerDown: onPointerDownSheet }, 'Handle'),
    React.createElement('div', { 'data-testid': 'popup-content', onPointerDown: onPointerDownContent }, 'Content'),
    React.createElement('div', { 'data-testid': 'popup-resize', onPointerDown: onPointerDownResize }, 'Resize'),
  );
}

beforeAll(() => {
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof MouseEvent;
  }

  globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  }) as unknown as typeof requestAnimationFrame;
});

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
});

describe('usePopupPosition', () => {
  it('computes initial position from anchor and viewport', () => {
    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    expect(root).toHaveStyle({ left: '154px', top: '104px' });
    expect(root).toHaveStyle({ width: '420px' });
  });

  it('recomputes layout when the viewport resizes', () => {
    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    expect(root).toHaveStyle({ width: '420px' });

    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    fireEvent.resize(window);

    expect(root).toHaveAttribute('data-sheet', 'true');
    expect(root).toHaveStyle({ width: '100%' });
  });

  it('drags the popup by the header', () => {
    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    const header = screen.getByTestId('popup-header');

    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 150, pointerId: 1 });

    expect(root).toHaveStyle({ left: '254px', top: '154px' });
  });

  it('resizes the popup from the resize handle', () => {
    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    const resize = screen.getByTestId('popup-resize');

    fireEvent.pointerDown(resize, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 50, pointerId: 1 });

    expect(root).toHaveStyle({ width: '520px' });
  });

  it('switches to a bottom sheet and drags the sheet handle', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    const handle = screen.getByTestId('popup-sheet-handle');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(root).toHaveStyle({ transform: 'translateY(100px)' });
  });

  it('dismisses the sheet when swiped down beyond the threshold', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    const onClose = jest.fn();

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose }));
    const content = screen.getByTestId('popup-content');

    fireEvent.pointerDown(content, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 150, pointerId: 1 });

    expect(onClose).toHaveBeenCalled();
  });
});
