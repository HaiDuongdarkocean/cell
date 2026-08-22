// regionSelector tests — regression guards for the two browser-test bugs:
// 1. Handles lost their mousedown listeners after the first drag (render() recreated
//    handle nodes without rebinding) — move then resize must BOTH work.
// 2. Long-decimal percentages in the label (29.722222%) — formatPct rounds.

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { RegionSelector, defaultBottomRegion, formatPct } from './regionSelector';
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

const REGION: CustomRegion = { xPct: 20, yPct: 30, widthPct: 50, heightPct: 30 };

/** jsdom layout is all zeros — give the overlay container a 1000×1000 box. */
function fakeBox(): DOMRect {
  return { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, toJSON: () => ({}) } as DOMRect;
}

function fire(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window }));
}

describe('helpers', () => {
  it('defaultBottomRegion centers width and pins to bottom', () => {
    expect(defaultBottomRegion(15)).toEqual({ xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 });
    expect(defaultBottomRegion(30, 60)).toEqual({ xPct: 20, yPct: 70, widthPct: 60, heightPct: 30 });
  });

  it('formatPct rounds long drag decimals', () => {
    expect(formatPct(29.72222222222222)).toBe(30);
    expect(formatPct(49.4)).toBe(49);
    expect(formatPct(100)).toBe(100);
  });
});

describe('RegionSelector', () => {
  let parent: HTMLDivElement;
  let video: HTMLVideoElement;
  let selector: RegionSelector;
  let changes: CustomRegion[];
  let applied: number;
  let cancelled: number;

  beforeEach(() => {
    parent = document.createElement('div');
    video = document.createElement('video');
    parent.appendChild(video);
    document.body.appendChild(parent);
    parent.getBoundingClientRect = fakeBox;
    changes = [];
    applied = 0;
    cancelled = 0;
    selector = new RegionSelector({
      onRegionChange: (r) => { changes.push(r); },
      onApply: () => { applied++; },
      onCancel: () => { cancelled++; },
    });
  });

  afterEach(() => {
    selector.detach();
    parent.remove();
  });

  it('attach renders view-mode rectangle with rounded label', () => {
    selector.attach(video, REGION, 'view');
    const rect = parent.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    expect(rect).not.toBeNull();
    expect(rect.dataset.mode).toBe('view');
    expect(rect.style.left).toBe('20%');
    expect(rect.style.width).toBe('50%');
    expect(rect.querySelector('.cell-ocr-region-label')?.textContent).toBe('OCR region (50%×30%)');
    expect(parent.querySelectorAll('[data-handle]')).toHaveLength(0);
    expect(parent.querySelectorAll('.cell-ocr-region-btn')).toHaveLength(0);
  });

  it('edit mode creates 8 handles and Apply/Cancel buttons', () => {
    selector.attach(video, REGION, 'edit');
    const handles = [...parent.querySelectorAll('[data-handle]')] as HTMLDivElement[];
    expect(handles.map(h => h.dataset.handle)).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
    const btns = [...parent.querySelectorAll('.cell-ocr-region-btn')].map(b => b.textContent);
    expect(btns).toEqual(['Apply', 'Cancel']);
  });

  it('regression: resize handles stay live AFTER a move drag (bug: render() recreated handles without rebinding)', () => {
    selector.attach(video, REGION, 'edit');
    const rect = parent.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    const handleBefore = parent.querySelector('[data-handle="se"]') as HTMLDivElement;

    // Move drag: press rect center, move +10%/+10% (1000px box → 100px = 10%)
    fire(rect, 'mousedown', 450, 450);
    fire(document, 'mousemove', 550, 550);
    fire(document, 'mouseup', 550, 550);
    expect(rect.style.left).toBe('30%');
    expect(rect.style.top).toBe('40%');
    // size unchanged by a pure move
    expect(rect.style.width).toBe('50%');

    // THE BUG: handle was recreated by the move's render() → dead listener.
    const handleAfter = parent.querySelector('[data-handle="se"]') as HTMLDivElement;
    expect(handleAfter).toBe(handleBefore); // same node → listener still bound

    // Resize drag from se handle: +5%/+5% must still work
    fire(handleAfter, 'mousedown', 800, 700);
    fire(document, 'mousemove', 850, 750);
    fire(document, 'mouseup', 850, 750);
    expect(rect.style.left).toBe('30%');
    expect(rect.style.width).toBe('55%');
    expect(rect.style.height).toBe('35%');
  });

  it('select mode drag draws a new region from the press point', () => {
    selector.attach(video, REGION, 'select');
    // onSelectStart reads the CONTAINER box (not the outer parent) — mock it too.
    (parent.querySelector('.cell-ocr-region-selector') as HTMLDivElement).getBoundingClientRect = fakeBox;
    const rect = parent.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    fire(rect, 'mousedown', 250, 500);
    fire(document, 'mousemove', 750, 850);
    fire(document, 'mouseup', 750, 850);
    expect(rect.style.left).toBe('25%');
    expect(rect.style.top).toBe('50%');
    expect(rect.style.width).toBe('50%');
    expect(rect.style.height).toBe('35%');
    expect(changes.at(-1)).toEqual({ xPct: 25, yPct: 50, widthPct: 50, heightPct: 35 });
  });

  it('Apply commits pending region and fires callback; Cancel reverts render', () => {
    selector.attach(video, REGION, 'edit');
    const rect = parent.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    fire(rect, 'mousedown', 450, 450);
    fire(document, 'mousemove', 550, 550);
    fire(document, 'mouseup', 550, 550);

    const apply = [...parent.querySelectorAll('.cell-ocr-region-btn')].find(b => b.textContent === 'Apply') as HTMLButtonElement;
    apply.click();
    expect(applied).toBe(1);
    expect(changes.at(-1)).toEqual({ xPct: 30, yPct: 40, widthPct: 50, heightPct: 30 });
    // RegionSelector stays in edit mode — OcrSession switches to view on Apply.
    expect(rect.querySelector('.cell-ocr-region-label')?.textContent).toBe('edit: 50%×30%');
  });

  it('Esc fires cancel and view mode clears toolbar + handles', () => {
    selector.attach(video, REGION, 'edit');
    expect(document.body.dataset.ocrRegionSelecting).toBe('true');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(1);
    selector.setMode('view');
    expect(parent.querySelectorAll('[data-handle]')).toHaveLength(0);
    expect(parent.querySelectorAll('.cell-ocr-region-btn')).toHaveLength(0);
    expect(document.body.dataset.ocrRegionSelecting).toBeUndefined();
  });

  it('label node is reused across renders (no recreate → no flicker)', () => {
    selector.attach(video, REGION, 'view');
    const label1 = parent.querySelector('.cell-ocr-region-label');
    selector.updateRegion({ xPct: 10, yPct: 20, widthPct: 33.3, heightPct: 29.72222222222222 });
    const label2 = parent.querySelector('.cell-ocr-region-label');
    expect(label2).toBe(label1);
    expect(label2?.textContent).toBe('OCR region (33%×30%)');
  });
});
