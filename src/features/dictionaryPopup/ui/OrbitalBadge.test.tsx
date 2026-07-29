import { render, screen, fireEvent, act } from '@testing-library/react';
import { OrbitalBadge } from './OrbitalBadge';

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
});
