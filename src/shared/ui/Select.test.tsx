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

const searchableOptions = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
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

  it('sets dynamic placement styles on the menu', () => {
    render(<Select options={longOptions} value="opt-0" />);
    fireEvent.click(screen.getByRole('button'));
    const menu = screen.getByRole('listbox').parentElement;
    expect(menu).toBeTruthy();
    expect(menu?.style.getPropertyValue('max-width')).toBeTruthy();
    expect(menu?.style.getPropertyValue('max-height')).toBeTruthy();
  });

  describe('searchable', () => {
    it('renders search input when searchable is true', () => {
      render(<Select options={searchableOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('filters options when typing', () => {
      render(<Select options={searchableOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'Eng' } });
      expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '日本語' })).not.toBeInTheDocument();
    });

    it('selects from filtered options', () => {
      const onChange = jest.fn();
      render(<Select options={searchableOptions} onChange={onChange} searchable />);
      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: '日本' } });
      fireEvent.click(screen.getByRole('option', { name: '日本語' }));
      expect(onChange).toHaveBeenCalledWith('ja');
    });

    it('shows empty state when no matches', () => {
      render(<Select options={searchableOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'xyz' } });
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(screen.getByText('No matching options')).toBeInTheDocument();
    });

    it('uses custom searchLabel when filtering', () => {
      const opts = [
        { value: 'us', label: '🇺🇸 US', searchLabel: 'United States' },
        { value: 'vn', label: '🇻🇳 VN', searchLabel: 'Vietnam' },
      ];
      render(<Select options={opts} searchable />);
      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'viet' } });
      expect(screen.getByRole('option', { name: '🇻🇳 VN' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '🇺🇸 US' })).not.toBeInTheDocument();
    });

    it('resets query on close', () => {
      render(<Select options={searchableOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'eng' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // Re-open; all options should be back and query empty.
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('option', { name: '日本語' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search...')).toHaveValue('');
    });
  });
});
