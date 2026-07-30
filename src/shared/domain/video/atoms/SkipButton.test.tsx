import { render, screen } from '@testing-library/react';
import { SkipButton } from './SkipButton';

describe('SkipButton', () => {
  it('renders the skip icon button', () => {
    render(<SkipButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses forward aria-label by default', () => {
    render(<SkipButton />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Skip forward 10 seconds');
  });

  it('uses backward aria-label when direction=backward', () => {
    render(<SkipButton direction="backward" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Skip backward 10 seconds');
  });

  it('reflects custom seconds in aria-label', () => {
    render(<SkipButton direction="forward" seconds={5} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Skip forward 5 seconds');
  });

  it('renders both directions', () => {
    const directions = ['forward', 'backward'] as const;
    for (const direction of directions) {
      const { unmount } = render(<SkipButton direction={direction} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('respects explicit disabled prop', () => {
    render(<SkipButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<SkipButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
