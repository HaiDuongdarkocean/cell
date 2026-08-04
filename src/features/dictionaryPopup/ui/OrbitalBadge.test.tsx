import { render, screen, fireEvent, act } from '@testing-library/react';
import { OrbitalBadge, type OrbitalBadgeHandle } from './OrbitalBadge';
import type { RefObject } from 'react';

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
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 980, clientY: 384 });
    });

    // The visible badge center starts at x = 1013 (collapsed right edge).
    // dx = -33 -> dragCenter = 980, top-left = 980 - 22 = 958.
    expect(badge.style.transform).toContain('translate3d(958px, 362px, 0)');
  });

  it('snaps to edge when dropped near edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 980, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 980, clientY: 384 });
    });

    // 980 is within 1.5×badgeSize(66px) of right edge (1024-980=44 ≤ 66) → snaps.
    // Collapsed right edge: expanded center 1024, collapsed 1013, top-left = 991.
    expect(badge.style.transform).toContain('translate3d(991px, 362px, 0)');
  });

  it('stays floating when dropped away from edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
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
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });

    // Pointer should be rendered (visible) when floating.
    expect(screen.queryByTestId('orbital-pointer')).toBeInTheDocument();
  });

  it('pointer is hidden when collapsed at edge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    // Badge starts collapsed at right edge → no pointer.
    expect(screen.queryByTestId('orbital-pointer')).not.toBeInTheDocument();
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
    const badgeRef = { current: null } as RefObject<OrbitalBadgeHandle | null>;
    render(<OrbitalBadge ref={badgeRef} persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // 1. Drag from right edge to center and release → floating state.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 500, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 500, clientY: 384 });
    });
    // Floating at x=500, expanded=true, top-left = 500 - 22 = 478.
    expect(badge.style.transform).toContain('translate3d(478px, 362px, 0)');

    // 2. Simulate external collapse (mountOrbitalBadge calls setExpanded(false)
    //    when the user clicks outside the badge).
    act(() => {
      badgeRef.current?.setExpanded(false);
    });

    // 3. Grab the badge again from its floating position (x=500).
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

  it('repositions when the viewport resizes', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Collapsed right edge in a 1024x768 viewport.
    expect(badge.style.transform).toContain('translate3d(991px, 362px, 0)');

    act(() => {
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
      fireEvent.resize(window);
    });

    // Resized to 400 width: collapsed right edge at 400 - 11 = 389, top-left = 389 - 22 = 367.
    expect(badge.style.transform).toContain('translate3d(367px, 362px, 0)');
  });
});
