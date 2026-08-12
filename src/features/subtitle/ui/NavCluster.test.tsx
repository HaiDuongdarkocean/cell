import { render, screen, fireEvent } from '@testing-library/react';
import { NavCluster } from './NavCluster';

const handlers = {
  onToggleCollapsed: jest.fn(),
  onPrev: jest.fn(),
  onNext: jest.fn(),
  onRepeat: jest.fn(),
  onRewind: jest.fn(),
  onForward: jest.fn(),
  onPlayPause: jest.fn(),
  onDragStart: jest.fn(),
};

describe('NavCluster', () => {
  it('renders expanded controls', () => {
    render(<NavCluster collapsed={false} {...handlers} />);
    expect(screen.getByTestId('nav-cluster')).toBeInTheDocument();
    expect(screen.getByTestId('nav-prev')).toBeInTheDocument();
    expect(screen.getByTestId('nav-next')).toBeInTheDocument();
    expect(screen.getByTestId('nav-repeat')).toBeInTheDocument();
    expect(screen.getByTestId('nav-play')).toBeInTheDocument();
  });

  it('calls handlers when buttons are clicked', () => {
    render(<NavCluster collapsed={false} {...handlers} />);
    fireEvent.click(screen.getByTestId('nav-prev'));
    fireEvent.click(screen.getByTestId('nav-next'));
    fireEvent.click(screen.getByTestId('nav-repeat'));
    fireEvent.click(screen.getByTestId('nav-play'));
    fireEvent.click(screen.getByTestId('nav-rewind'));
    fireEvent.click(screen.getByTestId('nav-forward'));

    expect(handlers.onPrev).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onRepeat).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayPause).toHaveBeenCalledTimes(1);
    expect(handlers.onRewind).toHaveBeenCalledTimes(1);
    expect(handlers.onForward).toHaveBeenCalledTimes(1);
  });

  it('renders collapsed button when collapsed', () => {
    render(<NavCluster collapsed {...handlers} />);
    expect(screen.getByTestId('nav-expand')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-prev')).not.toBeInTheDocument();
  });

  it('renders full controls (no hasSubtitle prop needed)', () => {
    render(<NavCluster collapsed={false} {...handlers} />);
    expect(screen.getByTestId('nav-cluster')).toBeInTheDocument();
    expect(screen.getByTestId('nav-prev')).toBeInTheDocument();
    expect(screen.getByTestId('nav-next')).toBeInTheDocument();
    expect(screen.getByTestId('nav-play')).toBeInTheDocument();
  });
});
