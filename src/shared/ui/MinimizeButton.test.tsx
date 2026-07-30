import { render, screen, fireEvent } from '@testing-library/react';
import { MinimizeButton } from './MinimizeButton';

describe('MinimizeButton', () => {
  it('renders with default aria-label "Minimize"', () => {
    render(<MinimizeButton />);
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeInTheDocument();
  });

  it('renders with custom aria-label', () => {
    render(<MinimizeButton ariaLabel="Hide panel" />);
    expect(screen.getByRole('button', { name: 'Hide panel' })).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<MinimizeButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<MinimizeButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<MinimizeButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
