// regionSelector tests — regression guards for the two browser-test bugs:
// 1. Handles lost their mousedown listeners after the first drag (render() recreated
//    handle nodes without rebinding) — move then resize must BOTH work.
// 2. Long-decimal percentages in the label (29.722222%) — formatPct rounds.

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { RegionSelector, defaultBottomRegion, formatPct } from './regionSelector';
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

const REGION: CustomRegion = { xPct: 20, yPct: 30, widthPct: 50, heightPct: 30 };
/** Full-height region: on the 1000px fake box, dragging +100px = +10% of BOTH container and region → ratio +0.1. */
const FULL_HEIGHT: CustomRegion = { xPct: 0, yPct: 0, widthPct: 100, heightPct: 100 };

/** jsdom layout is all zeros — give the overlay container a 1000×1000 box. */
function fakeBox(): DOMRect {
  return { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, toJSON: () => ({}) } as DOMRect;
}

function fire(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, view: window }));
}

/** Drag math reads the CONTAINER box (a separate node from parent) — mock it too. */
function containerOf(scope: HTMLElement): HTMLDivElement {
  const c = scope.querySelector('.cell-ocr-region-selector') as HTMLDivElement;
  c.getBoundingClientRect = fakeBox;
  return c;
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
    containerOf(parent);
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
    const container = containerOf(parent);
    const rect = parent.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    // Draw starts on a container press OUTSIDE the rect (pressing the rect body moves it).
    fire(container, 'mousedown', 250, 500);
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
    containerOf(parent);
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

  it('split: setSplit renders halves + divider; drag updates ratio & fires onSplitRatioChange once on mouseup', () => {
    const splitRatios: number[] = [];
    const sel2 = new RegionSelector({
      onRegionChange: () => {},
      onApply: () => {},
      onCancel: () => {},
      onSplitRatioChange: (r) => { splitRatios.push(r); },
    });
    sel2.attach(video, FULL_HEIGHT, 'view');
    // In jsdom every box is 0×0, so the container walk stops AT the video —
    // the divider drag reads the CONTAINER's parent box, i.e. the video here.
    video.getBoundingClientRect = fakeBox;
    sel2.setSplit(true, 0.5, 'Target', 'Native');
    const halves = [...parent.querySelectorAll('.cell-ocr-split-half')] as HTMLDivElement[];
    expect(halves).toHaveLength(2);
    expect(halves[0]?.dataset.label).toBe('Target');
    expect(halves[1]?.dataset.label).toBe('Native');
    // 50/50 of a full-height region → halves at 0%/50%, divider centered on the split line.
    expect(halves[0]?.style.height).toBe('50%');
    expect(halves[1]?.style.top).toBe('50%');
    const divider = parent.querySelector('.cell-ocr-split-divider') as HTMLDivElement;
    expect(divider).not.toBeNull();
    expect(divider.style.top).toBe('50%');

    fire(divider, 'mousedown', 500, 500);
    fire(document, 'mousemove', 500, 600); // +10% of container height
    expect(splitRatios).toHaveLength(0); // real-time drag updates UI only — no callback
    fire(document, 'mouseup', 500, 600);
    expect(splitRatios).toHaveLength(1); // persisted exactly once, on mouseup
    expect(splitRatios[0]).toBeGreaterThan(0.55);
    expect(splitRatios[0]).toBeLessThan(0.65);

    // Node identity (ADR-081): updateSplitRatio repositions, never recreates.
    sel2.updateSplitRatio(0.3);
    expect(parent.querySelector('.cell-ocr-split-divider')).toBe(divider);
    expect(parent.querySelector('.cell-ocr-split-half')).toBe(halves[0]);
    expect(divider.style.top).toBe('30%');
    sel2.detach();
  });

  it('split: divider + halves visible in view+edit, hidden in select; setSplit(false) removes nodes', () => {
    const sel2 = new RegionSelector({ onRegionChange: () => {}, onApply: () => {}, onCancel: () => {} });
    sel2.attach(video, FULL_HEIGHT, 'view');
    sel2.setSplit(true, 0.5, 'Target', 'Native');
    const divider = parent.querySelector('.cell-ocr-split-divider') as HTMLDivElement;
    const halves = [...parent.querySelectorAll('.cell-ocr-split-half')] as HTMLDivElement[];
    expect(divider.style.display).not.toBe('none');

    // edit mode: split stays visible so user can see target/native while adjusting.
    sel2.setMode('edit');
    expect(divider.style.display).not.toBe('none');
    for (const h of halves) expect(h.style.display).not.toBe('none');

    // select mode: user is drawing a brand-new region — split hidden.
    sel2.setMode('select');
    expect(divider.style.display).toBe('none');
    for (const h of halves) expect(h.style.display).toBe('none');

    sel2.setMode('view');
    expect(divider.style.display).not.toBe('none');
    for (const h of halves) expect(h.style.display).not.toBe('none');

    sel2.setSplit(false, 0.5);
    expect(parent.querySelectorAll('.cell-ocr-split-half')).toHaveLength(0);
    expect(parent.querySelector('.cell-ocr-split-divider')).toBeNull();
    sel2.detach();
  });
});

