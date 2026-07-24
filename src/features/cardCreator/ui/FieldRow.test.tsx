import { render, screen, fireEvent } from '@testing-library/react';
import { FieldRow, FieldAutoGrowInput } from './FieldRow';

describe('FieldRow', () => {
  it('renders the label and input', () => {
    render(
      <FieldRow label="Target word" dataId="target">
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    expect(screen.getByText('Target word')).toBeInTheDocument();
    expect(screen.getByTestId('target-row')).toBeInTheDocument();
  });

  it('does not render map select when mappedField is omitted', () => {
    render(
      <FieldRow label="Tags" dataId="tags">
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    expect(screen.queryByRole('button', { name: 'None' })).not.toBeInTheDocument();
  });

  it('renders map select with selected field and options including None', () => {
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={jest.fn()}
        dataId="target"
      >
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    expect(screen.getByRole('button', { name: 'TargetWord' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TargetWord' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sentence' })).toBeInTheDocument();
  });

  it('calls onMapChange with the selected field', () => {
    const onMapChange = jest.fn();
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={onMapChange}
      >
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Sentence' }));
    expect(onMapChange).toHaveBeenCalledWith('Sentence');
  });

  it('calls onMapChange with empty string when None is selected', () => {
    const onMapChange = jest.fn();
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={onMapChange}
      >
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onMapChange).toHaveBeenCalledWith('');
  });
});

describe('FieldAutoGrowInput', () => {
  it('renders an input with the given value', () => {
    render(<FieldAutoGrowInput value="hello" onChange={jest.fn()} aria-label="Test" />);
    const input = screen.getByRole('textbox', { name: 'Test' }) as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('calls onChange when the user types', () => {
    const onChange = jest.fn();
    render(<FieldAutoGrowInput value="" onChange={onChange} aria-label="Test" />);
    const input = screen.getByRole('textbox', { name: 'Test' });
    fireEvent.change(input, { target: { value: 'new text' } });
    expect(onChange).toHaveBeenCalledWith('new text');
  });

  it('shows a clear button when value is non-empty', () => {
    render(<FieldAutoGrowInput value="hello" onChange={jest.fn()} aria-label="Test" />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('hides the clear button when value is empty', () => {
    render(<FieldAutoGrowInput value="" onChange={jest.fn()} aria-label="Test" />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('clears the value when the clear button is clicked', () => {
    const onChange = jest.fn();
    render(<FieldAutoGrowInput value="hello" onChange={onChange} aria-label="Test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('calls onClear instead of onChange when provided', () => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    render(<FieldAutoGrowInput value="hello" onChange={onChange} onClear={onClear} aria-label="Test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides the clear button when clearable is false', () => {
    render(<FieldAutoGrowInput value="hello" onChange={jest.fn()} clearable={false} aria-label="Test" />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('renders a textarea with rows for multi-line content', () => {
    const { container } = render(<FieldAutoGrowInput value={'line1\nline2\nline3'} onChange={jest.fn()} aria-label="Test" />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.getAttribute('rows')).toBe('3');
  });

  it('renders an input without rows for single-line content', () => {
    const { container } = render(<FieldAutoGrowInput value="single line" onChange={jest.fn()} aria-label="Test" />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.hasAttribute('rows')).toBe(false);
  });
});
