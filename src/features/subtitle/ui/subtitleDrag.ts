import { useCallback, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { dragDeltaToYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';

export interface SubtitleBlockDragParams {
  rootRef: RefObject<HTMLDivElement | null>;
  yOffsetPercent: number;
  setYOffsetPercent: Dispatch<SetStateAction<number>>;
  onDragReposition?: (yOffsetPercent: number) => void;
}

export interface SubtitleBlockDrag {
  dragging: boolean;
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const DRAG_START_THRESHOLD_PX = 8;
const SUBTITLE_BLOCK_SELECTOR = '[data-cell-id="subtitle-block"]';

// ADR-025: drag-to-reposition theo trục Y. Pointer Events + rAF throttle +
// transform (atom ux-drag-transform-willchange-raf). touch-action:none trên .root
// (atom ux-touch-action-none-for-pointer-drag). Drag chỉ trên background —
// cluster/button/text có pointer-events:auto nên không trigger drag.
export function useSubtitleBlockDrag({
  rootRef,
  yOffsetPercent,
  setYOffsetPercent,
  onDragReposition,
}: SubtitleBlockDragParams): SubtitleBlockDrag {
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    startY: number;
    startOffset: number;
    containerHeight: number;
    rafId: number | null;
    pendingDelta: number;
    captured: boolean;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      const target = e.target;
      const isRootBackground = target === e.currentTarget;
      const isTouchBlockStart =
        e.pointerType === 'touch' &&
        target instanceof Element &&
        target.closest(SUBTITLE_BLOCK_SELECTOR) !== null;
      if (!isRootBackground && !isTouchBlockStart) return;
      const root = rootRef.current;
      if (!root) return;
      const rootNode = root.getRootNode();
      const host = rootNode instanceof ShadowRoot ? (rootNode.host as HTMLElement) : root.parentElement;
      const containerHeight = host ? host.getBoundingClientRect().height : 0;
      if (containerHeight <= 0) return;
      dragState.current = {
        startY: e.clientY,
        startOffset: yOffsetPercent,
        containerHeight,
        rafId: null,
        pendingDelta: 0,
        captured: isRootBackground,
      };
      if (isRootBackground) {
        setDragging(true);
        root.setPointerCapture?.(e.pointerId);
      }
    },
    [rootRef, yOffsetPercent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      const st = dragState.current;
      if (!st) return;
      st.pendingDelta = e.clientY - st.startY;
      if (!st.captured) {
        if (Math.abs(st.pendingDelta) < DRAG_START_THRESHOLD_PX) return;
        st.captured = true;
        setDragging(true);
        rootRef.current?.setPointerCapture?.(e.pointerId);
      }
      if (st.rafId !== null) return;
      st.rafId = requestAnimationFrame(() => {
        st.rafId = null;
        const next = dragDeltaToYOffset(st.startOffset, st.pendingDelta, st.containerHeight);
        setYOffsetPercent(next);
      });
    },
    [rootRef, setYOffsetPercent],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      const st = dragState.current;
      if (!st) return;
      if (st.rafId !== null) {
        cancelAnimationFrame(st.rafId);
        st.rafId = null;
      }
      dragState.current = null;
      setDragging(false);
      if (!st.captured) return;
      const finalDelta = e.clientY - st.startY;
      // Release ở đâu giữ nguyên đó — chỉ clamp 0-95%, không snap (theo yêu cầu).
      const next = dragDeltaToYOffset(st.startOffset, finalDelta, st.containerHeight);
      setYOffsetPercent(next);
      onDragReposition?.(next);
      const root = rootRef.current;
      if (root?.hasPointerCapture?.(e.pointerId)) {
        root.releasePointerCapture(e.pointerId);
      }
    },
    [rootRef, onDragReposition, setYOffsetPercent],
  );

  return { dragging, handlePointerDown, handlePointerMove, handlePointerUp };
}
