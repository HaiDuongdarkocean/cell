import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders a checkbox with label', () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toBeInTheDocument();
  });

  it('toggles on click', () => {
    const onChange = jest.fn();
    render(<Checkbox label="Accept" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accept' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports disabled', () => {
    render(<Checkbox label="Accept" disabled />);
    expect(screen.getByRole('checkbox', { name: 'Accept' })).toBeDisabled();
  });

  it('sets indeterminate state', () => {
    render(<Checkbox label="Accept" indeterminate />);
    expect(screen.getByRole('checkbox')).toBePartiallyChecked();
  });

  it('sets error state', () => {
    render(<Checkbox label="Accept" error />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders helper text', () => {
    render(<Checkbox label="Accept" helperText="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
