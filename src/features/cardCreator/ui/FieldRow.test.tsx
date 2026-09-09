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

  it('renders a trailing action in the header', () => {
    render(
      <FieldRow
        label="Target word"
        dataId="target"
        trailing={<button type="button" aria-label="Generate" data-cell-id="generate-target">Generate</button>}
      >
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>,
    );
    expect(screen.getByTestId('generate-target')).toBeInTheDocument();
  });

  it('does not render a field-map select', () => {
    render(
      <FieldRow label="Target word" dataId="target">
        <FieldAutoGrowInput value="" onChange={jest.fn()} />
      </FieldRow>
    );
    expect(screen.getByText('Target word')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Map/ })).not.toBeInTheDocument();
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

  it('renders a textarea (not input) for single-line content so it wraps and grows', () => {
    const { container } = render(<FieldAutoGrowInput value="single line" onChange={jest.fn()} aria-label="Test" />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const input = container.querySelector('input');
    expect(textarea).not.toBeNull();
    expect(input).toBeNull();
    expect(textarea.getAttribute('rows')).toBe('1');
  });
});
