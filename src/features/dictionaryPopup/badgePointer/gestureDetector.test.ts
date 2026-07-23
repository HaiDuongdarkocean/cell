import { createGestureDetector } from './gestureDetector';

describe('createGestureDetector', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('emits double tap after two quick taps', () => {
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    expect(onDouble).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onTriple).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('emits triple tap after three quick taps', () => {
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    detector.onPointerUp(200);

    expect(onTriple).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();

    // No pending double timer should fire.
    jest.advanceTimersByTime(300);
    expect(onDouble).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('ignores taps spaced far apart', () => {
    const onDouble = jest.fn();
    const onTriple = jest.fn();
    const detector = createGestureDetector({ onDoubleTap: onDouble, onTripleTap: onTriple });

    detector.onPointerUp(0);
    detector.onPointerUp(400);

    jest.advanceTimersByTime(300);
    expect(onDouble).not.toHaveBeenCalled();
    expect(onTriple).not.toHaveBeenCalled();

    detector.destroy();
  });

  it('resets after a double tap fires and allows a new double tap', () => {
    const onDouble = jest.fn();
    const detector = createGestureDetector({ onDoubleTap: onDouble, onTripleTap: jest.fn() });

    detector.onPointerUp(0);
    detector.onPointerUp(100);
    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);

    // A new two-tap sequence after reset.
    detector.onPointerUp(500);
    detector.onPointerUp(600);
    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(2);

    detector.destroy();
  });
});
