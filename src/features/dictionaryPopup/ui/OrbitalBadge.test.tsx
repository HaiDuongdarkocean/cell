import { render, screen, fireEvent, act } from '@testing-library/react';
import { OrbitalBadge } from './OrbitalBadge';

// Controllable ResizeObserver mock — stores the callback so tests can trigger
// it manually (simulating scrollbar appearance: clientWidth shrinks without a
// window resize event).
let resizeObserverCb: (() => void) | undefined;

beforeAll(() => {
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  }

  globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  }) as unknown as typeof requestAnimationFrame;

  globalThis.ResizeObserver = jest.fn((cb: () => void) => {
    resizeObserverCb = cb;
    return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 768, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
});

describe('OrbitalBadge', () => {
  it('renders collapsed badge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    expect(screen.getByTestId('orbital-badge')).toBeInTheDocument();
    expect(screen.getByTestId('orbital-badge-button')).toBeInTheDocument();
  });

  it('calls onClick on single tap when collapsed at edge', () => {
    jest.useFakeTimers();
    const onClick = jest.fn();
    render(<OrbitalBadge persistPosition={false} onClick={onClick} />);

    const badge = screen.getByTestId('orbital-badge');
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 0, clientY: 0 });
      fireEvent.pointerUp(badge, { clientX: 0, clientY: 0 });
    });
    act(() => { jest.advanceTimersByTime(300); });
    expect(onClick).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('double tap toggles top ↔ center', () => {
    jest.useFakeTimers();
    const onPresetChange = jest.fn();
    render(<OrbitalBadge persistPosition={false} initialPreset="top" onPresetChange={onPresetChange} />);

    const badge = screen.getByTestId('orbital-badge');
    // First double-tap: top → center
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 0, clientY: 0, timeStamp: 0 });
      fireEvent.pointerUp(badge, { clientX: 0, clientY: 0, timeStamp: 0 });
    });
    act(() => { jest.advanceTimersByTime(80); });
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 0, clientY: 0, timeStamp: 80 });
      fireEvent.pointerUp(badge, { clientX: 0, clientY: 0, timeStamp: 80 });
    });
    act(() => { jest.advanceTimersByTime(300); });
    expect(onPresetChange).toHaveBeenLastCalledWith('center');
    jest.useRealTimers();
  });

  it('triple tap toggles left ↔ right', () => {
    jest.useFakeTimers();
    const onPresetChange = jest.fn();
    render(<OrbitalBadge persistPosition={false} initialPreset="left" onPresetChange={onPresetChange} />);

    const badge = screen.getByTestId('orbital-badge');
    [0, 80, 160].forEach((t) => {
      act(() => {
        fireEvent.pointerDown(badge, { clientX: 0, clientY: 0, timeStamp: t });
        fireEvent.pointerUp(badge, { clientX: 0, clientY: 0, timeStamp: t });
      });
      if (t < 160) act(() => { jest.advanceTimersByTime(80); });
    });
    act(() => { jest.advanceTimersByTime(50); });
    expect(onPresetChange).toHaveBeenLastCalledWith('right');
    jest.useRealTimers();
  });

  it('drags from the nearest edge without jumping', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 980, clientY: 384 });
    });

    // The visible badge center starts at x = 1024 (right edge, flush).
    // dx = -44 -> dragCenter = 980, top-left = 980 - 22 = 958.
    expect(badge.style.transform).toContain('translate3d(958px, 362px, 0)');
  });

  it('snaps to edge when dropped near edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 980, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 980, clientY: 384 });
    });

    // 980 is within 1.5×badgeSize(66px) of right edge (1024-980=44 ≤ 66) → snaps.
    // Collapsed right edge: center 1024 (flush), top-left = 1024 - 22 = 1002.
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');
  });

  it('stays floating when dropped away from edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });

    // 500 is far from any edge → stays at drop position (clamped).
    // dragCenter = 500, top-left = 500 - 22 = 478.
    expect(badge.style.transform).toContain('translate3d(478px, 362px, 0)');
  });

  it('pointer is visible when floating (not at edge)', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Drag to center and release → floating state.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });

    // Pointer should be rendered (visible) when floating.
    expect(screen.queryByTestId('orbital-pointer')).toBeInTheDocument();
  });

  it('pointer is visible inside half-moon when collapsed at edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    // Badge starts collapsed at right edge → pointer visible inside half-moon.
    expect(screen.queryByTestId('orbital-pointer')).toBeInTheDocument();
  });

  it('does not move when hovering (no drag)', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');
    const initialTransform = badge.style.transform;

    // Simulate hover (pointer move without pointer down).
    act(() => {
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 500 });
    });

    // Badge should not have moved.
    expect(badge.style.transform).toBe(initialTransform);
  });

  it('does not jump to edge when grabbed from floating position', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // 1. Drag from right edge to center and release → floating state.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });
    // Floating at x=500, expanded=true, top-left = 500 - 22 = 478.
    expect(badge.style.transform).toContain('translate3d(478px, 362px, 0)');

    // 2. Grab the badge again from its floating position (x=500).
    // The badge should NOT jump to the nearest edge.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 510, clientY: 384 });
    });

    // dragStart = 500 (floating center), dx = 10 → dragCenter = 510, top-left = 488.
    // Without the fix, dragStart would be 1013 (collapsedCenter at right edge)
    // → dragCenter = 1023 → top-left = 1001 (jumped to edge!).
    expect(badge.style.transform).toContain('translate3d(488px, 362px, 0)');
  });

  it('stays expanded at floating position after external setExpanded(false) is NOT called', () => {
    // mountOrbitalBadge no longer calls setExpanded(false) on outside click.
    // The badge only collapses when dragged near an edge (handleDragEnd).
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Drag to floating position and release.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1024, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });

    // Badge should still be expanded (X icon) at floating position.
    const btn = screen.getByTestId('orbital-badge-button');
    expect(btn.getAttribute('aria-label')).toBe('Drag to move');
    expect(badge.style.transform).toContain('translate3d(478px, 362px, 0)');
  });

  it('repositions when the viewport resizes', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Collapsed flush at content edge: center 1024, top-left = 1024 - 22 = 1002.
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');

    act(() => {
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
      fireEvent.resize(window);
    });

    // Resized to 400 width: center 400 (content edge), top-left = 400 - 22 = 378.
    expect(badge.style.transform).toContain('translate3d(378px, 362px, 0)');
  });

  it('repositions when scrollbar appears (clientWidth shrinks without resize event)', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Colllapsed flush at content edge: center 1024, top-left = 1024 - 22 = 1002.
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');

    // Scrollbar appears: clientWidth shrinks from 1024 to 1009 (15px scrollbar).
    // No 'resize' event fires — only ResizeObserver detects the content-box change.
    act(() => {
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 1009, configurable: true });
      resizeObserverCb?.();
    });

    // Badge repositioned to new content edge (left edge of scrollbar):
    // center 1009, top-left = 1009 - 22 = 987.
    expect(badge.style.transform).toContain('translate3d(987px, 362px, 0)');
  });

  it('repositions to fullscreen viewport when fullscreenchange fires', () => {
    // Normal mode: clientWidth=1024 (with scrollbar), innerWidth=1280 (fullscreen width).
    // Badge at content edge: center 1024, top-left = 1024 - 22 = 1002.
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');

    // Enter fullscreen: fullscreenElement set, innerWidth=1280 (no scrollbar in fullscreen).
    // resolveViewport uses innerWidth/innerHeight in fullscreen mode.
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        configurable: true,
      });
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
      fireEvent(document, new Event('fullscreenchange'));
    });

    // Badge repositioned to fullscreen right edge: center 1280, top-left = 1280 - 22 = 1258.
    // y scales proportionally: 384/768 * 720 = 360, top-left = 360 - 22 = 338.
    expect(badge.style.transform).toContain('translate3d(1258px, 338px, 0)');

    // Exit fullscreen: fullscreenElement cleared, back to clientWidth=1024.
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      fireEvent(document, new Event('fullscreenchange'));
    });

    // Badge back to normal content edge: center 1024. y scales back: 360/720 * 768 = 384.
    // top-left = 1024-22=1002, 384-22=362.
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');
  });

  it('keeps the same edge when fullscreen expands the viewport (not nearest edge)', () => {
    // Normal mode: clientWidth=1024, clientHeight=768. Badge at right edge:
    // center 1024, y=384 (middle). Top-left = 1024-22=1002, 384-22=362.
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');
    expect(badge.style.transform).toContain('translate3d(1002px, 362px, 0)');

    // Enter fullscreen with a MUCH larger viewport: 2560x1440.
    // Old position (1024, 384) in the new viewport: nearest edge is TOP
    // (distance 384) not RIGHT (distance 1536). Without edge-keeping, the
    // badge would snap to the top edge. With edge-keeping, it stays on the
    // right edge. Position scales proportionally: y ratio = 384/768 = 0.5,
    // new y = 0.5 * 1440 = 720. Top-left = 2560-22=2538, 720-22=698.
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        configurable: true,
      });
      Object.defineProperty(window, 'innerWidth', { value: 2560, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1440, configurable: true });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 2560, configurable: true });
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 1440, configurable: true });
      fireEvent(document, new Event('fullscreenchange'));
    });

    // Badge stays on right edge at same relative y (50%): center 2560, y 720.
    // Top-left = 2560-22=2538, 720-22=698.
    expect(badge.style.transform).toContain('translate3d(2538px, 698px, 0)');
  });
});
