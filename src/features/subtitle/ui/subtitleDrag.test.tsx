import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useSubtitleBlockDrag } from './subtitleDrag';
import { dragDeltaToYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';

const HOST_HEIGHT = 200;
const START_OFFSET = 50;

function Harness({ onDragReposition }: { readonly onDragReposition?: (y: number) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [yOffset, setYOffset] = useState(START_OFFSET);
  const { handlePointerDown, handlePointerMove, handlePointerUp } = useSubtitleBlockDrag({
    rootRef,
    yOffsetPercent: yOffset,
    setYOffsetPercent: setYOffset,
    onDragReposition,
  });
  return (
    <div data-tihoka-id="drag-test-host">
      <div
        ref={rootRef}
        data-tihoka-id="drag-test-root"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div data-tihoka-id="subtitle-block">
          <div data-tihoka-id="drag-test-layer">
            <span data-tihoka-id="drag-test-text">subtitle line</span>
          </div>
        </div>
        <button type="button" data-tihoka-id="nav-expand">expand</button>
      </div>
    </div>
  );
}

function stubHostRect(): void {
  const host = screen.getByTestId('drag-test-host');
  host.getBoundingClientRect = () =>
    ({ height: HOST_HEIGHT, width: 400, top: 0, left: 0, right: 400, bottom: HOST_HEIGHT, x: 0, y: 0 }) as DOMRect;
}

function dispatchPointer(el: Element, type: string, clientY: number, pointerType: string): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(el, event);
}

describe('useSubtitleBlockDrag', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('mouse drag on the subtitle block engages after the threshold', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const text = screen.getByTestId('drag-test-text');

    dispatchPointer(text, 'pointerdown', 100, 'mouse');
    dispatchPointer(text, 'pointermove', 140, 'mouse');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(text, 'pointerup', 140, 'mouse');

    expect(onDragReposition).toHaveBeenCalledWith(dragDeltaToYOffset(START_OFFSET, 40, HOST_HEIGHT));
  });

  it('pointer events on the band background never drag (click-through to player)', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const root = screen.getByTestId('drag-test-root');

    dispatchPointer(root, 'pointerdown', 100, 'mouse');
    dispatchPointer(root, 'pointermove', 140, 'mouse');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(root, 'pointerup', 140, 'mouse');

    expect(onDragReposition).not.toHaveBeenCalled();
  });

  it('mouse drag on the collapsed nav pill engages after the threshold (tap still expands)', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const pill = screen.getByTestId('nav-expand');

    dispatchPointer(pill, 'pointerdown', 100, 'mouse');
    dispatchPointer(pill, 'pointermove', 104, 'mouse');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(pill, 'pointerup', 104, 'mouse');
    expect(onDragReposition).not.toHaveBeenCalled();

    dispatchPointer(pill, 'pointerdown', 100, 'mouse');
    dispatchPointer(pill, 'pointermove', 140, 'mouse');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(pill, 'pointerup', 140, 'mouse');
    expect(onDragReposition).toHaveBeenCalledWith(dragDeltaToYOffset(START_OFFSET, 40, HOST_HEIGHT));
  });

  it('touch-drag starting inside the subtitle block engages after the threshold', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const text = screen.getByTestId('drag-test-text');

    dispatchPointer(text, 'pointerdown', 100, 'touch');
    dispatchPointer(text, 'pointermove', 140, 'touch');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(text, 'pointerup', 140, 'touch');

    expect(onDragReposition).toHaveBeenCalledWith(dragDeltaToYOffset(START_OFFSET, 40, HOST_HEIGHT));
  });

  it('touch tap under the threshold does not reposition', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const text = screen.getByTestId('drag-test-text');

    dispatchPointer(text, 'pointerdown', 100, 'touch');
    dispatchPointer(text, 'pointermove', 104, 'touch');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(text, 'pointerup', 104, 'touch');

    expect(onDragReposition).not.toHaveBeenCalled();
  });

  it('mouse press on the subtitle block under the threshold does not reposition (click/lookup stays)', () => {
    const onDragReposition = jest.fn();
    render(<Harness onDragReposition={onDragReposition} />);
    stubHostRect();
    const text = screen.getByTestId('drag-test-text');

    dispatchPointer(text, 'pointerdown', 100, 'mouse');
    dispatchPointer(text, 'pointermove', 104, 'mouse');
    act(() => jest.advanceTimersByTime(20));
    dispatchPointer(text, 'pointerup', 104, 'mouse');

    expect(onDragReposition).not.toHaveBeenCalled();
  });
});
