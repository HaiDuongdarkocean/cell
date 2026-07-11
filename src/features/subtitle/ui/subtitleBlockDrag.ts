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

  const isExcluded = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('.subtitle-line, .cluster-btn') !== null;
  };

  const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

  const onPointerDown = (e: PointerEvent): void => {
    if (isExcluded(e.target)) return;
    dragging = true;
    startClientY = e.clientY;
    startOffset = options.getYOffset();
    currentOffset = startOffset;
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
    const deltaY = e.clientY - startClientY;
    const rect = container.getBoundingClientRect();
    const deltaPercent = (deltaY / rect.height) * 100;
    const value = clamp(startOffset + deltaPercent, 0, 95);
    if (value === currentOffset) return;
    currentOffset = value;
    options.setYOffset(value);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    block.classList.remove('dragging');
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
    block.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  };
}
