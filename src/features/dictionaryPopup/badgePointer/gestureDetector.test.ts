import { createGestureDetector } from './gestureDetector';

describe('createGestureDetector', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('emits single tap after one tap + window expiry', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple, onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    expect(onSingle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();
    expect(onQuad).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits double tap after two quick taps and cancels single tap', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple, onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();
    expect(onQuad).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits triple tap after three quick taps and cancels double tap', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple, onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);

    expect(onTriple).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onTriple).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();
    expect(onQuad).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits quadruple tap after four quick taps and cancels triple tap', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple, onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);
    detector.onPointerUp(300);

    expect(onQuad).toHaveBeenCalledTimes(1);
    expect(onTriple).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    // No pending timers should fire.
    jest.advanceTimersByTime(300);
    expect(onTriple).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('ignores taps spaced far apart (each fires single tap)', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: jest.fn(), onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);

    detector.onPointerUp(400);
    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(2);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onQuad).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('resets after a quadruple tap fires and allows a new quadruple tap', () => {
    const onQuad = jest.fn();
    const detector = createGestureDetector({ onSingleTap: jest.fn(), onDoubleTap: jest.fn(), onTripleTap: jest.fn(), onQuadrupleTap: onQuad });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);
    detector.onPointerUp(300);
    expect(onQuad).toHaveBeenCalledTimes(1);

    // A new four-tap sequence after reset.
    detector.onPointerUp(500);
    detector.onPointerUp(600);
    detector.onPointerUp(700);
    detector.onPointerUp(800);
    expect(onQuad).toHaveBeenCalledTimes(2);

    detector.destroy();
  });
});
