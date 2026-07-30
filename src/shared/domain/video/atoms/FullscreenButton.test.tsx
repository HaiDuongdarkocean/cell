import { render, screen } from '@testing-library/react';
import { FullscreenButton } from './FullscreenButton';

describe('FullscreenButton', () => {
  it('renders the fullscreen icon button', () => {
    render(<FullscreenButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reflects fullscreen=false via aria-pressed=false', () => {
    render(<FullscreenButton fullscreen={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects fullscreen=true via aria-pressed=true', () => {
    render(<FullscreenButton fullscreen />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses dynamic aria-label based on fullscreen', () => {
    const { rerender } = render(<FullscreenButton fullscreen={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Enter fullscreen');
    rerender(<FullscreenButton fullscreen />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit fullscreen');
  });

  it('respects explicit disabled prop', () => {
    render(<FullscreenButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<FullscreenButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
