import { useRef, useCallback } from 'react';
import { createGestureDetector } from './gestureDetector';

export interface UseOrbitalGestureOptions {
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  onTripleTap?: () => void;
  onDragStart?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
}

export interface UseOrbitalGestureResult {
  /** Attach to onPointerDown on the badge. */
  onPointerDown: (e: PointerEvent | React.PointerEvent) => void;
  /** Attach to onPointerUp on the badge. */
  onPointerUp: (e: PointerEvent | React.PointerEvent) => void;
  /** Attach to onPointerMove on the badge/document while dragging. */
  onPointerMove: (e: PointerEvent | React.PointerEvent) => void;
  /** Reset any pending tap sequence. */
  reset: () => void;
  /** Clean up timers. */
  destroy: () => void;
}

export function useOrbitalGesture(options: UseOrbitalGestureOptions): UseOrbitalGestureResult {
  const detectorRef = useRef(
    createGestureDetector({
      onSingleTap: options.onSingleTap ?? (() => {}),
      onDoubleTap: options.onDoubleTap ?? (() => {}),
      onTripleTap: options.onTripleTap ?? (() => {}),
    }),
  );

  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    hasDragged: false,
  });

  const onPointerDown = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      dragRef.current = { dragging: false, startX: e.clientX, startY: e.clientY, hasDragged: false };
      detectorRef.current.onPointerDown(e.timeStamp);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      const { startX, startY, dragging } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragging) {
        const moveThreshold = 4;
        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
          dragRef.current.dragging = true;
          dragRef.current.hasDragged = true;
          detectorRef.current.reset();
          options.onDragStart?.();
        } else {
          return;
        }
      }

      options.onDrag?.(dx, dy);
    },
    [options],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      if (dragRef.current.dragging) {
        dragRef.current.dragging = false;
        options.onDragEnd?.();
        return;
      }
      detectorRef.current.onPointerUp(e.timeStamp);
    },
    [options],
  );

  const reset = useCallback((): void => {
    dragRef.current = { dragging: false, startX: 0, startY: 0, hasDragged: false };
    detectorRef.current.reset();
  }, []);

  const destroy = useCallback((): void => {
    dragRef.current = { dragging: false, startX: 0, startY: 0, hasDragged: false };
    detectorRef.current.destroy();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, reset, destroy };
}
