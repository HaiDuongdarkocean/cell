import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from '@/shared/ui/Toggle';

describe('Toggle atom — settings-controls-restyle spec F1', () => {
  it('renders switch pill with aria-checked + aria-pressed reflecting state', () => {
    const { rerender } = render(<Toggle checked={false} onChange={() => {}} aria-label="Test toggle" />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', 'Test toggle');

    rerender(<Toggle checked={true} onChange={() => {}} aria-label="Test toggle" />);
    expect(btn).toHaveAttribute('aria-checked', 'true');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with next state on click (false → true)', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="Test toggle" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with next state on click (true → false)', () => {
    const onChange = jest.fn();
    render(<Toggle checked={true} onChange={onChange} aria-label="Test toggle" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders thumb span for slide animation', () => {
    const { container } = render(<Toggle checked={true} onChange={() => {}} aria-label="Test toggle" />);
    const thumb = container.querySelector('span[aria-hidden="true"]');
    expect(thumb).not.toBeNull();
  });

  it('forwards data-testid', () => {
    render(<Toggle checked={false} onChange={() => {}} aria-label="Test toggle" data-testid="my-toggle" />);
    expect(screen.getByTestId('my-toggle')).toBeInTheDocument();
  });

  it('forwards id', () => {
    render(<Toggle checked={false} onChange={() => {}} aria-label="Test toggle" id="my-id" />);
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-id');
  });
});
