// popupShell tests — spec §4.6.3 A4: Shadow DOM, auto-position, resize, dismiss.

import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { PopupShell, clampPopupSize, computePopupPosition } from './popupShell';

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
    expect(pos.left).toBe(8); // VIEWPORT_MARGIN
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
});

describe('PopupShell', () => {
  let shell: PopupShell;
  let onDismiss: jest.Mock<() => void>;
  let onResizeEnd: jest.Mock<(size: { width: number; maxHeight: number }) => void>;

  beforeEach(() => {
    onDismiss = jest.fn<() => void>();
    onResizeEnd = jest.fn<(size: { width: number; maxHeight: number }) => void>();
    shell = new PopupShell({ width: 560, maxHeight: 480 }, onDismiss, onResizeEnd as unknown as (size: { width: number; maxHeight: number }) => void);
  });

  afterEach(() => {
    shell.destroy();
  });

  it('mounts with Shadow DOM', () => {
    const shadow = shell.mount();
    expect(shadow).toBeInstanceOf(ShadowRoot);
    const host = document.querySelector('[data-dp-popup-host]');
    expect(host).not.toBeNull();
  });

  it('getContainer returns the popup container', () => {
    shell.mount();
    const container = shell.getContainer();
    expect(container).not.toBeNull();
    expect(container!.getAttribute('data-dp-popup')).toBe('');
  });

  it('setPosition sets left/top on container', () => {
    shell.mount();
    shell.setPosition(170, 100, 150, 200);
    const container = shell.getContainer()!;
    expect(container.style.left).toMatch(/\d+px/);
    expect(container.style.top).toMatch(/\d+px/);
  });

  it('show/hide toggles display', () => {
    shell.mount();
    shell.hide();
    expect(shell.getContainer()!.style.display).toBe('none');
    shell.show();
    expect(shell.getContainer()!.style.display).toBe('flex');
  });

  it('setSize updates width + maxHeight', () => {
    shell.mount();
    shell.setSize({ width: 400, maxHeight: 300 });
    const container = shell.getContainer()!;
    expect(container.style.width).toBe('400px');
    expect(container.style.maxHeight).toBe('300px');
  });

  it('Esc key triggers onDismiss', () => {
    shell.mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('non-Esc key does not trigger onDismiss', () => {
    shell.mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('click outside triggers onDismiss', () => {
    shell.mount();
    // Click on body (outside popup host).
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('destroy removes host from DOM', () => {
    shell.mount();
    shell.destroy();
    expect(document.querySelector('[data-dp-popup-host]')).toBeNull();
  });

  it('mount is idempotent (returns same shadow root)', () => {
    const a = shell.mount();
    const b = shell.mount();
    expect(a).toBe(b);
  });
});
