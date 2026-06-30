import { calcYOffsetPercent } from './subtitleUI';

/**
 * Wire drag directly on overlay background (ADR-015 D1-D2).
 * Native Pointer Events (mouse + touch), pure calcYOffsetPercent for math.
 * Overlay is the drag target; text span keeps user-select: text (skipped via
 * e.target === textSpan check). setPointerCapture keeps drag smooth when
 * pointer crosses text span.
 *
 * @param overlay - Overlay div to drag (sets bottom %) — ARIA role=slider on this element
 * @param container - Video wrapper (for height measurement)
 * @param initialOffset - Starting Y-offset percent (0-95)
 * @param onDrag - Callback with new Y-offset percent (debounced 50ms)
 * @returns overlay (for chaining)
 */
export function createDragHandle(
  overlay: HTMLDivElement,
  container: HTMLElement,
  initialOffset: number,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLDivElement {
  return wireDrag(overlay, container, initialOffset, onDrag);
}

/**
 * Wire Pointer Events to overlay. Returns the overlay (for chaining).
 * ponytail: closure-based state (startClientY, currentOffset) — no class needed.
 * ADR-015 D1: e.target === textSpan check skips drag (text span keeps select text).
 */
function wireDrag(
  overlay: HTMLDivElement,
  container: HTMLElement,
  initialOffset: number,
  onDrag: (newYOffsetPercent: number) => void,
): HTMLDivElement {
  let dragging = false;
  let startClientY = 0;
  let startOffset = initialOffset; // snapshot at pointerdown — base for delta calc
  let currentOffset = initialOffset; // live position — snapshot source for next drag
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    // ADR-015 D1: skip drag if pointerdown originated on text span (select text + tra cứu)
    const textSpan = overlay.querySelector('span[data-testid]');
    if (textSpan && e.target === textSpan) return;

    dragging = true;
    startClientY = e.clientY;
    // Snapshot current position as the base for this drag. Using `currentOffset`
    // (not `initialOffset`) means consecutive drags start from the last position.
    // `startOffset` stays fixed during the drag so `deltaY` from `startClientY`
    // is applied exactly once (no double-count across intermediate pointermove).
    startOffset = currentOffset;
    overlay.style.cursor = 'grabbing'; // ADR-015 D1: cursor affordance during drag
    try {
      overlay.setPointerCapture(e.pointerId);
    } catch {
      // ponytail: setPointerCapture may throw in test env — ignore
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const deltaY = e.clientY - startClientY;
    const rect = container.getBoundingClientRect();
    const newOffset = calcYOffsetPercent(deltaY, rect.height, startOffset);
    currentOffset = newOffset;

    // Update overlay position immediately (visual feedback)
    overlay.style.bottom = `${newOffset}%`;
    overlay.setAttribute('aria-valuenow', String(newOffset));

    // Debounce onDrag callback (50ms — avoid spamming storage.set)
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onDrag(newOffset);
    }, 50);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    overlay.style.cursor = 'ns-resize'; // restore hover affordance
    try {
      overlay.releasePointerCapture(e.pointerId);
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

  overlay.addEventListener('pointerdown', onPointerDown);
  // Listen on document (pointer may move outside overlay during drag)
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  return overlay;
}
