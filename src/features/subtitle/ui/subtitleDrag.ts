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
const COLLAPSED_CLUSTER_SELECTOR = '[data-cell-id="nav-expand"]';

// ADR-025: drag-to-reposition theo trục Y. Pointer Events + rAF throttle +
// transform (atom ux-drag-transform-willchange-raf). touch-action:none trên .root
// (atom ux-touch-action-none-for-pointer-drag). .root có pointer-events:none —
// click xuyên xuống video (atom overlay-band-pointer-events-swallow-touch-taps).
// Drag triggers: subtitle-block + collapsed nav-expand pill — cả hai deferred
// (capture sau |deltaY| >= 8px) để tap/click vẫn thành word lookup / expand,
// và horizontal mouse drag vẫn select text.
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
      if (!(target instanceof Element)) return;
      const isDeferredStart =
        target.closest(SUBTITLE_BLOCK_SELECTOR) !== null ||
        target.closest(COLLAPSED_CLUSTER_SELECTOR) !== null;
      if (!isDeferredStart) return;
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
        captured: false,
      };
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
        e.preventDefault();
        const root = rootRef.current;
        root?.setPointerCapture?.(e.pointerId);
        const scope = (root?.getRootNode() ?? document) as Document;
        scope.getSelection?.()?.removeAllRanges();
        window.getSelection?.()?.removeAllRanges();
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
