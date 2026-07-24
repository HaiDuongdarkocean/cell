import { describe, expect, it, jest, beforeAll } from '@jest/globals';
import { createOrbitalBadge } from './createOrbitalBadge';
import type { PointerPreset } from './pointerPosition';

beforeAll(() => {
  if (!window.matchMedia) {
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
  }
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  c.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  // rAF sync mock: drag handlers throttle pointermove via requestAnimationFrame.
  // jsdom rAF is async (setTimeout), so tests that dispatch pointermove and
  // assert synchronously would see no update. Flush the callback inline so the
  // drag delta is applied immediately — tests verify drag behavior, not throttle
  // timing.
  globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  }) as unknown as typeof requestAnimationFrame;

  // Polyfill ResizeObserver — jsdom doesn't provide it. createOrbitalBadge
  // uses it to re-snap the badge when the viewport shrinks (scrollbar guard).
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })) as unknown as typeof ResizeObserver;
  }
});

function getShadow(host: HTMLElement): ShadowRoot {
  return host.shadowRoot as ShadowRoot;
}

function getBadgeAndPointer() {
  const host = document.querySelector('.js-cell-orbital-badge-host') as HTMLElement;
  const shadow = getShadow(host);
  const badge = shadow.querySelector('.js-cell-orbital-badge') as HTMLButtonElement;
  const pointer = shadow.querySelector('.js-cell-orbital-pointer') as HTMLSpanElement;
  return { host, shadow, badge, pointer };
}

