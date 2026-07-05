import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, jest } from '@jest/globals';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';

describe('SearchableSelect', () => {
  const options = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish (Español)' },
    { value: 'fr', label: 'French (Français)' },
    { value: 'de', label: 'German (Deutsch)' },
  ];

  it('renders trigger button with selected value', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    expect(trigger).toHaveTextContent('English');
  });

  it('renders placeholder when no value selected', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={jest.fn()}
        ariaLabel="Select language"
        placeholder="Choose language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    expect(trigger).toHaveTextContent('Choose language');
  });

  it('opens menu when trigger clicked', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes menu when trigger clicked again', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters options by search query case-insensitively', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);

    const searchInput = screen.getByLabelText('Search options');
    fireEvent.change(searchInput, { target: { value: 'spanish' } });

    expect(screen.getByText('Spanish (Español)')).toBeInTheDocument();
    expect(screen.queryByText('English')).not.toBeInTheDocument();
  });

  it('filters options by native name in parens', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);

    const searchInput = screen.getByLabelText('Search options');
    fireEvent.change(searchInput, { target: { value: 'español' } });

    expect(screen.getByText('Spanish (Español)')).toBeInTheDocument();
    expect(screen.queryByText('English')).not.toBeInTheDocument();
  });

  it('shows empty state when no match', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);

    const searchInput = screen.getByLabelText('Search options');
    fireEvent.change(searchInput, { target: { value: 'xyz' } });

    expect(screen.getByText('No languages found')).toBeInTheDocument();
  });

  it('calls onChange when option clicked', () => {
    const handleChange = jest.fn();
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={handleChange}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByText('English'));
    expect(handleChange).toHaveBeenCalledWith('en');
  });

  it('shows check mark on selected option', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);

    const englishOption = screen.getByTestId('searchable-select-option-en');
    expect(englishOption).toHaveAttribute('aria-selected', 'true');
    expect(englishOption.querySelector('svg')).toBeInTheDocument();
  });

  it('applies data-testid when provided', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
        dataTestId="test-select"
      />
    );
    expect(screen.getByTestId('test-select')).toBeInTheDocument();
  });

  it('applies id when provided', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
        id="select-id"
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    expect(trigger).toHaveAttribute('id', 'select-id');
  });

  it('disables trigger when disabled prop is true', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
        disabled
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    expect(trigger).toBeDisabled();
  });

  it('does not open menu when disabled trigger is clicked', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Select language"
        disabled
      />
    );
    const trigger = screen.getByRole('button', { name: 'Select language' });
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
