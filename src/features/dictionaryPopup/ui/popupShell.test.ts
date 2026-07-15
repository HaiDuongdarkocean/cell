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

describe('computePopupPosition', () => {
  it('places popup below-right of anchor by default', () => {
    const pos = computePopupPosition(100, 100, 400, 1920, 1080);
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(120); // anchorY + 20
  });

  it('flips left when popup would overflow right edge', () => {
    const pos = computePopupPosition(1800, 100, 400, 1920, 1080);
    expect(pos.left).toBe(1920 - 400 - 8); // viewportWidth - popupWidth - margin
  });

  it('clamps left to viewport margin', () => {
    const pos = computePopupPosition(-50, 100, 400, 1920, 1080);
    expect(pos.left).toBe(8); // VIEWPORT_MARGIN
  });

  it('clamps top to viewport margin', () => {
    const pos = computePopupPosition(100, -50, 400, 1920, 1080);
    expect(pos.top).toBe(8); // VIEWPORT_MARGIN
  });

  it('places popup above anchor when would overflow bottom', () => {
    const pos = computePopupPosition(100, 1000, 400, 1920, 1080);
    // top + 200 > 1080 - 8 → flip above
    expect(pos.top).toBeLessThan(1000);
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
    shell.setPosition(100, 200);
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
