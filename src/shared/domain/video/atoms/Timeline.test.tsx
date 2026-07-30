import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('renders with slider role and aria attributes', () => {
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={jest.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Seek');
    expect(slider).toHaveAttribute('aria-valuenow', '30');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '120');
  });

  it('seeks forward 5s on ArrowRight', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(35);
  });

  it('seeks backward 5s on ArrowLeft', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(25);
  });

  it('seeks 10s on Shift+ArrowRight', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight', shiftKey: true });
    expect(onSeek).toHaveBeenCalledWith(40);
  });

  it('clamps seek to duration on End key', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('clamps seek to 0 on Home key', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={30} duration={120} buffered={60} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' });
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('does not seek past duration', () => {
    const onSeek = jest.fn();
    render(<Timeline currentTime={118} duration={120} buffered={120} onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('merges custom className', () => {
    const { container } = render(
      <Timeline currentTime={0} duration={100} buffered={0} onSeek={jest.fn()} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
