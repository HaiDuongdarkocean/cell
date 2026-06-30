import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelect } from '@/entrypoints/popup/components/settings/MultiSelect';
import type { MultiSelectOption } from '@/entrypoints/popup/components/settings/MultiSelect';

const options: MultiSelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'zh', label: 'Chinese (中文)' },
  { value: 'fr', label: 'French (Français)' },
];

describe('MultiSelect', () => {
  // === Rendering ===

  it('renders search input and option list', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // All options rendered by default
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('uses default search placeholder', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search languages...');
  });

  // === Filtering ===

  it('filters options by label when typing in search', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Span' } });
    const visible = screen.getAllByRole('option');
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveTextContent('Spanish');
  });

  it('search is case-insensitive', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'french' } });
    const visible = screen.getAllByRole('option');
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveTextContent('French');
  });

  it('matches native name in parentheses', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'español' } });
    const visible = screen.getAllByRole('option');
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveTextContent('Spanish');
  });

  // === Selection toggling ===

  it('clicking an unselected option adds it to selectedValues via onChange', () => {
    const onChange = jest.fn();
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={onChange}
      />,
    );
    screen.getByTestId('lang-option-en').click();
    expect(onChange).toHaveBeenCalledWith(['en']);
  });

  it('clicking a selected option removes it from selectedValues via onChange', () => {
    const onChange = jest.fn();
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['en', 'zh']}
        onChange={onChange}
      />,
    );
    screen.getByTestId('lang-option-en').click();
    expect(onChange).toHaveBeenCalledWith(['zh']);
  });

  // === Selection state ===

  it('aria-selected reflects selection state', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['en']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('lang-option-en')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('lang-option-zh')).toHaveAttribute('aria-selected', 'false');
  });

  it('toggle switch is shown for all items (selected and unselected)', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['en']}
        onChange={() => {}}
      />,
    );
    const enOption = screen.getByTestId('lang-option-en');
    const zhOption = screen.getByTestId('lang-option-zh');
    // Toggle switch should be present for both selected and unselected
    expect(enOption.querySelector('[data-toggle="switch"]')).toBeInTheDocument();
    expect(zhOption.querySelector('[data-toggle="switch"]')).toBeInTheDocument();
  });

  it('selected items appear first in the list with section header', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['zh', 'fr']}
        onChange={() => {}}
      />,
    );
    const allOptions = screen.getAllByRole('option');
    // Selected items (zh, fr) should come first
    expect(allOptions[0]).toHaveTextContent('Chinese');
    expect(allOptions[1]).toHaveTextContent('French');
    // Unselected items (en, es) should come after
    expect(allOptions[2]).toHaveTextContent('English');
    expect(allOptions[3]).toHaveTextContent('Spanish');
    // Section headers should be present
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('All languages')).toBeInTheDocument();
  });

  it('only "All languages" section appears when no items selected', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    expect(screen.getByText('All languages')).toBeInTheDocument();
    expect(screen.queryByTestId('lang-footer')).not.toBeInTheDocument();
  });

  it('count badge shows number of selected items', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['en', 'es']}
        onChange={() => {}}
      />,
    );
    const badge = screen.getByTestId('lang-count');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
  });

  it('count badge is hidden when no items selected', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('lang-count')).not.toBeInTheDocument();
  });

  it('shows empty state when search yields no results', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'klingon' } });
    expect(screen.getByText('No languages found')).toBeInTheDocument();
  });

  // === Keyboard ===

  it('Enter key on an option toggles selection', () => {
    const onChange = jest.fn();
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={onChange}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('lang-option-fr'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['fr']);
  });

  it('Space key on an option toggles selection', () => {
    const onChange = jest.fn();
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={['fr']}
        onChange={onChange}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('lang-option-fr'), { key: ' ' });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Escape blurs the search input', () => {
    render(
      <MultiSelect
        testId="lang"
        options={options}
        selectedValues={[]}
        onChange={() => {}}
      />,
    );
    const search = screen.getByRole('searchbox');
    search.focus();
    expect(document.activeElement).toBe(search);
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(document.activeElement).not.toBe(search);
  });
});
