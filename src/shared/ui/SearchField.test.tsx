import { render, screen, fireEvent } from '@testing-library/react';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('renders input and search icon', () => {
    render(<SearchField placeholder="Search" />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = jest.fn();
    render(<SearchField value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'text' } });
    expect(onChange).toHaveBeenCalledWith('text');
  });

  it('clears value and calls onClear', () => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    render(<SearchField value="text" onChange={onChange} onClear={onClear} />);
    fireEvent.click(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('supports uncontrolled mode', () => {
    render(<SearchField placeholder="Search" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'text' } });
    expect(screen.getByRole('searchbox')).toHaveValue('text');
  });
});
