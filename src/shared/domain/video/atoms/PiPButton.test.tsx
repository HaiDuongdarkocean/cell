import { render, screen } from '@testing-library/react';
import { PiPButton } from './PiPButton';

describe('PiPButton', () => {
  it('renders the pip icon button', () => {
    render(<PiPButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reflects pip=false via aria-pressed=false', () => {
    render(<PiPButton pip={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects pip=true via aria-pressed=true', () => {
    render(<PiPButton pip />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses dynamic aria-label based on pip', () => {
    const { rerender } = render(<PiPButton pip={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Enter picture-in-picture');
    rerender(<PiPButton pip />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit picture-in-picture');
  });

  it('respects explicit disabled prop', () => {
    render(<PiPButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<PiPButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
