import { render, screen, fireEvent } from '@testing-library/react';
import { CollapseButton } from './CollapseButton';

describe('CollapseButton', () => {
  it('sets aria-expanded to true when not collapsed', () => {
    render(<CollapseButton collapsed={false} aria-label="Toggle section" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-expanded to false when collapsed', () => {
    render(<CollapseButton collapsed={true} aria-label="Toggle section" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('sets aria-controls when controlsId is provided', () => {
    render(<CollapseButton collapsed={false} controlsId="section-1" aria-label="Toggle" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'section-1');
  });

  it('omits aria-controls when controlsId is not provided', () => {
    render(<CollapseButton collapsed={false} aria-label="Toggle" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-controls');
  });

  it('applies collapsed class when collapsed', () => {
    const { container } = render(<CollapseButton collapsed={true} aria-label="Toggle" />);
    expect(container.firstChild).toHaveClass('collapsed');
  });

  it('is disabled when disabled prop is set', () => {
    render(<CollapseButton collapsed={false} disabled aria-label="Toggle" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<CollapseButton collapsed={false} onClick={onClick} aria-label="Toggle" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<CollapseButton collapsed={false} className="extra" aria-label="Toggle" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
