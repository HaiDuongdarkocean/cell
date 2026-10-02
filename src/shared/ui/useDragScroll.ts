import { useEffect, useState } from 'react';

const DRAG_THRESHOLD = 4;

export function useDragScroll<T extends HTMLElement = HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;

    let startX = 0;
    let startLeft = 0;
    let pointerId = -1;
    let dragging = false;
    let suppressClick = false;

    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return;
        if (el.scrollWidth <= el.clientWidth) return;
        dragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.userSelect = 'none';
      }
      el.scrollLeft = startLeft - (e.clientX - startX);
    };

    const endDrag = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      if (!dragging) return;
      dragging = false;
      suppressClick = true;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.userSelect = '';
    };

    const onClickCapture = (e: MouseEvent): void => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent): void => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      el.scrollLeft += delta;
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('click', onClickCapture, true);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [el]);

  return setEl;
}
