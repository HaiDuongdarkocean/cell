import { renderHook, act } from '@testing-library/react';
import { useOrbitalGesture } from './useOrbitalGesture';

const makePointerEvent = (x = 0, y = 0, timeStamp = 0): PointerEvent =>
  ({ clientX: x, clientY: y, timeStamp } as unknown as PointerEvent);

describe('useOrbitalGesture', () => {
  it('calls onSingleTap after one tap (with multi-tap handlers → 300ms delay)', () => {
    jest.useFakeTimers();
    const onSingleTap = jest.fn();
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onSingleTap, onDoubleTap }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerUp(makePointerEvent(0, 0, 0));
    });
    expect(onSingleTap).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onSingleTap).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('calls onDoubleTap after two taps', () => {
    jest.useFakeTimers();
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onDoubleTap }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerUp(makePointerEvent(0, 0, 0));
    });

    act(() => {
      jest.advanceTimersByTime(80);
      result.current.onPointerDown(makePointerEvent(0, 0, 80));
      result.current.onPointerUp(makePointerEvent(0, 0, 80));
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onDoubleTap).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('uses the latest callback references (no stale closures)', () => {
    jest.useFakeTimers();
    const firstOnDoubleTap = jest.fn();
    const secondOnDoubleTap = jest.fn();
    const { result, rerender } = renderHook(
      ({ onDoubleTap }) => useOrbitalGesture({ onDoubleTap }),
      { initialProps: { onDoubleTap: firstOnDoubleTap } },
    );

    // Trigger a double-tap before the prop changes.
    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerUp(makePointerEvent(0, 0, 0));
    });
    act(() => {
      jest.advanceTimersByTime(80);
      result.current.onPointerDown(makePointerEvent(0, 0, 80));
      result.current.onPointerUp(makePointerEvent(0, 0, 80));
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(firstOnDoubleTap).toHaveBeenCalledTimes(1);

    // Change the callback and trigger another double-tap.
    rerender({ onDoubleTap: secondOnDoubleTap });
    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 500));
      result.current.onPointerUp(makePointerEvent(0, 0, 500));
    });
    act(() => {
      jest.advanceTimersByTime(80);
      result.current.onPointerDown(makePointerEvent(0, 0, 580));
      result.current.onPointerUp(makePointerEvent(0, 0, 580));
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(firstOnDoubleTap).toHaveBeenCalledTimes(1);
    expect(secondOnDoubleTap).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('calls onDrag during drag', () => {
    const onDragStart = jest.fn();
    const onDrag = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onDragStart, onDrag }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerMove(makePointerEvent(10, 10, 0));
      result.current.onPointerMove(makePointerEvent(20, 20, 0));
      result.current.onPointerUp(makePointerEvent(20, 20, 0));
    });

    expect(onDragStart).toHaveBeenCalled();
    expect(onDrag).toHaveBeenCalled();
  });

  it('calls onDragEnd and does not count as a tap on pointer cancel', () => {
    const onDragEnd = jest.fn();
    const onSingleTap = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onDragEnd, onSingleTap }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerMove(makePointerEvent(10, 10, 0));
      result.current.onPointerCancel(makePointerEvent(10, 10, 0));
    });

    expect(onDragEnd).toHaveBeenCalled();
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('fires onSingleTap immediately when no multi-tap handlers (collapsed mode)', () => {
    jest.useFakeTimers();
    const onSingleTap = jest.fn();
    // No onDoubleTap / onTripleTap → instant single-tap (no 300ms delay)
    const { result } = renderHook(() => useOrbitalGesture({ onSingleTap }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerUp(makePointerEvent(0, 0, 0));
    });
    // Fires immediately — no timer needed
    expect(onSingleTap).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('still uses 300ms detector when onDoubleTap is present (expanded mode)', () => {
    jest.useFakeTimers();
    const onSingleTap = jest.fn();
    const onDoubleTap = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onSingleTap, onDoubleTap }));

    act(() => {
      result.current.onPointerDown(makePointerEvent(0, 0, 0));
      result.current.onPointerUp(makePointerEvent(0, 0, 0));
    });
    expect(onSingleTap).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onSingleTap).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
