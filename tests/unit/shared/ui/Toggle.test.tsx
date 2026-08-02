import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest } from '@jest/globals';
import { Toggle } from '@/shared/ui/Toggle';

describe('Toggle', () => {
  it('renders unchecked state', () => {
    render(<Toggle checked={false} onChange={jest.fn()} ariaLabel="Test toggle" />);
    const button = screen.getByRole('switch', { name: 'Test toggle' });
    expect(button).toHaveAttribute('aria-checked', 'false');
  });

  it('renders checked state', () => {
    render(<Toggle checked={true} onChange={jest.fn()} ariaLabel="Test toggle" />);
    const button = screen.getByRole('switch', { name: 'Test toggle' });
    expect(button).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with opposite value when clicked', () => {
    const handleChange = jest.fn();
    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Test toggle" />);
    const button = screen.getByRole('switch', { name: 'Test toggle' });
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when checked and clicked', () => {
    const handleChange = jest.fn();
    render(<Toggle checked={true} onChange={handleChange} ariaLabel="Test toggle" />);
    const button = screen.getByRole('switch', { name: 'Test toggle' });
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('applies data-cell-id when provided', () => {
    render(<Toggle checked={false} onChange={jest.fn()} ariaLabel="Test toggle" dataTestId="test-toggle" />);
    const button = screen.getByTestId('test-toggle');
    expect(button).toBeInTheDocument();
  });

  it('applies id when provided', () => {
    render(<Toggle checked={false} onChange={jest.fn()} ariaLabel="Test toggle" id="toggle-id" />);
    const button = screen.getByRole('switch', { name: 'Test toggle' });
    expect(button).toHaveAttribute('id', 'toggle-id');
  });

});
