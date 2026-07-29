import { renderHook, act } from '@testing-library/react';
import { useOrbitalGesture } from './useOrbitalGesture';

const makePointerEvent = (x = 0, y = 0, timeStamp = 0): PointerEvent =>
  ({ clientX: x, clientY: y, timeStamp } as unknown as PointerEvent);

describe('useOrbitalGesture', () => {
  it('calls onSingleTap after one tap', () => {
    jest.useFakeTimers();
    const onSingleTap = jest.fn();
    const { result } = renderHook(() => useOrbitalGesture({ onSingleTap }));

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
});
