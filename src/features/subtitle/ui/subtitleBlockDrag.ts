export interface BlockDragOptions {
  getYOffset: () => number;
  setYOffset: (value: number) => void;
  onStart?: () => void;
  onEnd?: (value: number) => void;
}

export function wireBlockDrag(
  block: HTMLElement,
  container: HTMLElement,
  options: BlockDragOptions,
): () => void {
  let dragging = false;
  let startClientY = 0;
  let startOffset = 0;
  let currentOffset = 0;
  // Cached at pointerdown so pointermove never reads layout (getBoundingClientRect
  // forces reflow). The container rect is stable for the drag duration.
  let containerRect: DOMRect | null = null;
  // rAF throttle: stash the latest Y delta and apply once per animation frame,
  // aligning movement to the display refresh and cutting style recalcs from
  // N-per-frame to 1. pointermove can fire >100Hz on high-rate devices.
  let pendingDeltaY = 0;
  let moveRaf = 0;

  const isExcluded = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('.subtitle-line, .cluster-btn') !== null;
  };

  const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

  /** Apply the cached drag delta as a compositor-only translateY override.
   *  The base CSS is `transform: translateY(-50%)` (centering); we add the drag
   *  delta on top so the block tracks the cursor without triggering layout/paint
   *  (transform is compositor-only, unlike `top`/`--sb-top` which force layout). */
  const applyDrag = (): void => {
    if (!containerRect) return;
    const deltaPercent = (pendingDeltaY / containerRect.height) * 100;
    const value = clamp(startOffset + deltaPercent, 0, 95);
    if (value === currentOffset) return;
    currentOffset = value;
    const deltaPx = (value - startOffset) * containerRect.height / 100;
    block.style.transform = `translateY(calc(-50% + ${deltaPx}px))`;
  };

  const flushDrag = (): void => {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    applyDrag();
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (isExcluded(e.target)) return;
    dragging = true;
    startClientY = e.clientY;
    startOffset = options.getYOffset();
    currentOffset = startOffset;
    containerRect = container.getBoundingClientRect();
    pendingDeltaY = 0;
    block.classList.add('dragging');
    options.onStart?.();
    try {
      block.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture may throw in test environments — ignore
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    pendingDeltaY = e.clientY - startClientY;
    if (!moveRaf) {
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        applyDrag();
      });
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    // Apply any pending move synchronously so currentOffset is final.
    flushDrag();
    dragging = false;
    block.classList.remove('dragging');
    // Bake: restore the base transform, then persist the final offset via
    // --sb-top. Both are sync writes in the same tick — the browser batches
    // them into one render, so there is no visual jump between transform
    // clearing and --sb-top updating.
    block.style.transform = '';
    options.setYOffset(currentOffset);
    containerRect = null;
    try {
      block.releasePointerCapture(e.pointerId);
    } catch {
      // releasePointerCapture may throw in test environments — ignore
    }
    options.onEnd?.(currentOffset);
  };

  block.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);

  return () => {
    if (moveRaf) cancelAnimationFrame(moveRaf);
    block.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  };
}
