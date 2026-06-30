import { createDragHandle } from '@/features/subtitle/ui/subtitleDragPosition';

// jsdom does not define PointerEvent — polyfill for tests
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit & { clientY?: number; bubbles?: boolean } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
(globalThis as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;

/**
 * Helper: simulate createOverlayLayer output (overlay with ARIA + text span child).
 * createDragHandle only wires Pointer Events — ARIA/text span are createOverlayLayer's job.
 */
function makeOverlay(initialOffset: number): { overlay: HTMLDivElement; textSpan: HTMLSpanElement } {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'slider');
  overlay.setAttribute('aria-orientation', 'vertical');
  overlay.setAttribute('aria-valuemin', '0');
  overlay.setAttribute('aria-valuemax', '95');
  overlay.setAttribute('aria-valuenow', String(initialOffset));
  overlay.style.cursor = 'ns-resize';
  const textSpan = document.createElement('span');
  textSpan.setAttribute('data-testid', 'overlay-target-text');
  overlay.appendChild(textSpan);
  return { overlay, textSpan };
}

function makeContainer(height = 600): HTMLElement {
  const container = document.createElement('div');
  container.getBoundingClientRect = () => ({ height, width: 800, top: 0, left: 0, right: 800, bottom: height, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  return container;
}

describe('createDragHandle (ADR-015: drag wired on overlay background)', () => {
  it('returns overlay element (DIV, not button) — drag target is overlay itself', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    const returned = createDragHandle(overlay, container, 10, () => {});
    expect(returned.tagName).toBe('DIV');
    expect(returned).toBe(overlay);
  });

  it('updates overlay bottom style and calls onDrag on pointermove', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    let lastDraggedOffset = -1;
    createDragHandle(overlay, container, 10, (newOffset) => {
      lastDraggedOffset = newOffset;
    });

    // pointerdown on overlay background (target = overlay)
    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    // pointermove drag UP 60px (clientY 100→40) on 600px = +10% → 10 + 10 = 20
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(overlay.style.bottom).toBe('20%');
    expect(lastDraggedOffset).toBe(20);
  });

  it('clamps offset to 0-95 range', () => {
    const { overlay } = makeOverlay(90);
    const container = makeContainer();
    let lastDraggedOffset = -1;
    createDragHandle(overlay, container, 90, (newOffset) => {
      lastDraggedOffset = newOffset;
    });

    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 700, bubbles: true }));
    // Drag UP 600px (clientY 700→100) = +100% → 90 + 100 = 190 → clamp 95
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 100 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(lastDraggedOffset).toBe(95);
  });

  it('updates aria-valuenow on overlay after drag', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    createDragHandle(overlay, container, 10, () => {});

    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    // Drag UP 30px (clientY 100→70) on 600px = +5% → 10 + 5 = 15
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 70 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(overlay.getAttribute('aria-valuenow')).toBe('15');
  });

  it('second drag starts from current offset, not initial offset', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    createDragHandle(overlay, container, 10, () => {});

    // Drag 1: UP 60px (clientY 100→40) on 600px = +10% → 10 + 10 = 20
    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 }));
    document.dispatchEvent(new PointerEvent('pointerup'));
    expect(overlay.style.bottom).toBe('20%');

    // Drag 2: UP another 60px (clientY 40→-20) on 600px = +10% → 20 + 10 = 30
    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 40, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: -20 }));
    document.dispatchEvent(new PointerEvent('pointerup'));
    expect(overlay.style.bottom).toBe('30%');
  });

  it('intermediate pointermove events do not double-count delta', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    createDragHandle(overlay, container, 10, () => {});

    // Drag UP 60px with 3 intermediate pointermove events (realistic drag).
    // Each pointermove fires with deltaY from startClientY. Base must be the
    // snapshot at pointerdown (startOffset), not the live currentOffset —
    // otherwise each move adds the full delta on top of the already-moved offset.
    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 80 })); // deltaY -20 → +3.33%
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 60 })); // deltaY -40 → +6.67%
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 })); // deltaY -60 → +10%
    document.dispatchEvent(new PointerEvent('pointerup'));
    // Expected: 10 + 10 = 20 (NOT 10 + 3.33 + 6.67 + 10 = 30 from double-count)
    expect(overlay.style.bottom).toBe('20%');
  });

  it('ignores pointermove when not in drag mode', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    let dragCalled = false;
    createDragHandle(overlay, container, 10, () => {
      dragCalled = true;
    });

    // pointermove without pointerdown first → should not trigger drag
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 160 }));
    expect(dragCalled).toBe(false);
    expect(overlay.style.bottom).toBe('');
  });

  it('ADR-015 D1: pointerdown on text span does NOT trigger drag (select text preserved)', () => {
    const { overlay, textSpan } = makeOverlay(10);
    const container = makeContainer();
    let dragCalled = false;
    createDragHandle(overlay, container, 10, () => {
      dragCalled = true;
    });

    // pointerdown targets text span (bubbles up to overlay listener, but e.target === textSpan)
    textSpan.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(dragCalled).toBe(false);
    expect(overlay.style.bottom).toBe('');
  });

  it('ADR-015 D1: cursor becomes grabbing during drag, restored to ns-resize on pointerup', () => {
    const { overlay } = makeOverlay(10);
    const container = makeContainer();
    createDragHandle(overlay, container, 10, () => {});

    expect(overlay.style.cursor).toBe('ns-resize'); // hover affordance

    overlay.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    expect(overlay.style.cursor).toBe('grabbing'); // dragging affordance

    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 70 }));
    document.dispatchEvent(new PointerEvent('pointerup'));
    expect(overlay.style.cursor).toBe('ns-resize'); // restored
  });
});
