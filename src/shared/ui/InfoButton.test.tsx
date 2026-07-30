import { render, screen, fireEvent } from '@testing-library/react';
import { InfoButton } from './InfoButton';

describe('InfoButton', () => {
  it('renders with default aria-label "More information"', () => {
    render(<InfoButton />);
    expect(screen.getByRole('button', { name: 'More information' })).toBeInTheDocument();
  });

  it('renders with custom aria-label', () => {
    render(<InfoButton ariaLabel="Show details" />);
    expect(screen.getByRole('button', { name: 'Show details' })).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<InfoButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<InfoButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<InfoButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
