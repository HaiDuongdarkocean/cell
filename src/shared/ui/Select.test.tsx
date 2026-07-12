import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

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

  // Note: menu width behavior (width: max-content, min-width: 100%,
  // max-width: 320px) is asserted via MCP browser verification because
  // jsdom does not compute styles from external CSS modules. See
  // Select.module.css `.menu` for the implementation.
});
