import { render, screen } from '@testing-library/react';
import { InputField } from './InputField';

describe('InputField', () => {
  it('renders label and input', () => {
    render(<InputField label="Name" placeholder="Enter name" />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(<InputField label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<InputField label="Name" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text when no error', () => {
    render(<InputField label="Name" helperText="Optional" />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('links label to input via htmlFor', () => {
    render(<InputField id="field" label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'field');
  });
});
