import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders an accessible switch with aria-checked', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Notifications" />);
    const toggle = screen.getByRole('switch', { name: 'Notifications' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects checked state via aria-checked', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Notifications" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with the next value on click', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from true to false', () => {
    const onChange = jest.fn();
    render(<Toggle checked={true} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Toggle size={size} checked={false} onChange={() => {}} ariaLabel={`Size ${size}`} />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
      unmount();
    }
  });

  it('supports disabled state', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Disabled" disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('forwards name attribute', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Named" name="notifications" />);
    expect(screen.getByRole('switch')).toHaveAttribute('name', 'notifications');
  });

  it('forwards id and data-testid', () => {
    render(<Toggle checked={false} onChange={() => {}} ariaLabel="Test" id="my-toggle" dataTestId="toggle-el" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('id', 'my-toggle');
    expect(screen.getByTestId('toggle-el')).toBeInTheDocument();
  });
});