// ─── Intrinsic-space contract (regionMapping wiring) ───
// Proves the selector's public API is intrinsic-space and that the overlay
// rectangle is positioned in SHELL space so it visually aligns with the actual
// video content — the fix for "OCR scan sai vùng".
describe('RegionSelector intrinsic-space contract (letterbox)', () => {
  let shell: HTMLDivElement;
  let vid: HTMLVideoElement;
  let computeSpy: ReturnType<typeof jest.spyOn>;

  /** 4:3 container (1200×900) with a 16:9 video (1920×1080) + object-fit: contain.
   *  Video content = 1200×675 centered → 112.5px black bars top & bottom. */
  function setupLetterbox(objectFit = 'contain'): void {
    shell = document.createElement('div');
    vid = document.createElement('video');
    shell.appendChild(vid);
    document.body.appendChild(shell);
    // Intrinsic resolution (readonly in jsdom → defineProperty).
    Object.defineProperty(vid, 'videoWidth', { configurable: true, get: () => 1920 });
    Object.defineProperty(vid, 'videoHeight', { configurable: true, get: () => 1080 });
    // Shell + video both 1200×900 (video inset:0 fills the shell).
    const box = (): DOMRect => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 900, width: 1200, height: 900, toJSON: () => ({}) } as DOMRect);
    shell.getBoundingClientRect = box;
    vid.getBoundingClientRect = box;
    // object-fit via getComputedStyle mock (jsdom doesn't implement it).
    computeSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      if (el === vid) {
        return { objectFit, objectPosition: '50% 50%' } as unknown as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
  }

  afterEach(() => {
    computeSpy?.mockRestore();
    shell?.remove();
  });

  /** Attach + give the overlay container a real rect (jsdom default is 0×0) then
   *  re-render so the shell↔intrinsic conversion uses the mocked geometry. */
  function attachWithGeometry(
    sel: RegionSelector,
    region: CustomRegion,
    mode: 'view' | 'select' | 'edit' = 'view',
  ): HTMLDivElement {
    sel.attach(vid, region, mode);
    const container = shell.querySelector('.cell-ocr-region-selector') as HTMLDivElement;
    container.getBoundingClientRect = shell.getBoundingClientRect;
    // Re-render with the now-correct container rect (attach's internal render
    // ran while the container rect was still 0×0 → identity).
    sel.updateRegion(region);
    return container;
  }

  it('attach with intrinsic bottom-15% renders the rectangle at the SHELL-space content bottom (NOT 85%)', () => {
    setupLetterbox('contain');
    const intrinsicBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const sel = new RegionSelector({ onRegionChange: () => {}, onApply: () => {}, onCancel: () => {} });
    attachWithGeometry(sel, intrinsicBottom, 'view');
    const rect = shell.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    // Shell-space: content bottom-15% sits at y 76.25% (not 85%) because of the
    // 112.5px top bar; height 11.25% (not 15%) because content is shorter than shell.
    expect(parseFloat(rect.style.top)).toBeCloseTo(76.25, 3);
    expect(parseFloat(rect.style.height)).toBeCloseTo(11.25, 3);
    expect(parseFloat(rect.style.left)).toBeCloseTo(0, 3);
    expect(parseFloat(rect.style.width)).toBeCloseTo(100, 3);
    sel.detach();
  });

  it('getRegion() returns the intrinsic-space region back (round-trip)', () => {
    setupLetterbox('contain');
    const intrinsicBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const sel = new RegionSelector({ onRegionChange: () => {}, onApply: () => {}, onCancel: () => {} });
    attachWithGeometry(sel, intrinsicBottom, 'view');
    const back = sel.getRegion();
    expect(back.xPct).toBeCloseTo(0, 3);
    expect(back.yPct).toBeCloseTo(85, 3);
    expect(back.widthPct).toBeCloseTo(100, 3);
    expect(back.heightPct).toBeCloseTo(15, 3);
    sel.detach();
  });

  it('drawing a region over the visible content bottom emits intrinsic ~{0,85,100,15}', () => {
    setupLetterbox('contain');
    const changes: CustomRegion[] = [];
    const sel = new RegionSelector({ onRegionChange: (r) => { changes.push(r); }, onApply: () => {}, onCancel: () => {} });
    const container = attachWithGeometry(sel, { xPct: 0, yPct: 0, widthPct: 100, heightPct: 100 }, 'select');
    // Draw over the visible content bottom band: shell y 686.25..787.5 (= content bottom 15%).
    fire(container, 'mousedown', 0, 686.25);
    fire(document, 'mousemove', 1200, 787.5);
    fire(document, 'mouseup', 1200, 787.5);
    const emitted = changes.at(-1)!;
    expect(emitted.xPct).toBeCloseTo(0, 2);
    expect(emitted.yPct).toBeCloseTo(85, 2);
    expect(emitted.widthPct).toBeCloseTo(100, 2);
    expect(emitted.heightPct).toBeCloseTo(15, 2);
    sel.detach();
  });

  it('object-fit fill (no letterbox) → intrinsic region renders unchanged (identity)', () => {
    setupLetterbox('fill');
    const r: CustomRegion = { xPct: 20, yPct: 30, widthPct: 50, heightPct: 30 };
    const sel = new RegionSelector({ onRegionChange: () => {}, onApply: () => {}, onCancel: () => {} });
    attachWithGeometry(sel, r, 'view');
    const rect = shell.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    expect(parseFloat(rect.style.left)).toBeCloseTo(20, 3);
    expect(parseFloat(rect.style.top)).toBeCloseTo(30, 3);
    expect(parseFloat(rect.style.width)).toBeCloseTo(50, 3);
    expect(parseFloat(rect.style.height)).toBeCloseTo(30, 3);
    sel.detach();
  });

  it('21:9 container (letterbox top/bottom) — vertical 1:1, horizontal shifts', () => {
    // 21:9 container 1890×810, 16:9 video contain → content 1440×810, cx=225, cy=0.
    shell = document.createElement('div');
    vid = document.createElement('video');
    shell.appendChild(vid);
    document.body.appendChild(shell);
    Object.defineProperty(vid, 'videoWidth', { configurable: true, get: () => 1920 });
    Object.defineProperty(vid, 'videoHeight', { configurable: true, get: () => 1080 });
    const box = (): DOMRect => ({ x: 0, y: 0, left: 0, top: 0, right: 1890, bottom: 810, width: 1890, height: 810, toJSON: () => ({}) } as DOMRect);
    shell.getBoundingClientRect = box;
    vid.getBoundingClientRect = box;
    computeSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      if (el === vid) return { objectFit: 'contain', objectPosition: '50% 50%' } as unknown as CSSStyleDeclaration;
      return {} as CSSStyleDeclaration;
    });
    const intrinsicBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const sel = new RegionSelector({ onRegionChange: () => {}, onApply: () => {}, onCancel: () => {} });
    attachWithGeometry(sel, intrinsicBottom, 'view');
    const rect = shell.querySelector('.cell-ocr-region-rect') as HTMLDivElement;
    // Vertical 1:1 (no top/bottom bar): top=85%, height=15%.
    expect(parseFloat(rect.style.top)).toBeCloseTo(85, 3);
    expect(parseFloat(rect.style.height)).toBeCloseTo(15, 3);
    // Horizontal: content left = 225px = 11.9% of shell; width = 1440px = 76.19%.
    expect(parseFloat(rect.style.left)).toBeCloseTo(225 / 1890 * 100, 2);
    expect(parseFloat(rect.style.width)).toBeCloseTo(1440 / 1890 * 100, 2);
    // getRegion round-trips to the intrinsic input.
    const back = sel.getRegion();
    expect(back.yPct).toBeCloseTo(85, 2);
    expect(back.heightPct).toBeCloseTo(15, 2);
    sel.detach();
  });
});
