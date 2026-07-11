import { render, screen, fireEvent } from '@testing-library/react';
import { CheckboxGroup } from './CheckboxGroup';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

describe('CheckboxGroup', () => {
  it('renders options', () => {
    render(<CheckboxGroup options={options} value={['a']} />);
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'B' })).not.toBeChecked();
  });

  it('toggles values and calls onChange', () => {
    const onChange = jest.fn();
    render(<CheckboxGroup options={options} value={['a']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
