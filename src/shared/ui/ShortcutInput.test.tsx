import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';

describe('ShortcutInput atom — settings-controls-restyle spec F3', () => {
  it('renders text input with value + maxLength 1', () => {
    render(<ShortcutInput value="a" onChange={() => {}} aria-label="Previous cue" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('a');
    expect(input).toHaveAttribute('maxLength', '1');
  });

  it('normalizes typed key to lowercase slice(0,1)', () => {
    const onChange = jest.fn();
    render(<ShortcutInput value="" onChange={onChange} aria-label="Previous cue" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Q' } });
    expect(onChange).toHaveBeenCalledWith('q');
  });

  it('slices multi-char paste to first char', () => {
    const onChange = jest.fn();
    render(<ShortcutInput value="" onChange={onChange} aria-label="Previous cue" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('requires aria-label', () => {
    render(<ShortcutInput value="a" onChange={() => {}} aria-label="Next cue" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Next cue');
  });

  it('forwards data-testid', () => {
    render(<ShortcutInput value="a" onChange={() => {}} aria-label="Test" data-testid="shortcut-prev-cue" />);
    expect(screen.getByTestId('shortcut-prev-cue')).toBeInTheDocument();
  });

  it('forwards id', () => {
    render(<ShortcutInput value="a" onChange={() => {}} aria-label="Test" id="set-shortcut-prev-cue" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'set-shortcut-prev-cue');
  });
});
