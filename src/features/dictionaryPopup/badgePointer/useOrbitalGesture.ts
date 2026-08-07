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
  /** Attach to onPointerCancel on the badge. */
  onPointerCancel: (e: PointerEvent | React.PointerEvent) => void;
  /** Reset any pending tap sequence. */
  reset: () => void;
  /** Clean up timers. */
  destroy: () => void;
}

interface CaptureRef {
  target: Element;
  pointerId: number;
}

function trySetPointerCapture(target: unknown, pointerId: number): CaptureRef | null {
  if (!(target instanceof Element) || typeof pointerId !== 'number') return null;
  const el = target as Element & { setPointerCapture?: (id: number) => void };
  if (typeof el.setPointerCapture !== 'function') return null;
  try {
    el.setPointerCapture(pointerId);
    return { target: el, pointerId };
  } catch {
    return null;
  }
}

function tryReleasePointerCapture(capture: CaptureRef | null): void {
  if (!capture) return;
  const el = capture.target as Element & { releasePointerCapture?: (id: number) => void };
  if (typeof el.releasePointerCapture !== 'function') return;
  try {
    el.releasePointerCapture(capture.pointerId);
  } catch {
    // Ignore: the pointer may have already been released.
  }
}

export function useOrbitalGesture(options: UseOrbitalGestureOptions): UseOrbitalGestureResult {
  // Keep a live reference to callbacks so the gesture detector does not use
  // stale closures from the first render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const detectorRef = useRef(
    createGestureDetector({
      onSingleTap: () => { optionsRef.current.onSingleTap?.(); },
      onDoubleTap: () => { optionsRef.current.onDoubleTap?.(); },
      onTripleTap: () => { optionsRef.current.onTripleTap?.(); },
    }),
  );

  const dragRef = useRef({
    dragging: false,
    pointerDown: false,
    startX: 0,
    startY: 0,
    hasDragged: false,
  });

  const captureRef = useRef<CaptureRef | null>(null);

  const releaseCapture = useCallback((): void => {
    tryReleasePointerCapture(captureRef.current);
    captureRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      dragRef.current = { dragging: false, pointerDown: true, startX: e.clientX, startY: e.clientY, hasDragged: false };
      detectorRef.current.onPointerDown(e.timeStamp);
      const capture = trySetPointerCapture(e.currentTarget, e.pointerId);
      if (capture) {
        captureRef.current = capture;
      }
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      const { startX, startY, dragging, pointerDown } = dragRef.current;
      if (!pointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragging) {
        const moveThreshold = 4;
        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
          dragRef.current.dragging = true;
          dragRef.current.hasDragged = true;
          detectorRef.current.reset();
          optionsRef.current.onDragStart?.();
        } else {
          return;
        }
      }

      optionsRef.current.onDrag?.(dx, dy);
    },
    [],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      if (captureRef.current && (typeof e.pointerId !== 'number' || e.pointerId === captureRef.current.pointerId)) {
        releaseCapture();
      }
      if (dragRef.current.dragging) {
        dragRef.current.dragging = false;
        dragRef.current.pointerDown = false;
        optionsRef.current.onDragEnd?.();
        return;
      }
      dragRef.current.pointerDown = false;
      // When no multi-tap handlers (collapsed at edge), fire single-tap
      // immediately — no 300ms detector delay. This makes the badge feel
      // instant: tap → panel opens, no waiting for a double-tap that can't come.
      const opts = optionsRef.current;
      if (opts.onDoubleTap === undefined && opts.onTripleTap === undefined) {
        opts.onSingleTap?.();
        return;
      }
      detectorRef.current.onPointerUp(e.timeStamp);
    },
    [releaseCapture],
  );

  const onPointerCancel = useCallback(
    (e: PointerEvent | React.PointerEvent): void => {
      if (captureRef.current && (typeof e.pointerId !== 'number' || e.pointerId === captureRef.current.pointerId)) {
        releaseCapture();
      }
      if (dragRef.current.dragging) {
        dragRef.current.dragging = false;
        dragRef.current.pointerDown = false;
        optionsRef.current.onDragEnd?.();
        return;
      }
      dragRef.current.pointerDown = false;
      detectorRef.current.reset();
    },
    [releaseCapture],
  );

  const reset = useCallback((): void => {
    dragRef.current = { dragging: false, pointerDown: false, startX: 0, startY: 0, hasDragged: false };
    detectorRef.current.reset();
    releaseCapture();
  }, [releaseCapture]);

  const destroy = useCallback((): void => {
    dragRef.current = { dragging: false, pointerDown: false, startX: 0, startY: 0, hasDragged: false };
    detectorRef.current.destroy();
    releaseCapture();
  }, [releaseCapture]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, reset, destroy };
}
