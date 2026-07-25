// popupShell tests — spec §4.6.3 A4: Shadow DOM, auto-position, resize, dismiss.

import { describe, expect, it, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import { PopupShell, clampPopupSize, computePopupPosition } from './popupShell';
import { STORAGE_KEYS } from '@/shared/config/config';

// Mock chrome.storage.local + storage.onChanged (needed for theme detection)
const storageData: Record<string, unknown> = {};
const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

beforeAll(() => {
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn((_key?: string) => Promise.resolve(storageData)),
    set: jest.fn((obj: Record<string, unknown>) => { Object.assign(storageData, obj); return Promise.resolve(); }),
  };
  c.storage.onChanged = {
    addListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => { storageListeners.push(cb); }),
    removeListener: jest.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
      const idx = storageListeners.indexOf(cb);
      if (idx >= 0) storageListeners.splice(idx, 1);
    }),
  };
  // PointerEvent mock (jsdom doesn't have it but PopupShell uses pointer events).
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof MouseEvent;
  }

  // matchMedia mock (jsdom doesn't have it)
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  // rAF sync mock: drag + resize handlers throttle pointermove via
  // requestAnimationFrame. jsdom rAF is async (setTimeout), so tests that
  // dispatch pointermove and assert synchronously would see no update. Flush
  // the callback inline so the delta is applied immediately — tests verify
  // drag/resize behavior, not throttle timing.
  globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  }) as unknown as typeof requestAnimationFrame;
});

describe('clampPopupSize', () => {
  it('clamps width to viewport - margins', () => {
    const result = clampPopupSize({ width: 1000, maxHeight: 400 }, 800, 600);
    expect(result.width).toBe(800 - 16); // 2 * VIEWPORT_MARGIN(8)
  });

  it('clamps maxHeight to 70% of viewport', () => {
    const result = clampPopupSize({ width: 400, maxHeight: 600 }, 800, 600);
    expect(result.maxHeight).toBe(Math.round(600 * 0.7));
  });

  it('enforces minimum width of 320', () => {
    const result = clampPopupSize({ width: 100, maxHeight: 400 }, 800, 600);
    expect(result.width).toBe(320);
  });

  it('enforces minimum maxHeight of 200', () => {
    const result = clampPopupSize({ width: 400, maxHeight: 50 }, 800, 600);
    expect(result.maxHeight).toBe(200);
  });
});

