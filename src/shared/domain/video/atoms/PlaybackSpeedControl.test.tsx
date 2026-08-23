import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

describe('PlaybackSpeedControl', () => {
  it('renders button showing current speed "1x" by default', () => {
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /playback speed/i })).toHaveTextContent('1x');
  });

  it('renders "1.5x" when currentSpeed is 1.5', () => {
    render(<PlaybackSpeedControl currentSpeed={1.5} onSpeedChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /playback speed/i })).toHaveTextContent('1.5x');
  });

  it('opens dropdown with all speeds when button clicked', () => {
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} />);
    // dropdown closed initially
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /playback speed/i }));
    SPEEDS.forEach((s) => {
      const label = `${s}x`;
      expect(screen.getByRole('menuitemradio', { name: new RegExp(label) })).toBeInTheDocument();
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('calls onSpeedChange(1.5) and closes dropdown when 1.5x clicked', () => {
    const onSpeedChange = jest.fn();
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByRole('button', { name: /playback speed/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /1\.5x/i }));
    expect(onSpeedChange).toHaveBeenCalledWith(1.5);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('highlights current speed (1x) in dropdown by default', () => {
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /playback speed/i }));
    const item = screen.getByRole('menuitemradio', { name: /1x/i });
    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('closes dropdown on Escape', () => {
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /playback speed/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes dropdown on click outside', () => {
    render(
      <div>
        <PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} />
        <button type="button">outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /playback speed/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: /playback speed/i })).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(
      <PlaybackSpeedControl currentSpeed={1} onSpeedChange={jest.fn()} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
