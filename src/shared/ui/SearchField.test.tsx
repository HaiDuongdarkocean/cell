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

  it('keeps focus on the input when clearing', () => {
    render(<SearchField placeholder="Search" />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'text' } });
    input.focus();
    const clear = screen.getByLabelText('Clear');
    expect(fireEvent.pointerDown(clear)).toBe(false);
    fireEvent.click(clear);
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('supports uncontrolled mode', () => {
    render(<SearchField placeholder="Search" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'text' } });
    expect(screen.getByRole('searchbox')).toHaveValue('text');
  });
});
