import { render, screen } from '@testing-library/react';
import { CaptionsButton } from './CaptionsButton';

describe('CaptionsButton', () => {
  it('renders the captions icon button', () => {
    render(<CaptionsButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reflects captionsOn=false via aria-pressed=false', () => {
    render(<CaptionsButton captionsOn={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects captionsOn=true via aria-pressed=true', () => {
    render(<CaptionsButton captionsOn />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses dynamic aria-label based on captionsOn', () => {
    const { rerender } = render(<CaptionsButton captionsOn={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Captions off');
    rerender(<CaptionsButton captionsOn />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Captions on');
  });

  it('is disabled when available=false', () => {
    render(<CaptionsButton available={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is enabled when available=true', () => {
    render(<CaptionsButton available />);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('respects explicit disabled prop', () => {
    render(<CaptionsButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<CaptionsButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