describe('createOrbitalBadge', () => {
  it('renders the badge host, shadow root, and pointer', () => {
    const badge = createOrbitalBadge({});

    const { host, badge: btn, pointer } = getBadgeAndPointer();
    expect(host).not.toBeNull();
    expect(host.style.zIndex).toBe('2147483647');
    expect(btn).not.toBeNull();
    expect(pointer).not.toBeNull();
    expect(pointer.getAttribute('aria-hidden')).toBe('true');

    badge.destroy();
    expect(document.querySelector('.js-cell-orbital-badge-host')).toBeNull();
  });

  it('starts collapsed as a half-moon with its center on the right viewport edge and pointer centered inside it', () => {
    const badge = createOrbitalBadge({ initialPreset: 'center' });
    const { badge: btn, pointer } = getBadgeAndPointer();

    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(false);
    expect(btn.style.left).toBe(`${window.innerWidth}px`);
    expect(btn.style.top).toBe(`${window.innerHeight / 2}px`);
    // Pointer is visible and centered inside the visible half-moon (inset by badgeSize/4).
    expect(pointer.classList.contains('cell-orbital-pointer--hidden')).toBe(false);
    expect(pointer.style.left).toBe(`${window.innerWidth - 9}px`);
    expect(pointer.style.top).toBe(`${window.innerHeight / 2}px`);

    badge.destroy();
  });

  it('expands on drag and keeps the initial/selected preset instead of rotating toward the viewport center', () => {
    const onTipReady = jest.fn();
    const onPresetChange = jest.fn();
    const badge = createOrbitalBadge({ initialPreset: 'left', onTipReady, onPresetChange });

    const { badge: btn, pointer } = getBadgeAndPointer();

    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    // Move far enough to enter drag mode (> 4px).
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 100, clientY: window.innerHeight / 2 - 50, bubbles: true }));
    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(true);
    expect(pointer.classList.contains('cell-orbital-pointer--hidden')).toBe(false);

    btn.dispatchEvent(new MouseEvent('pointerup', { clientX: window.innerWidth - 100, clientY: window.innerHeight / 2 - 50, bubbles: true }));

    // Drag end triggers tip notification but does not change the selected preset.
    expect(onTipReady).toHaveBeenCalled();
    expect(onPresetChange).not.toHaveBeenCalled();
    const [tip, preset] = onTipReady.mock.calls[0] as [{ x: number; y: number }, PointerPreset];
    expect(typeof tip.x).toBe('number');
    expect(typeof tip.y).toBe('number');
    expect(preset).toBe('left');

    badge.destroy();
  });

  it('fires onTipReady when the pointer tip is inside the badge (center preset)', () => {
    const onTipReady = jest.fn();
    const badge = createOrbitalBadge({ initialPreset: 'center', onTipReady });
    const { badge: btn } = getBadgeAndPointer();

    // Drag inward to expand; pointer stays at badge center and can still lookup the text behind it.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 100, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointerup', { clientX: window.innerWidth - 100, clientY: window.innerHeight / 2, bubbles: true }));

    expect(onTipReady).toHaveBeenCalled();

    badge.destroy();
  });

  it('fires onTipMoving while the badge is being dragged expanded', () => {
    const onTipMoving = jest.fn();
    const badge = createOrbitalBadge({ initialPreset: 'left', onTipMoving });
    const { badge: btn } = getBadgeAndPointer();

    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 100, clientY: window.innerHeight / 2, bubbles: true }));
    // pointermove while expanded should call onTipMoving with the current tip and badge center.
    expect(onTipMoving).toHaveBeenCalled();
    const [tip, preset, badgeCenter] = onTipMoving.mock.calls[0] as [{ x: number; y: number }, string, { x: number; y: number }];
    expect(typeof tip.x).toBe('number');
    expect(typeof badgeCenter.x).toBe('number');
    expect(preset).toBe('left');

    badge.destroy();
  });

  it('double tap cycles vertical presets (top/bottom/center) when expanded', () => {
    jest.useFakeTimers();
    const onPresetChange = jest.fn();
    const badge = createOrbitalBadge({ initialPreset: 'left', onPresetChange });
    const { badge: btn, pointer } = getBadgeAndPointer();

    // Expand by dragging inward and release away from the edge so it stays expanded.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 60, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointerup', { clientX: window.innerWidth - 60, clientY: window.innerHeight / 2, bubbles: true }));

    // Click three times: the first click is the synthetic click following the
    // drag and is swallowed by suppressClick; the next two form a double tap.
    btn.click();
    btn.click();
    btn.click();
    jest.advanceTimersByTime(300);

    const calls = onPresetChange.mock.calls.map((c) => c[0] as PointerPreset);
    expect(calls).toContain('top');
    expect(pointer.classList.contains('cell-orbital-pointer')).toBe(true);

    badge.destroy();
    jest.useRealTimers();
  });

  it('expands after a small initial slide if the user keeps dragging inward', () => {
    const badge = createOrbitalBadge({ initialPreset: 'left' });
    const { badge: btn } = getBadgeAndPointer();

    // Start on the right edge.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    // First move is only 5 px inward (below expand threshold) — should slide.
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 23, clientY: window.innerHeight / 2, bubbles: true }));
    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(false);
    // Continuing inward past the threshold expands the badge.
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 40, clientY: window.innerHeight / 2, bubbles: true }));
    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(true);

    badge.destroy();
  });

  it('snaps to the nearest viewport edge and collapses when released near an edge', () => {
    const onTipReady = jest.fn();
    const badge = createOrbitalBadge({ initialPreset: 'left', onTipReady });
    const { badge: btn } = getBadgeAndPointer();

    // Drag from the right edge to the far left and release.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 100, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 100, bubbles: true }));

    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(false);
    expect(btn.style.left).toBe('0px');
    expect(btn.style.top).toBe('100px');
    expect(onTipReady).toHaveBeenCalled();

    badge.destroy();
  });

  it('restores the user-selected preset when dragged out after collapsing to an edge', () => {
    const badge = createOrbitalBadge({ initialPreset: 'top' });
    const { badge: btn } = getBadgeAndPointer();

    // Expand and drag toward the right edge, then release to collapse.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 40, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointerup', { clientX: window.innerWidth - 12, clientY: window.innerHeight / 2, bubbles: true }));

    expect(badge.getState().preset).toBe('top');

    // Drag out again from the right edge; pointer should be on top, not left.
    btn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: window.innerWidth - 18, clientY: window.innerHeight / 2, bubbles: true }));
    btn.dispatchEvent(new MouseEvent('pointermove', { clientX: window.innerWidth - 40, clientY: window.innerHeight / 2, bubbles: true }));
    expect(btn.classList.contains('cell-orbital-badge--expanded')).toBe(true);
    expect(badge.getState().preset).toBe('top');

    badge.destroy();
  });

  it('repositions the badge when the viewport shrinks via resize event', () => {
    const badge = createOrbitalBadge({});
    const { badge: btn } = getBadgeAndPointer();

    // Default: collapsed on right edge at vh/2. jsdom defaults: innerWidth=1024, innerHeight=768.
    const originalLeft = btn.style.left;
    const originalTop = btn.style.top;

    // Shrink viewport to half size. jsdom doesn't do layout so clientWidth=0;
    // getClientWidth falls back to window.innerWidth — mock that.
    Object.defineProperty(window, 'innerWidth', { value: 512, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 384, configurable: true });

    window.dispatchEvent(new Event('resize'));

    // Badge should reposition to the new right edge (x = new width = 512).
    expect(btn.style.left).not.toBe(originalLeft);
    expect(parseFloat(btn.style.left)).toBe(512);
    // Y should be clamped to the new viewport (was 384 = 768/2, now should be 192 = 384/2).
    expect(parseFloat(btn.style.top)).toBeLessThanOrEqual(384);

    // Restore.
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    badge.destroy();
  });
});
