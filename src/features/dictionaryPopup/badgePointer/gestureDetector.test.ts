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
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    expect(onSingle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits double tap after two quick taps and cancels single tap', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits triple tap immediately on the third tap and cancels double tap', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);

    // Triple fires synchronously on the third tap — no window to wait through.
    expect(onTriple).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    // No pending timers should fire later.
    jest.advanceTimersByTime(300);
    expect(onTriple).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onSingle).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('ignores taps spaced far apart (each fires single tap)', () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);

    detector.onPointerUp(400);
    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(2);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('resets after a triple tap fires and allows a new triple tap', () => {
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onSingleTap: jest.fn(), onDoubleTap: jest.fn(), onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);
    expect(onTriple).toHaveBeenCalledTimes(1);

    // A new three-tap sequence after reset.
    detector.onPointerUp(500);
    detector.onPointerUp(600);
    detector.onPointerUp(700);
    expect(onTriple).toHaveBeenCalledTimes(2);

    detector.destroy();
  });

  it('reset() clears a pending single-tap so it never fires', () => {
    const onSingle = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: jest.fn(), onTripleTap: jest.fn() });

    detector.onPointerUp(0);
    detector.reset();
    jest.advanceTimersByTime(300);
    expect(onSingle).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('reset() lets a fresh single tap fire after being called', () => {
    const onSingle = jest.fn();
    const detector = createGestureDetector({ onSingleTap: onSingle, onDoubleTap: jest.fn(), onTripleTap: jest.fn() });

    detector.onPointerUp(0);
    detector.reset();
    // A new tap after reset starts a fresh sequence.
    detector.onPointerUp(50);
    jest.advanceTimersByTime(300);
    expect(onSingle).toHaveBeenCalledTimes(1);

    detector.destroy();
  });

  it('reset() clears a pending double-tap so it never fires', () => {
    const onDouble = jest.fn();
    const detector = createGestureDetector({ onSingleTap: jest.fn(), onDoubleTap: onDouble, onTripleTap: jest.fn() });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.reset();
    jest.advanceTimersByTime(300);
    expect(onDouble).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('reset() lets a fresh double-tap sequence fire after being called', () => {
    const onDouble = jest.fn();
    const detector = createGestureDetector({ onSingleTap: jest.fn(), onDoubleTap: onDouble, onTripleTap: jest.fn() });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.reset();
    // A new two-tap sequence after reset.
    detector.onPointerUp(200);
    detector.onPointerUp(250);
    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);

    detector.destroy();
  });
});
