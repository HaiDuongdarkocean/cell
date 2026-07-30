import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders an accessible button with aria-pressed', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Notifications" />);
    const toggle = screen.getByRole('button', { name: 'Notifications' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects checked state via aria-pressed', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Notifications" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the next value on click', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from true to false', () => {
    const onChange = jest.fn();
    render(<Toggle checked={true} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Toggle size={size} checked={false} onChange={() => {}} ariaLabel={`Size ${size}`} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('supports disabled state', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Disabled" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards name attribute', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Named" name="notifications" />);
    expect(screen.getByRole('button')).toHaveAttribute('name', 'notifications');
  });

  it('forwards id and data-testid', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Test" id="my-toggle" dataTestId="toggle-el" />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('id', 'my-toggle');
    expect(screen.getByTestId('toggle-el')).toBeInTheDocument();
  });
});
