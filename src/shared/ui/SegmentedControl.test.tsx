import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', testId: 'seg-c' },
] as const;

describe('SegmentedControl', () => {
  it('renders a radiogroup with radio segments; selected is aria-checked', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        value="b"
        onChange={onChange}
        ariaLabel="Pick one"
        data-cell-id="seg-group"
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Pick one' })).toHaveAttribute(
      'data-cell-id',
      'seg-group',
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('seg-c')).toBe(radios[2]);
  });

  it('calls onChange on click', () => {
    const onChange = jest.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} ariaLabel="Pick" />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('roving tabindex: selected is tabbable, others are -1', () => {
    render(<SegmentedControl options={OPTIONS} value="a" onChange={jest.fn()} ariaLabel="Pick" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
    expect(radios[2]).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight selects and focuses the next segment; wraps at the end', () => {
    const onChange = jest.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} ariaLabel="Pick" />);
    const radios = screen.getAllByRole('radio');
    radios[2].focus();
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('a');
    expect(document.activeElement).toBe(radios[0]);
  });

  it('Home/End jump to first/last segment', () => {
    const onChange = jest.fn();
    render(<SegmentedControl options={OPTIONS} value="b" onChange={onChange} ariaLabel="Pick" />);
    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[1], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('per-option ariaLabel and title pass through', () => {
    render(
      <SegmentedControl
        options={[{ value: 'x', label: 'X', ariaLabel: 'ecks', title: 'tip' }]}
        value="x"
        onChange={jest.fn()}
        ariaLabel="Pick"
      />,
    );
    const seg = screen.getByRole('radio');
    expect(seg).toHaveAttribute('aria-label', 'ecks');
    expect(seg).toHaveAttribute('title', 'tip');
  });
});
