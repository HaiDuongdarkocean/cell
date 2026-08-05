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
    { ref: popupRef, style, 'data-cell-id': 'popup-root', 'data-sheet': isSheet ? 'true' : 'false' },
    React.createElement('div', { 'data-cell-id': 'popup-header', onPointerDown: onPointerDownHeader }, 'Header'),
    React.createElement('div', { 'data-cell-id': 'popup-sheet-handle', onPointerDown: onPointerDownSheet }, 'Handle'),
    React.createElement('div', { 'data-cell-id': 'popup-content', onPointerDown: onPointerDownContent }, 'Content'),
    React.createElement('div', { 'data-cell-id': 'popup-resize', onPointerDown: onPointerDownResize }, 'Resize'),
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
  delete document.documentElement.dataset.cellPlayerMode;
  document.documentElement.style.removeProperty('--cell-player-mode-video-height');
  document.documentElement.style.removeProperty('--cell-player-mode-dock-height');
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

  it('bounds the Player Mode sheet between video and dock', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    document.documentElement.dataset.cellPlayerMode = 'true';
    document.documentElement.style.setProperty('--cell-player-mode-video-height', '270px');
    document.documentElement.style.setProperty('--cell-player-mode-dock-height', '128px');

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');

    expect(root).toHaveStyle({ top: '270px', bottom: '128px', height: '370px' });
  });

  it('switches to a bottom sheet and drags the sheet handle 1:1 with height', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn() }));
    const root = screen.getByTestId('popup-root');
    const handle = screen.getByTestId('popup-sheet-handle');

    // Initial sheet height = POPUP_DEFAULT_HEIGHT_PX (300).
    expect(root).toHaveStyle({ height: '300px' });

    // Dragging the handle down 100px shrinks the sheet 1:1 (no translate).
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(root).toHaveStyle({ height: '200px' });
  });

  it('closes the sheet when the handle is clicked without dragging', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    const onClose = jest.fn();

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose }));
    const handle = screen.getByTestId('popup-sheet-handle');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 0, pointerId: 1 });

    expect(onClose).toHaveBeenCalled();
  });

  it('closes the sheet when dragged down below 20% of viewport height', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
    const onClose = jest.fn();

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose }));
    const handle = screen.getByTestId('popup-sheet-handle');

    // 20% of 768 = 153.6. Drag down 200px from height 300 → height 100 (< 153.6) → close.
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 200, pointerId: 1 });

    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the sheet height where the drag stopped (no tier snap)', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    const onSizeChange = jest.fn();

    render(React.createElement(TestPopup, { anchor: defaultAnchor, onClose: jest.fn(), onSizeChange }));
    const root = screen.getByTestId('popup-root');
    const handle = screen.getByTestId('popup-sheet-handle');

    // Drag down 40px → height 260 (not a tier: tiers are 768, 576, 384, 192).
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 40, pointerId: 1 });

    expect(root).toHaveStyle({ height: '260px' });
    expect(onSizeChange).toHaveBeenCalledWith(expect.objectContaining({}), 260);
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
