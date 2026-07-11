import { render, screen, fireEvent } from '@testing-library/react';
import { Radio } from './Radio';

describe('Radio', () => {
  it('renders a radio with label', () => {
    render(<Radio label="Option A" name="group" />);
    expect(screen.getByRole('radio', { name: 'Option A' })).toBeInTheDocument();
  });

  it('selects on click', () => {
    const onChange = jest.fn();
    render(<Radio label="Option A" name="group" value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Option A' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports disabled and error', () => {
    render(<Radio label="Option A" name="group" disabled error />);
    expect(screen.getByRole('radio', { name: 'Option A' })).toBeDisabled();
    expect(screen.getByRole('radio')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders helper text', () => {
    render(<Radio label="Option A" name="group" helperText="Pick this" />);
    expect(screen.getByText('Pick this')).toBeInTheDocument();
  });
});
