import { render, screen, fireEvent } from '@testing-library/react';
import { PlayPauseButton } from './PlayPauseButton';

describe('PlayPauseButton', () => {
  it('shows play icon and "Play" label when paused', () => {
    render(<PlayPauseButton playing={false} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Play');
    expect(btn).not.toHaveAttribute('aria-busy');
  });

  it('shows pause icon and "Pause" label when playing', () => {
    render(<PlayPauseButton playing={true} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Pause');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<PlayPauseButton playing={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows spinner and blocks click when loading', () => {
    const onClick = jest.fn();
    render(<PlayPauseButton playing={false} loading={true} onClick={onClick} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('merges custom className', () => {
    const { container } = render(<PlayPauseButton playing={false} className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
