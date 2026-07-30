import { render, screen, fireEvent } from '@testing-library/react';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders with default aria-label', () => {
    render(<CopyButton value="hello" />);
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    render(<CopyButton value="hello" label="Copy" />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('allows custom aria-label', () => {
    render(<CopyButton value="hello" aria-label="Copy code" />);
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('copies value to clipboard on click', () => {
    render(<CopyButton value="test-value" />);
    fireEvent.click(screen.getByRole('button'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-value');
  });

  it('renders disabled state', () => {
    render(<CopyButton value="hello" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    const { container } = render(<CopyButton value="hello" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
