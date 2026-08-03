import { render, screen, fireEvent, act } from '@testing-library/react';
import { OrbitalBadge } from './OrbitalBadge';

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
});

describe('OrbitalBadge', () => {
  it('renders collapsed badge', () => {
    render(<OrbitalBadge persistPosition={false} />);
    expect(screen.getByTestId('orbital-badge')).toBeInTheDocument();
    expect(screen.getByTestId('orbital-badge-button')).toBeInTheDocument();
  });

  it('calls onClick on pointer up when not dragging', () => {
    jest.useFakeTimers();
    const onClick = jest.fn();
    render(<OrbitalBadge persistPosition={false} onClick={onClick} />);

    act(() => {
      fireEvent.pointerDown(screen.getByTestId('orbital-badge'), { clientX: 0, clientY: 0 });
      fireEvent.pointerUp(screen.getByTestId('orbital-badge'), { clientX: 0, clientY: 0 });
    });
    expect(onClick).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onClick).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('double tap cycles the pointer preset forward', () => {
    jest.useFakeTimers();
    const onPresetChange = jest.fn();
    render(<OrbitalBadge persistPosition={false} initialPreset="center" onPresetChange={onPresetChange} />);

    const badge = screen.getByTestId('orbital-badge');
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

    expect(onPresetChange).toHaveBeenCalledWith('right');
    jest.useRealTimers();
  });

  it('triple tap cycles the pointer preset backward', () => {
    jest.useFakeTimers();
    const onPresetChange = jest.fn();
    render(<OrbitalBadge persistPosition={false} initialPreset="right" onPresetChange={onPresetChange} />);

    const badge = screen.getByTestId('orbital-badge');
    [0, 80, 160].forEach((t) => {
      act(() => {
        fireEvent.pointerDown(badge, { clientX: 0, clientY: 0, timeStamp: t });
        fireEvent.pointerUp(badge, { clientX: 0, clientY: 0, timeStamp: t });
      });
      if (t < 160) act(() => { jest.advanceTimersByTime(80); });
    });
    act(() => { jest.advanceTimersByTime(50); });

    expect(onPresetChange).toHaveBeenCalledWith('center');
    jest.useRealTimers();
  });

  it('drags from the nearest edge without jumping', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Start dragging the badge leftwards from the right edge.
    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 980, clientY: 384 });
    });

    // The visible badge center starts at x = 1013 (collapsed right edge).
    // dx = -33 -> dragCenter = 980, top-left = 980 - 22 = 958.
    expect(badge.style.transform).toContain('translate3d(958px, 362px, 0)');
  });

  it('snaps back to the nearest edge on pointer up', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    act(() => {
      fireEvent.pointerDown(badge, { clientX: 1013, clientY: 384 });
      fireEvent.pointerMove(badge, { clientX: 900, clientY: 384 });
      fireEvent.pointerUp(badge, { clientX: 900, clientY: 384 });
    });

    // Snaps back to right edge collapsed center: expanded center 1024 - inset 11 = 1013.
    expect(badge.style.transform).toContain('translate3d(991px, 362px, 0)');
  });

  it('repositions when the viewport resizes', () => {
    render(<OrbitalBadge persistPosition={false} />);
    const badge = screen.getByTestId('orbital-badge');

    // Collapsed right edge in a 1024x768 viewport: expanded center 1024, collapsed 1013.
    expect(badge.style.transform).toContain('translate3d(991px, 362px, 0)');

    act(() => {
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
      fireEvent.resize(window);
    });

    // Resized to 400 width: collapsed right edge at 400 - 11 = 389, top-left = 389 - 22 = 367.
    expect(badge.style.transform).toContain('translate3d(367px, 362px, 0)');
  });
});
