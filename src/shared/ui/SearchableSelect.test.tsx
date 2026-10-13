import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableSelect } from './SearchableSelect';

const options = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'ja', label: 'Japanese' },
];

describe('SearchableSelect', () => {
  it('renders trigger with selected label', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
      />,
    );
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('opens menu and shows options when trigger is clicked', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Vietnamese' })).toBeInTheDocument();
  });

  it('calls onChange and closes menu when an option is clicked', () => {
    const onChange = jest.fn();
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={onChange}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    fireEvent.click(screen.getByRole('option', { name: 'Vietnamese' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('vi');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters options when typing in the search input', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    const search = screen.getByLabelText('Search options');
    fireEvent.change(search, { target: { value: 'viet' } });
    expect(screen.getByRole('option', { name: 'Vietnamese' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'English' })).not.toBeInTheDocument();
  });

  it('shows empty state when search yields no results', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    const search = screen.getByLabelText('Search options');
    fireEvent.change(search, { target: { value: 'klingon' } });
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('closes the menu when Escape is pressed in search input', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const search = screen.getByLabelText('Search options');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects an option when the component lives inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);
    const onChange = jest.fn();
    try {
      const { getByRole, getByTestId } = render(
        <SearchableSelect
          options={options}
          value="en"
          onChange={onChange}
          ariaLabel="Language"
          dataTestId="language-select"
        />,
        { container, baseElement: shadow },
      );
      fireEvent.click(getByTestId('language-select'));
      const option = getByRole('option', { name: 'Vietnamese' });
      fireEvent.mouseDown(option);
      fireEvent.click(option);
      expect(onChange).toHaveBeenCalledWith('vi');
    } finally {
      host.remove();
    }
  });

  it('spawns a ripple on pointerdown of an option', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    const option = screen.getByRole('option', { name: 'Vietnamese' });
    fireEvent.pointerDown(option);
    expect(option.querySelector('[data-tihoka-ripple]')).not.toBeNull();
  });

  it('does not open menu when disabled', () => {
    render(
      <SearchableSelect
        options={options}
        value="en"
        onChange={jest.fn()}
        ariaLabel="Language"
        dataTestId="language-select"
        disabled
      />,
    );
    fireEvent.click(screen.getByTestId('language-select'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
