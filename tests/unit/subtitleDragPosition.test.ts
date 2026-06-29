import { createDragHandle } from '@/content/subtitleDragPosition';

// jsdom does not define PointerEvent — polyfill for tests
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit & { clientY?: number; bubbles?: boolean } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
(globalThis as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;

describe('createDragHandle', () => {
  it('returns button element with correct aria attributes', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    const handle = createDragHandle(overlay, container, 10, () => {});
    expect(handle.tagName).toBe('BUTTON');
    expect(handle.getAttribute('role')).toBe('slider');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Drag to move subtitle');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
    expect(handle.getAttribute('aria-valuemax')).toBe('95');
  });

  it('sets aria-valuenow to initial offset', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    const handle = createDragHandle(overlay, container, 25, () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('25');
  });

  it('updates overlay bottom style and calls onDrag on pointermove', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
    let lastDraggedOffset = -1;
    const handle = createDragHandle(overlay, container, 10, (newOffset) => {
      lastDraggedOffset = newOffset;
    });

    // Simulate pointerdown
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    // Simulate pointermove drag UP 60px (clientY 100→40) on 600px = +10% → 10 + 10 = 20
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 }));
    // Simulate pointerup
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(overlay.style.bottom).toBe('20%');
    expect(lastDraggedOffset).toBe(20);
  });

  it('clamps offset to 0-95 range', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
    let lastDraggedOffset = -1;
    const handle = createDragHandle(overlay, container, 90, (newOffset) => {
      lastDraggedOffset = newOffset;
    });

    handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 700, bubbles: true }));
    // Drag UP 600px (clientY 700→100) = +100% → 90 + 100 = 190 → clamp 95
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 100 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    expect(lastDraggedOffset).toBe(95);
  });

  it('updates aria-valuenow after drag', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
    const handle = createDragHandle(overlay, container, 10, () => {});

    handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    // Drag UP 30px (clientY 100→70) on 600px = +5% → 10 + 5 = 15
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 70 }));
    document.dispatchEvent(new PointerEvent('pointerup'));

    // delta -30px up on 600px = +5% → 10 + 5 = 15
    expect(handle.getAttribute('aria-valuenow')).toBe('15');
  });

  it('ignores pointermove when not in drag mode', () => {
    const overlay = document.createElement('div');
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
    let dragCalled = false;
    createDragHandle(overlay, container, 10, () => {
      dragCalled = true;
    });

    // pointermove without pointerdown first → should not trigger drag
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: 160 }));
    expect(dragCalled).toBe(false);
    expect(overlay.style.bottom).toBe('');
  });
});
