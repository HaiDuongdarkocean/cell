import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroup } from './RadioGroup';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

describe('RadioGroup', () => {
  it('renders options', () => {
    render(<RadioGroup name="group" options={options} value="a" />);
    expect(screen.getByRole('radio', { name: 'A' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'B' })).not.toBeChecked();
  });

  it('selects value and calls onChange', () => {
    const onChange = jest.fn();
    render(<RadioGroup name="group" options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
