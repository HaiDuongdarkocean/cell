import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

const longOptions = Array.from({ length: 20 }, (_, i) => ({
  value: `opt-${i}`,
  label: `Option ${i + 1}`,
}));

describe('Select', () => {
  it('renders trigger with selected label', () => {
    render(<Select options={options} value="a" />);
    expect(screen.getByRole('button', { name: 'Option A' })).toBeInTheDocument();
  });

  it('renders placeholder when no value selected', () => {
    render(<Select options={options} placeholder="Choose one" />);
    expect(screen.getByRole('button', { name: 'Choose one' })).toBeInTheDocument();
  });

  it('opens menu and lists options on click', () => {
    render(<Select options={options} value="a" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  it('calls onChange with selected value and closes menu', () => {
    const onChange = jest.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Option B' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports disabled state', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('marks error and disabled visually', () => {
    render(<Select options={options} disabled error />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-invalid', 'true');
  });

  it('closes menu on Escape', () => {
    render(<Select options={options} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('applies left-align class by default', () => {
    render(<Select options={options} value="a" />);
    fireEvent.click(screen.getByRole('button'));
    const menu = screen.getByRole('listbox');
    expect(menu.className).toMatch(/menuAlignLeft/);
  });

  it('applies right-align class when menuAlign="right"', () => {
    render(<Select options={options} value="a" menuAlign="right" />);
    fireEvent.click(screen.getByRole('button'));
    const menu = screen.getByRole('listbox');
    expect(menu.className).toMatch(/menuAlignRight/);
  });

  it('applies size variant classes', () => {
    const { rerender } = render(<Select options={options} size="sm" />);
    expect(screen.getByRole('button').className).toMatch(/triggerSm/);

    rerender(<Select options={options} size="md" />);
    expect(screen.getByRole('button').className).toMatch(/triggerMd/);

    rerender(<Select options={options} size="lg" />);
    expect(screen.getByRole('button').className).toMatch(/triggerLg/);
  });

  it('applies trigger variant classes', () => {
    const { rerender } = render(<Select options={options} variant="outline" />);
    expect(screen.getByRole('button').className).toMatch(/triggerOutline/);

    rerender(<Select options={options} variant="filled" />);
    expect(screen.getByRole('button').className).toMatch(/triggerFilled/);

    rerender(<Select options={options} variant="ghost" />);
    expect(screen.getByRole('button').className).toMatch(/triggerGhost/);
  });

  it('applies validation state classes', () => {
    const { rerender } = render(<Select options={options} state="error" />);
    expect(screen.getByRole('button').className).toMatch(/triggerError/);

    rerender(<Select options={options} state="success" />);
    expect(screen.getByRole('button').className).toMatch(/triggerSuccess/);

    rerender(<Select options={options} state="warning" />);
    expect(screen.getByRole('button').className).toMatch(/triggerWarning/);
  });

  it('keeps error prop backward compatibility', () => {
    render(<Select options={options} error />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button').className).toMatch(/triggerError/);
  });

  it('applies an alignment class when menuAlign is auto', () => {
    render(<Select options={options} value="a" menuAlign="auto" />);
    fireEvent.click(screen.getByRole('button'));
    const menu = screen.getByRole('listbox');
    expect(menu.className).toMatch(/menuAlignLeft|menuAlignRight/);
  });

  it('sets dynamic placement styles when open', () => {
    render(<Select options={longOptions} value="opt-0" />);
    fireEvent.click(screen.getByRole('button'));
    const menu = screen.getByRole('listbox');
    expect(menu.style.getPropertyValue('max-width')).toBeTruthy();
    expect(menu.style.getPropertyValue('max-height')).toBeTruthy();
  });
});
