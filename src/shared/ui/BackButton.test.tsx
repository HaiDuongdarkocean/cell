import { render, screen, fireEvent } from '@testing-library/react';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  it('renders icon-only with aria-label "Go back"', () => {
    render(<BackButton />);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('does not show label text by default', () => {
    render(<BackButton />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows label text when showLabel is true', () => {
    render(<BackButton showLabel />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('uses custom label text', () => {
    render(<BackButton showLabel label="Return" />);
    expect(screen.getByText('Return')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<BackButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<BackButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<BackButton className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
