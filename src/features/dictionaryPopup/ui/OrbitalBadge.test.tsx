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
});
