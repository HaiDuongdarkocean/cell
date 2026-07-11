import { render, screen } from '@testing-library/react';
import { Progress } from './Progress';

describe('Progress', () => {
  it('renders with value and max', () => {
    render(<Progress value={25} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('caps percentage between 0 and 100', () => {
    const { rerender } = render(<Progress value={150} max={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150');
    rerender(<Progress value={-10} max={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '-10');
  });

  it('renders indeterminate', () => {
    render(<Progress indeterminate />);
    expect(screen.getByRole('progressbar')).toHaveClass('indeterminate');
  });
});
