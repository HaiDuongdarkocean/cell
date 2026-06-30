import { calcYOffsetPercent } from './subtitleUI';

/**
 * Drag handle for subtitle overlay position (ADR-013 D4).
 * Native Pointer Events (mouse + touch), pure calcYOffsetPercent for math.
 * Handle pointer-events: auto, text span keeps user-select: text (no conflict).
 *
 * @param overlay - Overlay div to move (sets bottom %)
 * @param container - Video wrapper (for height measurement)
 * @param initialOffset - Starting Y-offset percent (0-95)
 * @param onDrag - Callback with new Y-offset percent (debounced 50ms)
 * @returns Drag handle button element (already in overlay)
 */
export function createDragHandle(
  overlay: HTMLDivElement,
  container: HTMLElement,
  initialOffset: number,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLButtonElement {
  // Find existing handle in overlay (created by createOverlayLayer)
  const handle = overlay.querySelector('[role="slider"]') as HTMLButtonElement | null;
  if (!handle) {
    // Fallback: create new handle if overlay doesn't have one
    const newHandle = document.createElement('button');
    newHandle.setAttribute('role', 'slider');
    newHandle.setAttribute('aria-orientation', 'vertical');
    newHandle.setAttribute('aria-label', 'Drag to move subtitle');
    newHandle.setAttribute('aria-valuemin', '0');
    newHandle.setAttribute('aria-valuemax', '95');
    newHandle.setAttribute('aria-valuenow', String(initialOffset));
    overlay.appendChild(newHandle);
    return wireDrag(newHandle, overlay, container, initialOffset, onDrag);
  }

  handle.setAttribute('aria-valuenow', String(initialOffset));
  return wireDrag(handle, overlay, container, initialOffset, onDrag);
}

/**
 * Wire Pointer Events to handle. Returns the handle (for chaining).
 * ponytail: closure-based state (startClientY, currentOffset) — no class needed.
 */
function wireDrag(
  handle: HTMLButtonElement,
  overlay: HTMLDivElement,
  container: HTMLElement,
  initialOffset: number,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLButtonElement {
  let dragging = false;
  let startClientY = 0;
  let currentOffset = initialOffset;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    dragging = true;
    startClientY = e.clientY;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ponytail: setPointerCapture may throw in test env — ignore
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const deltaY = e.clientY - startClientY;
    const rect = container.getBoundingClientRect();
    const newOffset = calcYOffsetPercent(deltaY, rect.height, currentOffset);
    currentOffset = newOffset;

    // Update overlay position immediately (visual feedback)
    overlay.style.bottom = `${newOffset}%`;
    handle.setAttribute('aria-valuenow', String(newOffset));

    // Debounce onDrag callback (50ms — avoid spamming storage.set)
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onDrag(newOffset);
    }, 50);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      // ponytail: releasePointerCapture may throw in test env — ignore
    }
    // Final persist (flush debounce)
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    onDrag(currentOffset);
  };

  handle.addEventListener('pointerdown', onPointerDown);
  // Listen on document (pointer may move outside handle during drag)
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  return handle;
}
