import { render, screen, fireEvent } from '@testing-library/react';
import { MuteButton } from './MuteButton';

describe('MuteButton', () => {
  it('shows "Mute" label and aria-pressed=false when not muted', () => {
    render(<MuteButton muted={false} volume={0.8} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Mute');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Unmute" label and aria-pressed=true when muted', () => {
    render(<MuteButton muted={true} volume={0.8} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Unmute');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<MuteButton muted={false} volume={0.8} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<MuteButton muted={false} volume={0.8} className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders without error at boundary volumes', () => {
    const { unmount } = render(<MuteButton muted={false} volume={0} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    unmount();
    render(<MuteButton muted={false} volume={1} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
