import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import type { MultiSelectOption } from '@/shared/ui/MultiSelect';

const options: MultiSelectOption[] = [
  { value: 'all', label: 'All languages' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'zh', label: 'Chinese (中文)' },
  { value: 'fr', label: 'French (Français)' },
];

const renderMultiSelect = (
  props: Partial<Parameters<typeof MultiSelect>[0]> = {},
  onChange = jest.fn(),
) => {
  render(
    <MultiSelect
      testId="lang"
      options={options}
      selectedValues={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
};

describe('MultiSelect (tag field)', () => {
  // === Rendering ===

  it('renders the search input', () => {
    renderMultiSelect();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('uses the i18n default search placeholder when nothing is selected', () => {
    renderMultiSelect();
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search languages…');
  });

  it('renders selected values as chips', () => {
    renderMultiSelect({ selectedValues: ['en', 'fr'] });
    expect(screen.getByTestId('lang-chip-en')).toHaveTextContent('English');
    expect(screen.getByTestId('lang-chip-fr')).toHaveTextContent('French');
  });

  // === Suggestions ===

  it('shows the suggestion listbox when the input is focused', () => {
    renderMultiSelect();
    fireEvent.focus(screen.getByRole('searchbox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(options.length);
  });

  it('filters suggestions by label when typing', () => {
    renderMultiSelect();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Span' } });
    const visible = screen.getAllByRole('option');
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveTextContent('Spanish');
  });

  it('matches native name in parentheses, case-insensitive', () => {
    renderMultiSelect();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'español' } });
    const visible = screen.getAllByRole('option');
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveTextContent('Spanish');
  });

  it('hides already-selected values from suggestions', () => {
    renderMultiSelect({ selectedValues: ['en'] });
    fireEvent.focus(screen.getByRole('searchbox'));
    expect(screen.queryByTestId('lang-option-en')).not.toBeInTheDocument();
  });

  it('shows empty state when search yields no results', () => {
    renderMultiSelect();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'klingon' } });
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  // === Add / remove ===

  it('clicking a suggestion adds it via onChange', () => {
    const onChange = renderMultiSelect();
    fireEvent.focus(screen.getByRole('searchbox'));
    screen.getByTestId('lang-option-en').click();
    expect(onChange).toHaveBeenCalledWith(['en']);
  });

  it('clicking a chip remove button removes it via onChange', () => {
    const onChange = renderMultiSelect({ selectedValues: ['en', 'zh'] });
    screen.getByTestId('lang-remove-en').click();
    expect(onChange).toHaveBeenCalledWith(['zh']);
  });

  it('Enter adds the first suggestion', () => {
    const onChange = renderMultiSelect();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'chin' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['zh']);
  });

  it('Backspace on empty query removes the last chip', () => {
    const onChange = renderMultiSelect({ selectedValues: ['en', 'fr'] });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['en']);
  });

  it('Escape blurs the search input', () => {
    renderMultiSelect();
    const input = screen.getByRole('searchbox');
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.activeElement).not.toBe(input);
  });

  // === Exclusive values (e.g. 'all') ===

  it('adding an exclusive value clears other selections', () => {
    const onChange = renderMultiSelect({ selectedValues: ['en', 'fr'], exclusiveValues: ['all'] });
    fireEvent.focus(screen.getByRole('searchbox'));
    screen.getByTestId('lang-option-all').click();
    expect(onChange).toHaveBeenCalledWith(['all']);
  });

  it('adding a specific value while an exclusive is set drops the exclusive', () => {
    const onChange = renderMultiSelect({ selectedValues: ['all'], exclusiveValues: ['all'] });
    fireEvent.focus(screen.getByRole('searchbox'));
    screen.getByTestId('lang-option-es').click();
    expect(onChange).toHaveBeenCalledWith(['es']);
  });

  // === Popular quick-picks ===

  it('shows popular chips when nothing is selected', () => {
    renderMultiSelect({ popularValues: ['en', 'fr'] });
    expect(screen.getByTestId('lang-popular-en')).toBeInTheDocument();
    expect(screen.getByTestId('lang-popular-fr')).toBeInTheDocument();
  });

  it('hides popular row once something is selected', () => {
    renderMultiSelect({ selectedValues: ['es'], popularValues: ['en', 'fr'] });
    expect(screen.queryByTestId('lang-popular-en')).not.toBeInTheDocument();
  });

  it('clicking a popular chip adds it via onChange', () => {
    const onChange = renderMultiSelect({ popularValues: ['en'] });
    screen.getByTestId('lang-popular-en').click();
    expect(onChange).toHaveBeenCalledWith(['en']);
  });
});