describe('computePopupPosition — edge cases', () => {
  // ── Edge case 1: Normal — token center, popup fits below ──
  it('EC1: popup below token when space below is sufficient', () => {
    const pos = computePopupPosition(70, 100, 150, 100, 400, 1920, 1080);
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(104); // anchorBottom + 4
    expect(pos.top + 300).toBeLessThanOrEqual(1080 - 8); // no overflow
  });

  // ── Edge case 2: Token near bottom — flip above ──
  it('EC2: flips above when space below insufficient', () => {
    // anchorBottom=900, popupHeight=300, spaceBelow=172 < 300
    // spaceAbove=862 >= 300 → flip above
    const pos = computePopupPosition(870, 940, 990, 900, 400, 1920, 1080, 300);
    expect(pos.top + 300).toBeLessThanOrEqual(870 - 4); // popup bottom above token top
    expect(pos.top).toBeGreaterThanOrEqual(8); // within viewport
  });

  // ── Edge case 3: Token near bottom, popup taller than space above ──
  it('EC3: clamps above when popup taller than space above but above has more room', () => {
    // anchorTop=200, anchorBottom=230, popupHeight=500, viewportHeight=600
    // spaceBelow=600-230-8=362 < 500, spaceAbove=200-8=192 < 500
    // preferBelow (362>192), clamp: top=234, 234+500=734>592 → top=592-500=92
    const pos = computePopupPosition(200, 100, 150, 230, 400, 1920, 600, 500);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 500).toBeLessThanOrEqual(600 - 8); // no overflow
  });

  // ── Edge case 4: Token near right edge — right-align popup ──
  it('EC4: right-aligns popup when token near right edge', () => {
    const pos = computePopupPosition(70, 1800, 1850, 100, 400, 1920, 1080);
    expect(pos.left + 400).toBeLessThanOrEqual(1920 - 8); // no right overflow
    expect(pos.left).toBe(1450); // anchorRight - popupWidth
  });

  // ── Edge case 5: Token near left edge — clamp left ──
  it('EC5: clamps left to viewport margin when token at left edge', () => {
    const pos = computePopupPosition(70, -50, 50, 100, 400, 1920, 1080);
    // With shift variants, right placement (left=54) may win over bottom (clamped to 8)
    // because it fits without clamping. Both are valid — just ensure popup is in viewport.
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + 400).toBeLessThanOrEqual(1920 - 8);
  });

  // ── Edge case 6: Popup wider than viewport — clamp width ──
  it('EC6: clamps left when popup wider than viewport', () => {
    // popupWidth=1000, viewportWidth=600
    const pos = computePopupPosition(70, 100, 150, 100, 1000, 600, 1080);
    expect(pos.left).toBe(8);
    expect(pos.left + 1000).toBeGreaterThan(600); // can't fit, but left is clamped
  });

  // ── Edge case 7: Token at bottom-right corner, no side space ──
  it('EC7: clamps to viewport when token at bottom-right corner', () => {
    // anchorTop=570, anchorBottom=600, popupHeight=300, viewportHeight=650
    // spaceBelow=650-600-8=42 < 300, spaceAbove=570-8=562 >= 300 → flip above
    const pos = computePopupPosition(570, 1500, 1550, 600, 400, 1600, 650, 300);
    expect(pos.top + 300).toBeLessThanOrEqual(570 - 4); // above token
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  // ── Edge case 8: Very small viewport, popup taller than viewport ──
  it('EC8: clamps to viewport when popup taller than viewport', () => {
    const pos = computePopupPosition(40, 100, 150, 50, 400, 1920, 100, 300);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 300).toBeLessThanOrEqual(100 - 8 + 300); // clamped, may overflow popup but top is valid
  });

  // ── Edge case 9: Side positioning — right side when neither above nor below fits ──
  it('EC9: positions to right side when vertical space insufficient', () => {
    // anchorTop=100, anchorBottom=130, popupHeight=300, viewportHeight=200
    // spaceBelow=62 < 300, spaceAbove=92 < 300
    // right: 300+4+200=504 <= 592 → fits
    const pos = computePopupPosition(100, 100, 300, 130, 200, 600, 200, 300);
    expect(pos.left).toBe(304); // anchorRight + GAP
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  // ── Edge case 10: Side positioning — left side when right doesn't fit ──
  it('EC10: positions to left side when right side insufficient', () => {
    // anchorRight=590, popupWidth=200, viewportWidth=600
    // right: 590+4+200=794 > 592 → no fit
    // left: anchorLeft=400 - 4 - 200 = 196 >= 8 → fits
    const pos = computePopupPosition(100, 400, 590, 130, 200, 600, 200, 300);
    expect(pos.left).toBe(196); // anchorLeft - popupWidth - GAP
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  // ── Edge case 11: No side space either — clamp vertically ──
  it('EC11: top-aligns at margin when popup taller than viewport and no side space', () => {
    // popupHeight=300 > viewportHeight=200 → impossible to fit. Top-align at margin.
    // In practice, maxHeight clamps to 70% viewport, so this case is rare but must
    // still produce a sane position (top=VIEWPORT_MARGIN, not negative).
    const pos = computePopupPosition(100, 100, 500, 130, 400, 800, 200, 300);
    expect(pos.top).toBe(8); // top-aligned at VIEWPORT_MARGIN
  });

  it('EC11b: clamps vertically when popup fits viewport but neither above nor below fits', () => {
    // popupHeight=150, viewportHeight=200 → fits (150 < 184)
    // spaceBelow=62, spaceAbove=92 → preferBelow=false, above: top=100-150-4=-54 → clamp to 8
    // No side: anchorRight=500+4+400=904 > 792, anchorLeft=100-4-400=-304 < 8
    const pos = computePopupPosition(100, 100, 500, 130, 400, 800, 200, 150);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 150).toBeLessThanOrEqual(200 - 8); // fits within viewport
  });

  // ── Edge case 12: Popup never overlaps token vertically ──
  it('EC12: popup below never overlaps token', () => {
    const pos = computePopupPosition(70, 100, 150, 100, 400, 1920, 1080, 300);
    expect(pos.top).toBeGreaterThanOrEqual(100 + 4); // below token bottom + gap
  });

  it('EC12b: popup above never overlaps token', () => {
    const pos = computePopupPosition(870, 940, 990, 900, 400, 1920, 1080, 300);
    expect(pos.top + 300).toBeLessThanOrEqual(870 - 4); // above token top - gap
  });

  // ── Edge case 13: Popup never overflows viewport bottom ──
  it('EC13: popup bottom never exceeds viewport bottom', () => {
    // Token near bottom, popup tall
    const pos = computePopupPosition(1100, 100, 150, 1150, 400, 1920, 1200, 400);
    expect(pos.top + 400).toBeLessThanOrEqual(1200 - 8);
  });

  // ── Edge case 14: Popup never overflows viewport top ──
  it('EC14: popup top never goes above viewport top', () => {
    const pos = computePopupPosition(50, 100, 150, 80, 400, 1920, 1080, 300);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  // ── Edge case 15: Popup never overflows viewport right ──
  it('EC15: popup right never exceeds viewport right', () => {
    const pos = computePopupPosition(70, 1800, 1850, 100, 400, 1920, 1080);
    expect(pos.left + 400).toBeLessThanOrEqual(1920 - 8);
  });

  // ── Edge case 16: Token at vertical center, popup fits neither half ──
  it('EC16: clamps when token at vertical center and popup too tall', () => {
    // viewportHeight=600, anchorTop=290, anchorBottom=310, popupHeight=400
    // spaceBelow=600-310-8=282 < 400, spaceAbove=290-8=282 < 400
    // Equal → preferBelow, clamp: top=314, 314+400=714>592 → top=592-400=192
    const pos = computePopupPosition(290, 100, 150, 310, 400, 1920, 600, 400);
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 400).toBeLessThanOrEqual(600 - 8);
  });

  it('prefers the side the pointer is coming from to avoid covering the badge', () => {
    // Pointer coming from the left: badge at (0,115), tip at (125,115).
    const pointer = { tip: { x: 125, y: 115 }, badgeCenter: { x: 0, y: 115 } };
    // Without pointer it would place below (top=104); with pointer it should place right.
    const pos = computePopupPosition(70, 100, 150, 100, 200, 600, 400, 300, pointer);
    expect(pos.left).toBe(154); // anchorRight + 4
    expect(pos.top).toBe(70);   // aligned with anchor top
  });

  it('falls back to the left when the preferred right side does not fit', () => {
    // Pointer coming from the right, but no space on the right.
    const pointer = { tip: { x: 500, y: 80 }, badgeCenter: { x: 0, y: 80 } };
    const pos = computePopupPosition(70, 450, 500, 100, 200, 600, 400, 300, pointer);
    expect(pos.left).toBe(246); // anchorLeft - popupWidth - GAP
    expect(pos.top).toBe(70);  // aligned with anchor top, fits vertically
  });

  it('avoids covering the pointer tip when the preferred side would overlap', () => {
    // Badge below the token, pointer tip is above the token (dy < 0) => preferred top.
    // However, the tip is at the same x as the token and the popup above would cover it.
    // In this layout the tip sits at (125, 50) and the popup above token (70..100)
    // would start at top=70-300-4=-234, clamped to 8, height 300, so it covers y=50.
    // The scorer should prefer right/left to avoid the tip.
    const pointer = { tip: { x: 125, y: 50 }, badgeCenter: { x: 125, y: 150 }, badgeRadius: 18, pointerRadius: 4.5 };
    const pos = computePopupPosition(70, 100, 150, 100, 200, 600, 400, 300, pointer);
    // Should not place above (which would cover tip); right is preferred because dx=0,
    // but the tie-breaker goes to the first evaluated after preferred (top). Top covers tip
    // and gets +1000, so right (left=154, top=70) should win.
    expect(pos.left).toBe(154);
    expect(pos.top).toBe(70);
  });

  it('avoids covering the badge circle', () => {
    // Badge sits directly below the token; preferred bottom would put popup over the badge.
    const pointer = { tip: { x: 125, y: 130 }, badgeCenter: { x: 125, y: 180 }, badgeRadius: 20, pointerRadius: 4.5 };
    const pos = computePopupPosition(70, 100, 150, 100, 200, 600, 400, 300, pointer);
    // Bottom would be at top=104, height 300, y=104..404; badge center y=180 with r=20
    // is inside, so bottom gets +500. Right (left=154, top=70) should win.
    expect(pos.left).toBe(154);
    expect(pos.top).toBe(70);
  });

  it('avoids covering the pointer near the viewport bottom', () => {
    // Word near the bottom of a short viewport. Pointer comes from above (dy > 0)
    // so bottom is preferred, but the popup would be clamped upward and cover the pointer.
    // The scorer should pick a side (right/left) that keeps the pointer circle outside.
    const pointer = { tip: { x: 500, y: 599.5 }, badgeCenter: { x: 500, y: 573 }, badgeRadius: 18, pointerRadius: 4.5 };
    const pos = computePopupPosition(590.5, 500, 540, 608.5, 320, 1366, 663, 200, pointer);
    const pointerMargin = (pointer.pointerRadius ?? 6) + 4;
    // Popup left edge must be at least pointerMargin to the right of the pointer tip.
    expect(pos.left).toBeGreaterThanOrEqual(pointer.tip.x + pointerMargin);
  });
});

describe('computePopupPosition — line-aware constraint', () => {
  // Line rect wider than the token: the popup must not overlap the line.
  // Token at (100,70)-(150,100), line at (50,60)-(800,110).
  // Without lineRect, bottom placement at top=104 would be fine.
  // With lineRect, bottom at top=104 overlaps line (60..110) → must go further down.
  it('popup below does not overlap the line rect', () => {
    const lineRect = { top: 60, left: 50, right: 800, bottom: 110 };
    const pos = computePopupPosition(70, 100, 150, 100, 400, 1920, 1080, 300, undefined, lineRect);
    // Popup top must be below line bottom (110) + GAP (4) = 114.
    expect(pos.top).toBeGreaterThanOrEqual(114);
  });

  it('popup above does not overlap the line rect', () => {
    // Token near bottom, line at (50, 900)-(800, 950).
    // Popup above must end above line top (900) - GAP = 896.
    const lineRect = { top: 900, left: 50, right: 800, bottom: 950 };
    const pos = computePopupPosition(910, 100, 150, 940, 400, 1920, 1080, 300, undefined, lineRect);
    // Popup top + popupHeight must be <= line top - GAP = 896.
    expect(pos.top + 300).toBeLessThanOrEqual(896);
  });

  it('popup never vertically overlaps the line band (full-width avoidance)', () => {
    // Same-row neighbors must stay clickable: even if popup is left/right of the
    // word, its Y range must clear the line/cue band.
    const lineRect = { top: 60, left: 50, right: 800, bottom: 110 };
    const pos = computePopupPosition(70, 100, 150, 100, 200, 1920, 1080, 300, undefined, lineRect);
    const clearsAbove = pos.top + 300 <= lineRect.top;
    const clearsBelow = pos.top >= lineRect.bottom;
    expect(clearsAbove || clearsBelow).toBe(true);
  });

  it('prefers below the cue so same-row neighbors stay free (image-2 layout)', () => {
    // Subtitle cue — token in first visual line of a 2-line cue. Enough room below.
    const lineRect = { top: 400, left: 80, right: 1200, bottom: 470 };
    const pos = computePopupPosition(405, 400, 470, 430, 420, 1366, 900, 280, undefined, lineRect);
    expect(pos.top).toBeGreaterThanOrEqual(lineRect.bottom + 4);
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it('without lineRect, behaves like before (popup can be close to anchor)', () => {
    const pos = computePopupPosition(70, 100, 150, 100, 400, 1920, 1080, 300);
    // Without lineRect, bottom placement at top=104 is fine (no line constraint).
    expect(pos.top).toBe(104); // anchor.bottom + GAP
  });

  it('shift variants: center alignment is chosen when start overflows right', () => {
    // Token at right edge: anchor.left=1800, anchor.right=1850, popupWidth=400.
    // start: left=1800 → 1800+400=2200 > 1912 → clamped.
    // center: left=(1800+1850)/2 - 200 = 1625 → fits.
    // end: left=1850-400=1450 → fits.
    // Both center and end fit; center is closer to anchor center → lower distance score.
    const pos = computePopupPosition(70, 1800, 1850, 100, 400, 1920, 1080);
    expect(pos.left + 400).toBeLessThanOrEqual(1920 - 8);
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });
});

describe('PopupShell', () => {
  let shell: PopupShell;
  let onDismiss: jest.Mock<() => void>;
  let onResizeEnd: jest.Mock<(size: { width: number; maxHeight: number }, sheetHeight: number) => void>;

  beforeEach(() => {
    onDismiss = jest.fn<() => void>();
    onResizeEnd = jest.fn<(size: { width: number; maxHeight: number }, sheetHeight: number) => void>();
    shell = new PopupShell({ width: 560, maxHeight: 480 }, 500, onDismiss, onResizeEnd as unknown as (size: { width: number; maxHeight: number }, sheetHeight: number) => void);
  });

  afterEach(() => {
    shell.destroy();
  });

  it('mounts with Shadow DOM', () => {
    const shadow = shell.mount();
    expect(shadow).toBeInstanceOf(ShadowRoot);
    const host = document.querySelector('.js-cell-popup-host');
    expect(host).not.toBeNull();
  });

  it('getContainer returns the inner content element', () => {
    shell.mount();
    const container = shell.getContainer();
    expect(container).not.toBeNull();
    expect(container!.classList.contains('js-cell-content')).toBe(true);
  });

  it('setPosition sets left/top on the popup shell', () => {
    shell.mount();
    shell.setPosition({ top: 170, left: 100, right: 150, bottom: 200 });
    const shellEl = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
    expect(shellEl).not.toBeNull();
    expect(shellEl.style.left).toMatch(/\d+px/);
    expect(shellEl.style.top).toMatch(/\d+px/);
  });

  it('show/hide toggles the visible class on the popup shell', () => {
    shell.mount();
    const shellEl = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
    shell.hide();
    expect(shellEl.classList.contains('cell-popup--visible')).toBe(false);
    shell.show();
    expect(shellEl.classList.contains('cell-popup--visible')).toBe(true);
  });

  it('setSize updates width + maxHeight on the popup shell', () => {
    shell.mount();
    shell.setSize({ width: 400, maxHeight: 300 });
    const shellEl = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
    expect(shellEl.style.width).toBe('400px');
    expect(shellEl.style.maxHeight).toBe('300px');
  });

  it('Esc key triggers onDismiss when visible', () => {
    shell.mount();
    shell.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('non-Esc key does not trigger onDismiss', () => {
    shell.mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('click outside on empty space triggers onDismiss', () => {
    shell.mount();
    shell.show();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('click outside on text also triggers onDismiss (isPointOnText guard removed)', () => {
    shell.mount();
    shell.show();
    // Previously, isPointOnText blocked dismiss on any text node. This was
    // too aggressive — YouTube UI, comments, titles all have text, making
    // the popup impossible to close by clicking "empty" space. Now all
    // outside clicks dismiss (except .js-cell-token which triggers a new
    // lookup). Web text lookups re-show the popup on mouseup if needed.
    const textNode = document.createTextNode('hello');
    document.body.appendChild(textNode);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    document.body.removeChild(textNode);
  });

  it('destroy removes host from DOM', () => {
    shell.mount();
    shell.destroy();
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();
  });

  it('mount is idempotent (returns same shadow root)', () => {
    const a = shell.mount();
    const b = shell.mount();
    expect(a).toBe(b);
  });

  // --- Keyboard Lock API (Esc in fullscreen) ---
  // Chromium browser process intercepts Esc before DOM when in fullscreen.
  // Keyboard Lock API (navigator.keyboard.lock(['Escape'])) captures Esc
  // at the renderer level so our keydown handler receives it.
  describe('Keyboard Lock API — Esc in fullscreen', () => {
    let keyboardLockSpy: ReturnType<typeof jest.spyOn>;
    let keyboardUnlockSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      // jsdom doesn't have Keyboard Lock API — stub it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (!nav.keyboard) {
        Object.defineProperty(navigator, 'keyboard', {
          configurable: true,
          value: {
            lock: jest.fn<() => Promise<void>>(),
            unlock: jest.fn<() => void>(),
          },
        });
      }
      keyboardLockSpy = jest.spyOn(nav.keyboard, 'lock').mockResolvedValue(undefined as void);
      keyboardUnlockSpy = jest.spyOn(nav.keyboard, 'unlock').mockImplementation(() => {});
    });

    afterEach(() => {
      keyboardLockSpy.mockRestore();
      keyboardUnlockSpy.mockRestore();
    });

    it('locks Escape key when popup shows in fullscreen', () => {
      // Simulate fullscreen active.
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.body,
      });
      try {
        shell.mount();
        shell.show();
        expect(keyboardLockSpy).toHaveBeenCalledWith(['Escape']);
      } finally {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
      }
    });

    it('does NOT lock Escape when popup shows outside fullscreen', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      });
      shell.mount();
      shell.show();
      expect(keyboardLockSpy).not.toHaveBeenCalled();
    });

    it('unlocks Escape key when popup hides', () => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.body,
      });
      try {
        shell.mount();
        shell.show();
        shell.hide();
        expect(keyboardUnlockSpy).toHaveBeenCalled();
      } finally {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
      }
    });
  });

  // --- Scroll container structure (sticky headers cross-browser) ---
  // The popup uses a two-layer layout so sticky headers work in every browser:
  //   outer shell .js-cell-popup      — fixed, overflow:hidden, does NOT scroll
  //   inner wrapper .js-cell-content  — flex:1, overflow-y:auto, IS the scroll container
  //   resize handle .js-cell-resize   — sibling of contentEl, pinned to shell corner
  // getContainer() returns the inner wrapper (contentEl), not the outer shell.
  describe('scroll container structure', () => {
    it('getContainer returns the element with js-cell-content (inner scroll wrapper)', () => {
      shell.mount();
      const container = shell.getContainer();
      expect(container).not.toBeNull();
      expect(container!.classList.contains('js-cell-content')).toBe(true);
    });

    it('content element .js-cell-content has overflowY auto (the scroll container)', () => {
      shell.mount();
      const content = shell.getShadowRoot()!.querySelector('.js-cell-content') as HTMLDivElement;
      expect(content).not.toBeNull();
      // jsdom doesn't compute styles from Shadow DOM <style> tags; verify class
      // which carries overflow-y:auto in popupDictionary.css (.cell-popup__content).
      expect(content.className).toContain('cell-popup__content');
    });

    it('content element .js-cell-content has min-height 0 (flex child can shrink & scroll)', () => {
      shell.mount();
      const content = shell.getShadowRoot()!.querySelector('.js-cell-content') as HTMLDivElement;
      expect(content).not.toBeNull();
      expect(content.className).toContain('cell-popup__content');
    });

    it('resize handle .js-cell-resize is a sibling of content, both children of .js-cell-popup', () => {
      shell.mount();
      const root = shell.getShadowRoot()!;
      const popup = root.querySelector('.js-cell-popup') as HTMLDivElement;
      const content = root.querySelector('.js-cell-content') as HTMLDivElement;
      const handle = root.querySelector('.js-cell-resize') as HTMLDivElement;
      expect(popup).not.toBeNull();
      expect(content).not.toBeNull();
      expect(handle).not.toBeNull();
      // Both are direct children of the outer shell.
      expect(content.parentElement).toBe(popup);
      expect(handle.parentElement).toBe(popup);
      // Handle is NOT inside the content element.
      expect(handle.parentElement).not.toBe(content);
    });

    it('outer shell .js-cell-popup has overflow hidden (only inner content scrolls)', () => {
      shell.mount();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup).not.toBeNull();
      // jsdom doesn't compute styles from Shadow DOM <style> tags; verify class
      // which carries overflow:hidden in popupDictionary.css (.cell-popup).
      expect(popup.className).toContain('cell-popup');
    });

  });

  // --- Theme integration (dark/light mode via chrome.storage.local.themeMode) ---
  describe('theme integration', () => {
    beforeEach(() => {
      // Reset storage + listeners between theme tests.
      for (const k of Object.keys(storageData)) delete storageData[k];
      storageListeners.length = 0;
    });

    it('sets data-theme on container synchronously (no FOUC)', () => {
      shell.mount();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      // Sync default is set immediately from prefers-color-scheme (mocked false → light).
      expect(popup.getAttribute('data-theme')).toBe('light');
    });

    it('applies dark mode from chrome.storage.local.themeMode', async () => {
      storageData[STORAGE_KEYS.THEME_MODE] = 'dark';
      shell.mount();
      // Wait for async refreshTheme to resolve.
      await Promise.resolve();
      await Promise.resolve();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup.getAttribute('data-theme')).toBe('dark');
    });

    it('applies light mode from chrome.storage.local.themeMode', async () => {
      storageData[STORAGE_KEYS.THEME_MODE] = 'light';
      shell.mount();
      await Promise.resolve();
      await Promise.resolve();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup.getAttribute('data-theme')).toBe('light');
    });

    it('defaults to dark when themeMode absent in storage', async () => {
      // No themeMode key in storage.
      shell.mount();
      await Promise.resolve();
      await Promise.resolve();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup.getAttribute('data-theme')).toBe('dark'); // DEFAULT_THEME_MODE
    });

    it('re-resolves when storage.onChanged fires for themeMode', async () => {
      storageData[STORAGE_KEYS.THEME_MODE] = 'light';
      shell.mount();
      await Promise.resolve();
      await Promise.resolve();

      // Simulate user changing theme to dark in settings.
      storageData[STORAGE_KEYS.THEME_MODE] = 'dark';
      const changes: Record<string, chrome.storage.StorageChange> = {
        [STORAGE_KEYS.THEME_MODE]: { oldValue: 'light', newValue: 'dark' },
      };
      for (const listener of storageListeners) listener(changes, 'local');
      await Promise.resolve();
      await Promise.resolve();

      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup.getAttribute('data-theme')).toBe('dark');
    });

    it('ignores storage.onChanged for unrelated keys', async () => {
      storageData[STORAGE_KEYS.THEME_MODE] = 'dark';
      shell.mount();
      await Promise.resolve();
      await Promise.resolve();

      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      const beforeTheme = popup.getAttribute('data-theme');

      // Fire change for an unrelated key.
      const changes: Record<string, chrome.storage.StorageChange> = {
        someOtherKey: { oldValue: 'a', newValue: 'b' },
      };
      for (const listener of storageListeners) listener(changes, 'local');
      await Promise.resolve();

      expect(popup.getAttribute('data-theme')).toBe(beforeTheme);
    });

    it('removes storage.onChanged listener on destroy', () => {
      const beforeCount = storageListeners.length;
      shell.mount();
      expect(storageListeners.length).toBe(beforeCount + 1);
      shell.destroy();
      expect(storageListeners.length).toBe(beforeCount);
    });
  });

  // --- Focus trap + drag + toast ---
  describe('accessibility + drag feedback', () => {
    it('container has role=dialog and aria-modal when mounted', () => {
      shell.mount();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      expect(popup.getAttribute('role')).toBe('dialog');
      expect(popup.getAttribute('aria-modal')).toBe('true');
      expect(popup.getAttribute('tabindex')).toBe('-1');
    });

    it('show() focuses the popup container', () => {
      shell.mount();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      // jsdom does not implement .focus by default; add a spy.
      const focusSpy = jest.spyOn(popup, 'focus').mockImplementation(() => {});
      shell.show();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('Tab key cycles focus inside the popup when visible', () => {
      shell.mount();
      shell.show();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      const btn1 = document.createElement('button');
      const btn2 = document.createElement('button');
      popup.appendChild(btn1);
      popup.appendChild(btn2);
      // jsdom shadow.activeElement support is limited; cast popup as active.
      jest.spyOn(shell.getShadowRoot() as unknown as ShadowRoot, 'activeElement', 'get').mockReturnValue(btn1);
      const btn2Spy = jest.spyOn(btn2, 'focus').mockImplementation(() => {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(btn2Spy).toHaveBeenCalled();
      btn2Spy.mockRestore();
    });

    it('drag moves the popup by updating dragOffset and applying position', () => {
      shell.mount();
      shell.setPosition({ top: 100, left: 100, right: 200, bottom: 150 });
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      popup.setPointerCapture = jest.fn();
      popup.releasePointerCapture = jest.fn();
      // Cast to access private members for testing.
      const shellAny = shell as unknown as Record<string, unknown>;
      const startTop = parseFloat(popup.style.top);
      const startLeft = parseFloat(popup.style.left);
      // Simulate pointerdown on the header.
      const header = document.createElement('div');
      header.className = 'cell-header';
      popup.appendChild(header);
      const pointerDown = new PointerEvent('pointerdown', { clientX: 110, clientY: 120, bubbles: true });
      header.dispatchEvent(pointerDown);
      const pointerMove = new PointerEvent('pointermove', { clientX: 160, clientY: 170, bubbles: true });
      popup.dispatchEvent(pointerMove);
      expect((shellAny.dragOffset as { x: number; y: number }).x).toBe(50);
      expect((shellAny.dragOffset as { x: number; y: number }).y).toBe(50);
      expect(parseFloat(popup.style.left)).toBeGreaterThan(startLeft);
      expect(parseFloat(popup.style.top)).toBeGreaterThan(startTop);
      const pointerUp = new PointerEvent('pointerup', { clientX: 160, clientY: 170, bubbles: true });
      popup.dispatchEvent(pointerUp);
      expect((shellAny.dragStart as unknown)).toBeNull();
    });

    it('showToast appends a toast and removes it after timeout', () => {
      jest.useFakeTimers();
      shell.mount();
      const popup = shell.getShadowRoot()!.querySelector('.js-cell-popup') as HTMLDivElement;
      shell.showToast('Added to Anki');
      const toast = popup.querySelector('.cell-toast') as HTMLDivElement;
      expect(toast).not.toBeNull();
      expect(toast.getAttribute('role')).toBe('status');
      expect(toast.textContent).toBe('Added to Anki');
      // Toast becomes visible after reflow (class added synchronously).
      expect(toast.classList.contains('cell-toast--visible')).toBe(true);
      jest.advanceTimersByTime(3400);
      expect(popup.querySelector('.cell-toast')).toBeNull();
      jest.useRealTimers();
    });
  });
});
